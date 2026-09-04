import type {
  GoogleLatLngLike,
  GooglePlaceConstructor,
  GooglePlaceLike,
} from '../lib/googleMaps';
import type { Place } from '../types/place';

const CACHE_PREFIX = 'together:google-place-id:';
const MAX_CONCURRENT_LOOKUPS = 3;

interface CachedPlaceId {
  googlePlaceId: string;
  identityFingerprint: string;
}

export interface ResolvedGooglePlace {
  place: Place;
  googlePlaceId: string;
  location: GoogleLatLngLike;
  formattedAddress: string | null;
}

export type UnmatchedPlaceReason =
  | 'no-confident-match'
  | 'missing-location'
  | 'lookup-failed';

export interface UnmatchedGooglePlace {
  place: Place;
  reason: UnmatchedPlaceReason;
}

export interface GooglePlaceResolution {
  resolved: ResolvedGooglePlace[];
  unmatched: UnmatchedGooglePlace[];
}

function normalizeIdentityValue(value: string | null): string {
  return (value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function getIdentityFingerprint(place: Place): string {
  return JSON.stringify([
    normalizeIdentityValue(place.name),
    normalizeIdentityValue(place.address),
    normalizeIdentityValue(place.location),
    normalizeIdentityValue(place.maps_url),
  ]);
}

function getCacheKey(placeId: string): string {
  return `${CACHE_PREFIX}${placeId}`;
}

function readCachedPlaceId(place: Place): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(getCacheKey(place.id));
    if (!rawValue) return null;

    const cachedValue = JSON.parse(rawValue) as Partial<CachedPlaceId>;
    const currentFingerprint = getIdentityFingerprint(place);

    if (
      typeof cachedValue.googlePlaceId !== 'string' ||
      cachedValue.identityFingerprint !== currentFingerprint
    ) {
      window.localStorage.removeItem(getCacheKey(place.id));
      return null;
    }

    return cachedValue.googlePlaceId;
  } catch {
    return null;
  }
}

function cachePlaceId(place: Place, googlePlaceId: string): void {
  if (typeof window === 'undefined') return;

  const cachedValue: CachedPlaceId = {
    googlePlaceId,
    identityFingerprint: getIdentityFingerprint(place),
  };

  try {
    window.localStorage.setItem(getCacheKey(place.id), JSON.stringify(cachedValue));
  } catch {
    // Local storage can be unavailable in private/restricted browsing modes.
    // Mapping still works; it simply resolves again next time.
  }
}

function removeCachedPlaceId(placeId: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(getCacheKey(placeId));
  } catch {
    // No action is required when local storage is unavailable.
  }
}

function normalizeMatchValue(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getTokens(value: string): Set<string> {
  return new Set(value.split(' ').filter((token) => token.length > 1));
}

function tokenSimilarity(first: string, second: string): number {
  if (!first || !second) return 0;
  if (first === second) return 1;

  const firstTokens = getTokens(first);
  const secondTokens = getTokens(second);
  if (firstTokens.size === 0 || secondTokens.size === 0) return 0;

  let sharedCount = 0;
  for (const token of firstTokens) {
    if (secondTokens.has(token)) sharedCount += 1;
  }

  return sharedCount / Math.max(firstTokens.size, secondTokens.size);
}

function getStreetNumber(value: string): string | null {
  return value.match(/\b\d+[a-z]?\b/i)?.[0]?.toLocaleLowerCase() ?? null;
}

function getCandidateScore(place: Place, candidate: GooglePlaceLike): number {
  const savedName = normalizeMatchValue(place.name);
  const candidateName = normalizeMatchValue(candidate.displayName);
  const savedAddress = normalizeMatchValue(place.address);
  const candidateAddress = normalizeMatchValue(candidate.formattedAddress);
  const savedLocation = normalizeMatchValue(place.location);

  let score = 0;

  if (savedName && candidateName) {
    if (savedName === candidateName) {
      score += 8;
    } else if (savedName.includes(candidateName) || candidateName.includes(savedName)) {
      score += 5;
    } else {
      score += tokenSimilarity(savedName, candidateName) * 4;
    }
  }

  if (savedAddress && candidateAddress) {
    if (candidateAddress.includes(savedAddress) || savedAddress.includes(candidateAddress)) {
      score += 6;
    } else {
      score += tokenSimilarity(savedAddress, candidateAddress) * 5;
    }
  }

  if (savedLocation && candidateAddress.includes(savedLocation)) {
    score += 2;
  }

  return score;
}

function isConfidentCandidate(place: Place, candidate: GooglePlaceLike, score: number): boolean {
  if (!candidate.id || !candidate.location) return false;

  const savedName = normalizeMatchValue(place.name);
  const candidateName = normalizeMatchValue(candidate.displayName);
  const nameSimilarity = tokenSimilarity(savedName, candidateName);
  const nameMatches =
    savedName === candidateName ||
    (savedName.length >= 4 && candidateName.includes(savedName)) ||
    (candidateName.length >= 4 && savedName.includes(candidateName)) ||
    nameSimilarity >= 0.6;

  if (!nameMatches) return false;

  const savedAddress = normalizeMatchValue(place.address);
  const candidateAddress = normalizeMatchValue(candidate.formattedAddress);

  if (savedAddress) {
    if (!candidateAddress) return false;

    const savedStreetNumber = getStreetNumber(savedAddress);
    const candidateStreetNumber = getStreetNumber(candidateAddress);

    if (
      savedStreetNumber &&
      candidateStreetNumber &&
      savedStreetNumber !== candidateStreetNumber
    ) {
      return false;
    }

    const addressMatches =
      candidateAddress.includes(savedAddress) ||
      savedAddress.includes(candidateAddress) ||
      tokenSimilarity(savedAddress, candidateAddress) >= 0.45;

    return addressMatches && score >= 7;
  }

  const savedLocation = normalizeMatchValue(place.location);
  if (savedLocation) {
    return candidateAddress.includes(savedLocation) && score >= 7;
  }

  // A name-only lookup is accepted only when the match itself is very strong.
  return score >= 8;
}

async function resolveCachedPlace(
  place: Place,
  googlePlaceId: string,
  PlaceConstructor: GooglePlaceConstructor,
): Promise<ResolvedGooglePlace | null> {
  try {
    const googlePlace = new PlaceConstructor({ id: googlePlaceId });
    await googlePlace.fetchFields({
      fields: ['displayName', 'formattedAddress', 'location'],
    });

    if (!googlePlace.location) {
      removeCachedPlaceId(place.id);
      return null;
    }

    return {
      place,
      googlePlaceId,
      location: googlePlace.location,
      formattedAddress: googlePlace.formattedAddress ?? null,
    };
  } catch {
    removeCachedPlaceId(place.id);
    return null;
  }
}

async function resolveOnePlace(
  place: Place,
  PlaceConstructor: GooglePlaceConstructor,
): Promise<ResolvedGooglePlace | UnmatchedGooglePlace> {
  const cachedPlaceId = readCachedPlaceId(place);

  if (cachedPlaceId) {
    const cachedResult = await resolveCachedPlace(place, cachedPlaceId, PlaceConstructor);
    if (cachedResult) return cachedResult;
  }

  const query = [place.name, place.address, place.location]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(', ');

  if (!query) {
    return { place, reason: 'missing-location' };
  }

  try {
    const { places: candidates } = await PlaceConstructor.searchByText({
      textQuery: query,
      fields: ['id', 'displayName', 'formattedAddress', 'location'],
      maxResultCount: 5,
      language: 'en',
    });

    const rankedCandidates = candidates
      .map((candidate) => ({ candidate, score: getCandidateScore(place, candidate) }))
      .sort((first, second) => second.score - first.score);

    const bestMatch = rankedCandidates[0];
    if (!bestMatch || !isConfidentCandidate(place, bestMatch.candidate, bestMatch.score)) {
      return { place, reason: 'no-confident-match' };
    }

    const secondMatch = rankedCandidates[1];
    if (
      secondMatch &&
      isConfidentCandidate(place, secondMatch.candidate, secondMatch.score) &&
      secondMatch.score >= bestMatch.score - 0.75
    ) {
      return { place, reason: 'no-confident-match' };
    }

    const googlePlaceId = bestMatch.candidate.id;
    const location = bestMatch.candidate.location;

    if (!googlePlaceId || !location) {
      return { place, reason: 'no-confident-match' };
    }

    cachePlaceId(place, googlePlaceId);

    return {
      place,
      googlePlaceId,
      location,
      formattedAddress: bestMatch.candidate.formattedAddress ?? null,
    };
  } catch {
    return { place, reason: 'lookup-failed' };
  }
}

function isResolvedPlace(
  result: ResolvedGooglePlace | UnmatchedGooglePlace,
): result is ResolvedGooglePlace {
  return 'googlePlaceId' in result;
}

/**
 * Resolves saved places with a small worker pool so opening a large filtered
 * result set does not burst every Places lookup at exactly the same moment.
 */
export async function resolveSavedPlaces(
  places: Place[],
  PlaceConstructor: GooglePlaceConstructor,
): Promise<GooglePlaceResolution> {
  const results = new Array<ResolvedGooglePlace | UnmatchedGooglePlace>(places.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < places.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await resolveOnePlace(places[currentIndex], PlaceConstructor);
    }
  }

  const workerCount = Math.min(MAX_CONCURRENT_LOOKUPS, Math.max(places.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    resolved: results.filter(isResolvedPlace),
    unmatched: results.filter((result): result is UnmatchedGooglePlace => !isResolvedPlace(result)),
  };
}

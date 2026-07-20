import type { Place } from '../types/place';

/**
 * Adds an HTTPS protocol when a person enters a normal domain without one.
 */
export function normalizeExternalUrl(value: string): string | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `https://${trimmedValue}`;

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(candidate);
  } catch {
    throw new Error('Enter a valid website address.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only regular HTTP or HTTPS links are supported.');
  }

  return parsedUrl.toString();
}

/**
 * Accepts common Google Maps share-link formats, including maps.app.goo.gl.
 */
export function normalizeGoogleMapsUrl(value: string): string | null {
  const normalizedUrl = normalizeExternalUrl(value);
  if (!normalizedUrl) return null;

  const parsedUrl = new URL(normalizedUrl);
  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();

  const isMapsShortLink =
    hostname === 'maps.app.goo.gl' ||
    (hostname === 'goo.gl' && pathname.startsWith('/maps'));

  const isGoogleMapsHost =
    hostname === 'maps.google.com' ||
    (/^(?:www\.)?google\.[a-z.]+$/i.test(hostname) && pathname.startsWith('/maps'));

  if (!isMapsShortLink && !isGoogleMapsHost) {
    throw new Error('Paste a Google Maps share link, such as maps.app.goo.gl or google.com/maps.');
  }

  return normalizedUrl;
}

/**
 * Opens the exact saved Maps URL when present. Otherwise it builds a free
 * Google Maps search from the place name and address—no Maps API key needed.
 */
export function getGoogleMapsUrl(place: Pick<Place, 'name' | 'address' | 'maps_url'>): string {
  if (place.maps_url) return place.maps_url;

  const query = [place.name, place.address].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

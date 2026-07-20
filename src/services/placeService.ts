import { normalizeExternalUrl, normalizeGoogleMapsUrl } from '../lib/placeLinks';
import { supabase } from '../lib/supabase';
import type { Place, PlaceValues } from '../types/place';

interface CreatePlaceOptions {
  coupleId: string;
  currentUserId: string;
  values: PlaceValues;
}

interface UpdatePlaceOptions {
  coupleId: string;
  placeId: string;
  values: PlaceValues;
}

const placeColumns =
  'id, couple_id, created_by, name, category, address, website_url, maps_url, notes, visited, is_favorite, created_at, updated_at';

/**
 * Converts unknown Supabase errors into stable application errors.
 */
function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallbackMessage);
}

/**
 * Builds the database payload in one place so create and edit stay consistent.
 */
function buildPlacePayload(values: PlaceValues) {
  return {
    name: values.name.trim(),
    category: values.category,
    address: values.address.trim() || null,
    website_url: normalizeExternalUrl(values.websiteUrl),
    maps_url: normalizeGoogleMapsUrl(values.mapsUrl),
    notes: values.notes.trim() || null,
    visited: values.visited,
    is_favorite: values.isFavorite,
  };
}

/**
 * Loads every saved place available to the couple through RLS.
 */
export async function listPlaces(coupleId: string): Promise<Place[]> {
  const result = await supabase
    .from('places')
    .select(placeColumns)
    .eq('couple_id', coupleId)
    .order('is_favorite', { ascending: false })
    .order('visited', { ascending: true })
    .order('updated_at', { ascending: false })
    .returns<Place[]>();

  if (result.error) {
    throw toError(result.error, 'Unable to load your saved places.');
  }

  return result.data;
}

/**
 * Creates a shared place for the authenticated member.
 */
export async function createPlace({
  coupleId,
  currentUserId,
  values,
}: CreatePlaceOptions): Promise<Place> {
  const result = await supabase
    .from('places')
    .insert({
      couple_id: coupleId,
      created_by: currentUserId,
      ...buildPlacePayload(values),
    })
    .select(placeColumns)
    .single<Place>();

  if (result.error) {
    throw toError(result.error, 'Unable to save this place.');
  }

  return result.data;
}

/**
 * Updates only editable place fields and confirms couple ownership in the query.
 */
export async function updatePlace({
  coupleId,
  placeId,
  values,
}: UpdatePlaceOptions): Promise<Place> {
  const result = await supabase
    .from('places')
    .update(buildPlacePayload(values))
    .eq('id', placeId)
    .eq('couple_id', coupleId)
    .select(placeColumns)
    .single<Place>();

  if (result.error) {
    throw toError(result.error, 'Unable to update this place.');
  }

  return result.data;
}

/**
 * Applies a small partial change from the card controls.
 */
export async function patchPlace(
  coupleId: string,
  placeId: string,
  patch: Partial<Pick<Place, 'is_favorite' | 'visited'>>,
): Promise<Place> {
  const result = await supabase
    .from('places')
    .update(patch)
    .eq('id', placeId)
    .eq('couple_id', coupleId)
    .select(placeColumns)
    .single<Place>();

  if (result.error) {
    throw toError(result.error, 'Unable to update this place.');
  }

  return result.data;
}

/**
 * Permanently removes a place from the shared library.
 */
export async function deletePlace(coupleId: string, placeId: string): Promise<void> {
  const result = await supabase
    .from('places')
    .delete()
    .eq('id', placeId)
    .eq('couple_id', coupleId);

  if (result.error) {
    throw toError(result.error, 'Unable to delete this place.');
  }
}

/**
 * Shared database and form types for the saved-places feature.
 */
export type PlaceCategory = 'food' | 'coffee' | 'drinks' | 'dessert' | 'recreation';

export interface Place {
  id: string;
  couple_id: string;
  created_by: string;
  name: string;
  category: PlaceCategory;
  address: string | null;
  website_url: string | null;
  maps_url: string | null;
  notes: string | null;
  visited: boolean;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaceValues {
  name: string;
  category: PlaceCategory;
  address: string;
  websiteUrl: string;
  mapsUrl: string;
  notes: string;
  visited: boolean;
  isFavorite: boolean;
}

export type PlaceFilter =
  | 'all'
  | PlaceCategory
  | 'favorites'
  | 'want-to-go'
  | 'visited';

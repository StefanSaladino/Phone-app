/**
 * A shared recipe saved by either partner.
 */
export interface Recipe {
  id: string;
  couple_id: string;
  name: string;
  date_tried: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface RecipeValues {
  name: string;
  dateTried: string;
}
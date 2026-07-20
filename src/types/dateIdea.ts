/**
 * Shared database and form types for the date-ideas feature.
 */
export type DateIdeaStatus = 'idea' | 'planned' | 'done';

export interface DateIdea {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: DateIdeaStatus;
  planned_for: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface DateIdeaValues {
  title: string;
  description: string;
  status: DateIdeaStatus;
  plannedFor: string;
  isFavorite: boolean;
}

export type DateIdeaFilter = 'all' | 'idea' | 'planned' | 'done' | 'favorites';

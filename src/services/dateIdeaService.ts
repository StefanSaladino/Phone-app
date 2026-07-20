import { supabase } from '../lib/supabase';
import type { DateIdea, DateIdeaValues } from '../types/dateIdea';

interface CreateDateIdeaOptions {
  coupleId: string;
  currentUserId: string;
  values: DateIdeaValues;
}

interface UpdateDateIdeaOptions {
  coupleId: string;
  ideaId: string;
  values: DateIdeaValues;
}

/**
 * Converts unknown Supabase errors into stable application errors.
 */
function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallbackMessage);
}

/**
 * Converts the local date/time control value into a database timestamp.
 */
function toDatabaseTimestamp(value: string): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('The planned date is invalid.');
  }

  return date.toISOString();
}

/**
 * Loads every date idea available to the current couple through RLS.
 */
export async function listDateIdeas(coupleId: string): Promise<DateIdea[]> {
  const result = await supabase
    .from('date_ideas')
    .select(
      'id, couple_id, created_by, title, description, status, planned_for, is_favorite, created_at, updated_at',
    )
    .eq('couple_id', coupleId)
    .order('is_favorite', { ascending: false })
    .order('planned_for', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .returns<DateIdea[]>();

  if (result.error) {
    throw toError(result.error, 'Unable to load your date ideas.');
  }

  return result.data;
}

/**
 * Creates a shared date idea for the authenticated member.
 */
export async function createDateIdea({
  coupleId,
  currentUserId,
  values,
}: CreateDateIdeaOptions): Promise<DateIdea> {
  const result = await supabase
    .from('date_ideas')
    .insert({
      couple_id: coupleId,
      created_by: currentUserId,
      title: values.title.trim(),
      description: values.description.trim() || null,
      status: values.status,
      planned_for:
        values.status === 'planned' ? toDatabaseTimestamp(values.plannedFor) : null,
      is_favorite: values.isFavorite,
    })
    .select(
      'id, couple_id, created_by, title, description, status, planned_for, is_favorite, created_at, updated_at',
    )
    .single<DateIdea>();

  if (result.error) {
    throw toError(result.error, 'Unable to add this date idea.');
  }

  return result.data;
}

/**
 * Updates only editable date-idea fields and confirms couple ownership in the query.
 */
export async function updateDateIdea({
  coupleId,
  ideaId,
  values,
}: UpdateDateIdeaOptions): Promise<DateIdea> {
  const result = await supabase
    .from('date_ideas')
    .update({
      title: values.title.trim(),
      description: values.description.trim() || null,
      status: values.status,
      planned_for:
        values.status === 'planned' ? toDatabaseTimestamp(values.plannedFor) : null,
      is_favorite: values.isFavorite,
    })
    .eq('id', ideaId)
    .eq('couple_id', coupleId)
    .select(
      'id, couple_id, created_by, title, description, status, planned_for, is_favorite, created_at, updated_at',
    )
    .single<DateIdea>();

  if (result.error) {
    throw toError(result.error, 'Unable to update this date idea.');
  }

  return result.data;
}

/**
 * Applies a small partial change, used by quick card actions.
 */
export async function patchDateIdea(
  coupleId: string,
  ideaId: string,
  patch: Partial<Pick<DateIdea, 'is_favorite' | 'status' | 'planned_for'>>,
): Promise<DateIdea> {
  const result = await supabase
    .from('date_ideas')
    .update(patch)
    .eq('id', ideaId)
    .eq('couple_id', coupleId)
    .select(
      'id, couple_id, created_by, title, description, status, planned_for, is_favorite, created_at, updated_at',
    )
    .single<DateIdea>();

  if (result.error) {
    throw toError(result.error, 'Unable to update this date idea.');
  }

  return result.data;
}

/**
 * Permanently removes a date idea from the shared list.
 */
export async function deleteDateIdea(coupleId: string, ideaId: string): Promise<void> {
  const result = await supabase
    .from('date_ideas')
    .delete()
    .eq('id', ideaId)
    .eq('couple_id', coupleId);

  if (result.error) {
    throw toError(result.error, 'Unable to delete this date idea.');
  }
}

import { supabase } from '../lib/supabase';
import type { Note, NoteValues } from '../types/note';

interface CreateNoteOptions {
  coupleId: string;
  currentUserId: string;
  partnerUserId: string;
  values: NoteValues;
}

const noteSelection =
  'id, couple_id, author_id, recipient_id, message, delivery_mode, seen_at, dismissed_at, created_at';

/** Converts unknown Supabase errors into stable application errors. */
function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallbackMessage);
}

/** Loads notes visible to the signed-in participant through Row Level Security. */
export async function listNotes(coupleId: string): Promise<Note[]> {
  const result = await supabase
    .from('notes')
    .select(noteSelection)
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .returns<Note[]>();

  if (result.error) {
    throw toError(result.error, 'Unable to load your notes.');
  }

  return result.data;
}

/** Sends a normal inbox note or a private next-login surprise. */
export async function createNote({
  coupleId,
  currentUserId,
  partnerUserId,
  values,
}: CreateNoteOptions): Promise<Note> {
  const result = await supabase
    .from('notes')
    .insert({
      couple_id: coupleId,
      author_id: currentUserId,
      recipient_id: partnerUserId,
      message: values.message.trim(),
      delivery_mode: values.deliveryMode,
    })
    .select(noteSelection)
    .single<Note>();

  if (result.error) {
    throw toError(result.error, 'Unable to send this note.');
  }

  return result.data;
}

/**
 * Claims the oldest pending surprise using normal table access.
 * The recipient-only RLS policy and column-level grants allow only delivery
 * timestamps to be changed; note content and participants remain immutable.
 */
export async function claimNextLoginNote(
  coupleId: string,
  recipientId: string,
): Promise<Note | null> {
  const pendingResult = await supabase
    .from('notes')
    .select(noteSelection)
    .eq('couple_id', coupleId)
    .eq('recipient_id', recipientId)
    .eq('delivery_mode', 'next_login')
    .is('seen_at', null)
    .is('dismissed_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle<Note>();

  if (pendingResult.error) {
    throw toError(pendingResult.error, 'Unable to check for a surprise note.');
  }

  if (!pendingResult.data) return null;

  const seenAt = new Date().toISOString();
  const claimResult = await supabase
    .from('notes')
    .update({ seen_at: seenAt })
    .eq('id', pendingResult.data.id)
    .eq('recipient_id', recipientId)
    .is('seen_at', null)
    .select(noteSelection)
    .maybeSingle<Note>();

  if (claimResult.error) {
    throw toError(claimResult.error, 'Unable to open this surprise note.');
  }

  // Another tab may have claimed the same note first.
  return claimResult.data;
}

/** Marks a regular received note as read without changing its content. */
export async function markNoteSeen(noteId: string): Promise<Note> {
  const result = await supabase
    .from('notes')
    .update({ seen_at: new Date().toISOString() })
    .eq('id', noteId)
    .select(noteSelection)
    .single<Note>();

  if (result.error) {
    throw toError(result.error, 'Unable to mark this note as read.');
  }

  return result.data;
}

/** Records that the recipient closed a delivered note. */
export async function dismissNote(noteId: string): Promise<Note> {
  const now = new Date().toISOString();
  const result = await supabase
    .from('notes')
    .update({
      seen_at: now,
      dismissed_at: now,
    })
    .eq('id', noteId)
    .select(noteSelection)
    .single<Note>();

  if (result.error) {
    throw toError(result.error, 'Unable to dismiss this note.');
  }

  return result.data;
}

/** Permanently removes a participating note from the shared workspace. */
export async function deleteNote(coupleId: string, noteId: string): Promise<void> {
  const result = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)
    .eq('couple_id', coupleId);

  if (result.error) {
    throw toError(result.error, 'Unable to delete this note.');
  }
}

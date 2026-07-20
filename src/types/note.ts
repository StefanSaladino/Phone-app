/** Delivery choices for a note sent to the linked partner. */
export type NoteDeliveryMode = 'inbox' | 'next_login';

/** Database row returned from the public.notes table. */
export interface Note {
  id: string;
  couple_id: string;
  author_id: string;
  recipient_id: string;
  message: string;
  delivery_mode: NoteDeliveryMode;
  seen_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

/** Values collected by the new-note form. */
export interface NoteValues {
  message: string;
  deliveryMode: NoteDeliveryMode;
}

/** Main views available on the notes page. */
export type NoteFilter = 'received' | 'sent';

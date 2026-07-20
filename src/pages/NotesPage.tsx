import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeleteNoteDialog } from '../components/notes/DeleteNoteDialog';
import { NoteCard } from '../components/notes/NoteCard';
import { NoteForm } from '../components/notes/NoteForm';
import { AppIcon } from '../components/ui/AppIcon';
import { useCouple } from '../hooks/useCouple';
import {
  createNote,
  deleteNote,
  listNotes,
  markNoteSeen,
} from '../services/noteService';
import type { Note, NoteFilter, NoteValues } from '../types/note';

/** Shared note inbox, sent history, and next-login surprise composer. */
export function NotesPage() {
  const { workspace, refreshWorkspace } = useCouple();
  const [notes, setNotes] = useState<Note[]>([]);
  const [filter, setFilter] = useState<NoteFilter>('received');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSharedNotes = useCallback(async () => {
    if (!workspace) return;

    setLoading(true);
    setLoadError(null);

    try {
      const loadedNotes = await listNotes(workspace.couple.id);
      const unreadInboxNotes = loadedNotes.filter(
        (note) =>
          note.recipient_id === workspace.currentMember.user_id &&
          note.delivery_mode === 'inbox' &&
          !note.seen_at,
      );

      if (unreadInboxNotes.length === 0) {
        setNotes(loadedNotes);
        return;
      }

      const seenNotes = await Promise.all(
        unreadInboxNotes.map((note) => markNoteSeen(note.id)),
      );
      const seenById = new Map(seenNotes.map((note) => [note.id, note]));

      setNotes(
        loadedNotes.map((note) => seenById.get(note.id) ?? note),
      );
      void refreshWorkspace();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load your notes.');
    } finally {
      setLoading(false);
    }
  }, [refreshWorkspace, workspace]);

  useEffect(() => {
    void loadSharedNotes();
  }, [loadSharedNotes]);

  const receivedNotes = useMemo(
    () =>
      notes.filter(
        (note) =>
          note.recipient_id === workspace?.currentMember.user_id &&
          // Pending surprises stay out of the regular inbox until delivered.
          (note.delivery_mode === 'inbox' || note.seen_at !== null),
      ),
    [notes, workspace],
  );

  const sentNotes = useMemo(
    () => notes.filter((note) => note.author_id === workspace?.currentMember.user_id),
    [notes, workspace],
  );

  const visibleNotes = filter === 'received' ? receivedNotes : sentNotes;

  const saveNote = async (values: NoteValues) => {
    if (!workspace) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const createdNote = await createNote({
        coupleId: workspace.couple.id,
        currentUserId: workspace.currentMember.user_id,
        partnerUserId: workspace.partnerMember.user_id,
        values,
      });

      setNotes((current) => [createdNote, ...current]);
      setFilter('sent');
      setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to send this note.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!workspace || !noteToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteNote(workspace.couple.id, noteToDelete.id);
      setNotes((current) => current.filter((note) => note.id !== noteToDelete.id));
      setNoteToDelete(null);
      void refreshWorkspace();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this note.');
    } finally {
      setDeleting(false);
    }
  };

  if (!workspace) return null;

  const partnerFirstName = workspace.partnerMember.profile.first_name;

  return (
    <div className="page-stack">
      <section className="page-toolbar">
        <div>
          <p className="section-heading__eyebrow">Just because</p>
          <h2>Leave something little</h2>
        </div>
        <button
          className="compact-button"
          type="button"
          onClick={() => {
            setFormError(null);
            setFormOpen(true);
          }}
        >
          <AppIcon name="plus" size={18} />
          New note
        </button>
      </section>

      <section className="info-card">
        <span aria-hidden="true">♥</span>
        <div>
          <h3>Make it a surprise</h3>
          <p>
            A note can stay in the inbox or appear as a post-it the next time {partnerFirstName} opens the app.
          </p>
        </div>
      </section>

      <div className="notes-tabs" role="tablist" aria-label="Note views">
        <button
          className={filter === 'received' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={filter === 'received'}
          onClick={() => setFilter('received')}
        >
          Received <span>{receivedNotes.length}</span>
        </button>
        <button
          className={filter === 'sent' ? 'is-active' : ''}
          type="button"
          role="tab"
          aria-selected={filter === 'sent'}
          onClick={() => setFilter('sent')}
        >
          Sent <span>{sentNotes.length}</span>
        </button>
      </div>

      {loadError ? (
        <section className="inline-error" role="alert">
          <div>
            <strong>Something went wrong</strong>
            <p>{loadError}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadSharedNotes()}>
            Try again
          </button>
        </section>
      ) : null}

      {loading ? (
        <section className="empty-state empty-state--compact" aria-live="polite">
          <span className="empty-state__mark" aria-hidden="true">♥</span>
          <h3>Loading your notes…</h3>
        </section>
      ) : visibleNotes.length > 0 ? (
        <section className="note-grid" aria-label={`${filter} notes`}>
          {visibleNotes.map((note) => (
            <NoteCard
              note={note}
              direction={filter}
              personFirstName={partnerFirstName}
              key={note.id}
              onDelete={(selectedNote) => {
                setDeleteError(null);
                setNoteToDelete(selectedNote);
              }}
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">♥</span>
          <h3>{filter === 'received' ? 'No notes received yet' : 'Nothing sent yet'}</h3>
          <p>
            {filter === 'received'
              ? `When ${partnerFirstName} leaves something for you, it will live here.`
              : 'The first one can be sweet, practical, or completely ridiculous.'}
          </p>
          {filter === 'sent' ? (
            <button
              className="primary-button empty-state__button"
              type="button"
              onClick={() => setFormOpen(true)}
            >
              <AppIcon name="plus" size={18} />
              Send your first note
            </button>
          ) : null}
        </section>
      )}

      {formOpen ? (
        <NoteForm
          partnerFirstName={partnerFirstName}
          submitting={submitting}
          serverError={formError}
          onCancel={() => {
            if (submitting) return;
            setFormOpen(false);
            setFormError(null);
          }}
          onSubmit={saveNote}
        />
      ) : null}

      {noteToDelete ? (
        <DeleteNoteDialog
          note={noteToDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (deleting) return;
            setNoteToDelete(null);
            setDeleteError(null);
          }}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}

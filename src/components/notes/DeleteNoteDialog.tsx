import type { Note } from '../../types/note';

interface DeleteNoteDialogProps {
  note: Note;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/** Touch-friendly confirmation before permanently removing a note. */
export function DeleteNoteDialog({
  note,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteNoteDialogProps) {
  const preview = note.message.length > 70 ? `${note.message.slice(0, 70)}…` : note.message;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-note-title"
        aria-describedby="delete-note-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="section-heading__eyebrow">Remove note</p>
        <h2 id="delete-note-title">Delete this note?</h2>
        <p id="delete-note-description">“{preview}”</p>
        <p>This removes it for both of you and cannot be undone.</p>

        {error ? (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="confirm-dialog__actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={deleting}>
            Keep it
          </button>
          <button className="danger-button" type="button" onClick={() => void onConfirm()} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete note'}
          </button>
        </div>
      </section>
    </div>
  );
}

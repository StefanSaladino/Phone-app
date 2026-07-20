import type { DateIdea } from '../../types/dateIdea';

interface DeleteDateIdeaDialogProps {
  idea: DateIdea;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * Explicit confirmation prevents accidental deletion on a small touch screen.
 */
export function DeleteDateIdeaDialog({
  idea,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeleteDateIdeaDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-idea-title"
        aria-describedby="delete-idea-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="section-heading__eyebrow">Remove idea</p>
        <h2 id="delete-idea-title">Delete “{idea.title}”?</h2>
        <p id="delete-idea-description">
          This removes it from the shared list for both of you. This action cannot be undone.
        </p>

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
            {deleting ? 'Deleting…' : 'Delete idea'}
          </button>
        </div>
      </section>
    </div>
  );
}

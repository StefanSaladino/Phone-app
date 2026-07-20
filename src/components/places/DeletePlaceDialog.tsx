import type { Place } from '../../types/place';

interface DeletePlaceDialogProps {
  place: Place;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

/**
 * Explicit confirmation prevents accidental deletion on a touch screen.
 */
export function DeletePlaceDialog({
  place,
  deleting,
  error,
  onCancel,
  onConfirm,
}: DeletePlaceDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-place-title"
        aria-describedby="delete-place-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="section-heading__eyebrow">Remove place</p>
        <h2 id="delete-place-title">Delete “{place.name}”?</h2>
        <p id="delete-place-description">
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
            {deleting ? 'Deleting…' : 'Delete place'}
          </button>
        </div>
      </section>
    </div>
  );
}

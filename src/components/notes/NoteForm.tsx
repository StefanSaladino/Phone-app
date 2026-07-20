import { useEffect, useState } from 'react';
import type { NoteDeliveryMode, NoteValues } from '../../types/note';
import { AppIcon } from '../ui/AppIcon';

interface NoteFormProps {
  partnerFirstName: string;
  submitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (values: NoteValues) => Promise<void>;
}

const emptyValues: NoteValues = {
  message: '',
  deliveryMode: 'inbox',
};

/** Composer for a normal inbox note or an app-opening/live surprise. */
export function NoteForm({
  partnerFirstName,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: NoteFormProps) {
  const [values, setValues] = useState<NoteValues>(emptyValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValues(emptyValues);
    setValidationError(null);
  }, []);

  const updateDeliveryMode = (deliveryMode: NoteDeliveryMode) => {
    setValues((current) => ({ ...current, deliveryMode }));
  };

  const submitForm = async () => {
    const message = values.message.trim();

    if (!message) {
      setValidationError('Write a little something first.');
      return;
    }

    if (message.length > 1000) {
      setValidationError('Keep the note to 1,000 characters or fewer.');
      return;
    }

    setValidationError(null);
    await onSubmit({ ...values, message });
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="idea-form-card note-form-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="idea-form-card__header">
          <div>
            <p className="section-heading__eyebrow">For {partnerFirstName}</p>
            <h2 id="note-form-title">Leave a little note</h2>
          </div>

          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close form">
            <AppIcon name="close" size={19} />
          </button>
        </header>

        <div className="form-stack">
          <label className="field-group">
            <span>Message</span>
            <textarea
              autoFocus
              rows={7}
              maxLength={1000}
              value={values.message}
              placeholder="Something sweet, practical, or completely ridiculous…"
              onChange={(event) =>
                setValues((current) => ({ ...current, message: event.target.value }))
              }
            />
            <small>{values.message.length}/1000</small>
          </label>

          <fieldset className="field-group field-group--fieldset">
            <legend>How should it arrive?</legend>
            <div className="note-delivery-options">
              <button
                className={values.deliveryMode === 'inbox' ? 'is-active' : ''}
                type="button"
                aria-pressed={values.deliveryMode === 'inbox'}
                onClick={() => updateDeliveryMode('inbox')}
              >
                <AppIcon name="mail" size={20} />
                <span>
                  <strong>Inbox note</strong>
                  <small>Available on the Notes page.</small>
                </span>
              </button>

              <button
                className={values.deliveryMode === 'next_login' ? 'is-active' : ''}
                type="button"
                aria-pressed={values.deliveryMode === 'next_login'}
                onClick={() => updateDeliveryMode('next_login')}
              >
                <AppIcon name="sparkle" size={20} />
                <span>
                  <strong>Surprise popup</strong>
                  <small>Appears now if {partnerFirstName} is using Together, or the next time the app opens.</small>
                </span>
              </button>
            </div>
          </fieldset>

          {validationError || serverError ? (
            <p className="form-message form-message--error" role="alert">
              {validationError ?? serverError}
            </p>
          ) : null}
        </div>

        <footer className="idea-form-card__actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={() => void submitForm()} disabled={submitting}>
            <AppIcon name="send" size={18} />
            {submitting ? 'Sending…' : 'Send note'}
          </button>
        </footer>
      </section>
    </div>
  );
}

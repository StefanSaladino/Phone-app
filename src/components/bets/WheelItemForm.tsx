import { useEffect, useState } from 'react';
import type { WheelItemType, WheelItemValues } from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';

interface WheelItemFormProps {
  partnerFirstName: string;
  submitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (values: WheelItemValues) => Promise<void>;
}

const emptyValues: WheelItemValues = {
  itemType: 'prize',
  title: '',
  description: '',
};

/** Form for a private self-prize or private punishment for the partner. */
export function WheelItemForm({
  partnerFirstName,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: WheelItemFormProps) {
  const [values, setValues] = useState<WheelItemValues>(emptyValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValues(emptyValues);
    setValidationError(null);
  }, []);

  const setItemType = (itemType: WheelItemType) => {
    setValues((current) => ({ ...current, itemType }));
  };

  const submitForm = async () => {
    const title = values.title.trim();

    if (!title) {
      setValidationError('Give this wheel option a title.');
      return;
    }

    if (title.length > 120) {
      setValidationError('Keep the title to 120 characters or fewer.');
      return;
    }

    setValidationError(null);
    await onSubmit({ ...values, title });
  };

  return (
    <div
      className="modal-backdrop bets-modal-backdrop"
      role="presentation"
      onMouseDown={onCancel}
    >
      <section
        className="idea-form-card bet-form-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wheel-item-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="idea-form-card__header">
          <div>
            <p className="section-heading__eyebrow">Your private wheels</p>
            <h2 id="wheel-item-form-title">Add a secret option</h2>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onCancel}
            aria-label="Close form"
          >
            <AppIcon name="close" size={19} />
          </button>
        </header>

        <div className="form-stack">
          <fieldset className="field-group field-group--fieldset">
            <legend>What are you adding?</legend>
            <div className="wheel-type-options">
              <button
                className={values.itemType === 'prize' ? 'is-active' : ''}
                type="button"
                aria-pressed={values.itemType === 'prize'}
                onClick={() => setItemType('prize')}
              >
                <AppIcon name="trophy" size={21} />
                <span>
                  <strong>Prize for me</strong>
                  <small>You could receive this if you win.</small>
                </span>
              </button>

              <button
                className={values.itemType === 'punishment' ? 'is-active' : ''}
                type="button"
                aria-pressed={values.itemType === 'punishment'}
                onClick={() => setItemType('punishment')}
              >
                <AppIcon name="bets" size={21} />
                <span>
                  <strong>Punishment for {partnerFirstName}</strong>
                  <small>This could be revealed if {partnerFirstName} loses.</small>
                </span>
              </button>
            </div>
          </fieldset>

          <label className="field-group">
            <span>Option</span>
            <input
              type="text"
              maxLength={120}
              value={values.title}
              placeholder={
                values.itemType === 'prize'
                  ? 'Choose our next restaurant'
                  : `${partnerFirstName} handles dishes for three days`
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>

          <label className="field-group">
            <span>
              Details <small>optional</small>
            </span>
            <textarea
              rows={3}
              maxLength={600}
              value={values.description}
              placeholder="Add any limits or details so the revealed result is clear."
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>

          <p className="wheel-rule-callout wheel-rule-callout--private">
            <AppIcon name="lock" size={17} />
            <span>
              Only you can see this option. Your partner sees it only if the
              settlement wheel selects it. Any revealed result remains playful and voluntary.
            </span>
          </p>

          {validationError || serverError ? (
            <p className="form-message form-message--error" role="alert">
              {validationError ?? serverError}
            </p>
          ) : null}
        </div>

        <footer className="idea-form-card__actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => void submitForm()}
            disabled={submitting}
          >
            {submitting ? 'Adding…' : 'Add secretly'}
          </button>
        </footer>
      </section>
    </div>
  );
}

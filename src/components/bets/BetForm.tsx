import { useEffect, useState } from 'react';
import type { BetValues } from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';

interface BetFormProps {
  currentFirstName: string;
  partnerFirstName: string;
  submitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (values: BetValues) => Promise<void>;
}

const emptyValues: BetValues = {
  title: '',
  description: '',
  creatorPrediction: '',
  opponentPrediction: '',
  settlementCondition: '',
  settlementDueAt: '',
};

/** Creates a bet invitation whose terms lock after the partner accepts it. */
export function BetForm({
  currentFirstName,
  partnerFirstName,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: BetFormProps) {
  const [values, setValues] = useState<BetValues>(emptyValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setValues(emptyValues);
    setValidationError(null);
  }, []);

  const submitForm = async () => {
    const normalized = {
      ...values,
      title: values.title.trim(),
      creatorPrediction: values.creatorPrediction.trim(),
      opponentPrediction: values.opponentPrediction.trim(),
      settlementCondition: values.settlementCondition.trim(),
    };

    if (!normalized.title) {
      setValidationError('Give the bet a clear title.');
      return;
    }

    if (!normalized.creatorPrediction || !normalized.opponentPrediction) {
      setValidationError('Add both predictions before sending the bet.');
      return;
    }

    if (!normalized.settlementCondition) {
      setValidationError('Explain how you will know when the bet is settled.');
      return;
    }

    setValidationError(null);
    await onSubmit(normalized);
  };

  return (
    <div className="modal-backdrop bets-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="idea-form-card bet-form-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bet-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="idea-form-card__header">
          <div>
            <p className="section-heading__eyebrow">Friendly competition</p>
            <h2 id="bet-form-title">Propose a bet</h2>
          </div>

          <button className="icon-button" type="button" onClick={onCancel} aria-label="Close form">
            <AppIcon name="close" size={19} />
          </button>
        </header>

        <div className="form-stack">
          <label className="field-group">
            <span>Bet</span>
            <input
              type="text"
              maxLength={140}
              value={values.title}
              placeholder="Who will win the next game?"
              onChange={(event) =>
                setValues((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>

          <label className="field-group">
            <span>
              Terms <small>optional</small>
            </span>
            <textarea
              rows={3}
              maxLength={1200}
              value={values.description}
              placeholder="Add context or any rules worth locking in."
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>

          <div className="bet-prediction-grid">
            <label className="field-group">
              <span>{currentFirstName}&apos;s prediction</span>
              <input
                type="text"
                maxLength={240}
                value={values.creatorPrediction}
                placeholder="My prediction"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    creatorPrediction: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field-group">
              <span>{partnerFirstName}&apos;s prediction</span>
              <input
                type="text"
                maxLength={240}
                value={values.opponentPrediction}
                placeholder={`${partnerFirstName}'s prediction`}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    opponentPrediction: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <label className="field-group">
            <span>How will it be settled?</span>
            <textarea
              rows={3}
              maxLength={500}
              value={values.settlementCondition}
              placeholder="When the final score is official."
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  settlementCondition: event.target.value,
                }))
              }
            />
          </label>

          <label className="field-group">
            <span>
              Expected settlement date <small>optional</small>
            </span>
            <span className="date-input-shell">
              <input
                type="datetime-local"
                value={values.settlementDueAt}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    settlementDueAt: event.target.value,
                  }))
                }
              />
            </span>
          </label>

          <p className="wheel-rule-callout">
            Once {partnerFirstName} accepts, the wager and both private wheel pools are locked. Neither of you sees the other person&apos;s options before settlement. Any revealed result is playful and voluntary.
          </p>

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
            {submitting ? 'Sending…' : `Send to ${partnerFirstName}`}
          </button>
        </footer>
      </section>
    </div>
  );
}

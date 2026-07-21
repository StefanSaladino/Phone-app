import { useEffect, useState } from 'react';
import type { BetType, BetValues } from '../../types/bet';
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
  betType: 'standard',
  title: '',
  description: '',
  creatorPrediction: '',
  opponentPrediction: '',
  hiddenPrediction: '',
  settlementCondition: '',
  settlementDueAt: '',
};

/** Creates either a normal bet or a server-protected hidden-answer bet. */
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

  const selectBetType = (betType: BetType) => {
    setValues((current) => ({
      ...current,
      betType,
      creatorPrediction: '',
      opponentPrediction: '',
      hiddenPrediction: '',
    }));
    setValidationError(null);
  };

  const submitForm = async () => {
    const normalized: BetValues = {
      ...values,
      title: values.title.trim(),
      description: values.description.trim(),
      creatorPrediction: values.creatorPrediction.trim(),
      opponentPrediction: values.opponentPrediction.trim(),
      hiddenPrediction: values.hiddenPrediction.trim(),
      settlementCondition: values.settlementCondition.trim(),
    };

    if (!normalized.title) {
      setValidationError('Give the bet a clear title or question.');
      return;
    }

    if (
      normalized.betType === 'standard' &&
      (!normalized.creatorPrediction || !normalized.opponentPrediction)
    ) {
      setValidationError('Add both predictions before sending the bet.');
      return;
    }

    if (
      normalized.betType === 'hidden_answer' &&
      !normalized.hiddenPrediction
    ) {
      setValidationError('Enter the prediction that should remain hidden.');
      return;
    }

    if (!normalized.settlementCondition) {
      setValidationError('Explain when the answer or result should be entered.');
      return;
    }

    setValidationError(null);
    await onSubmit(normalized);
  };

  const isHiddenAnswer = values.betType === 'hidden_answer';

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
        aria-labelledby="bet-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="idea-form-card__header">
          <div>
            <p className="section-heading__eyebrow">Friendly competition</p>
            <h2 id="bet-form-title">Propose a bet</h2>
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
            <legend>Bet type</legend>
            <div className="bet-type-options">
              <button
                type="button"
                className={values.betType === 'standard' ? 'is-active' : ''}
                onClick={() => selectBetType('standard')}
              >
                <AppIcon name="bets" size={20} />
                <span>
                  <strong>Regular bet</strong>
                  <small>Both predictions are visible from the start.</small>
                </span>
              </button>

              <button
                type="button"
                className={isHiddenAnswer ? 'is-active' : ''}
                onClick={() => selectBetType('hidden_answer')}
              >
                <AppIcon name="lock" size={20} />
                <span>
                  <strong>Hidden answer</strong>
                  <small>
                    Your prediction stays secret until {partnerFirstName} enters
                    the real answer.
                  </small>
                </span>
              </button>
            </div>
          </fieldset>

          <label className="field-group">
            <span>{isHiddenAnswer ? 'Question' : 'Bet'}</span>
            <input
              type="text"
              maxLength={140}
              value={values.title}
              placeholder={
                isHiddenAnswer
                  ? `What will ${partnerFirstName} order for dinner?`
                  : 'Who will win the next game?'
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
              Terms <small>optional</small>
            </span>
            <textarea
              rows={3}
              maxLength={1200}
              value={values.description}
              placeholder={
                isHiddenAnswer
                  ? 'Add any context that can be visible before the answer is entered.'
                  : 'Add context or any rules worth locking in.'
              }
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>

          {isHiddenAnswer ? (
            <label className="field-group hidden-answer-secret-field">
              <span>{currentFirstName}&apos;s hidden prediction</span>
              <input
                type="text"
                maxLength={240}
                autoComplete="off"
                value={values.hiddenPrediction}
                placeholder="Filet mignon"
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    hiddenPrediction: event.target.value,
                  }))
                }
              />
              <small>
                This value is stored separately and is never sent to
                {` ${partnerFirstName}`}&apos;s device until they submit the real
                answer.
              </small>
            </label>
          ) : (
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
          )}

          <label className="field-group">
            <span>
              {isHiddenAnswer
                ? `When should ${partnerFirstName} enter the real answer?`
                : 'How will it be settled?'}
            </span>
            <textarea
              rows={3}
              maxLength={500}
              value={values.settlementCondition}
              placeholder={
                isHiddenAnswer
                  ? 'After the order has been placed, enter exactly what was ordered.'
                  : 'When the final score is official.'
              }
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

          <p className="wheel-rule-callout wheel-rule-callout--private">
            <AppIcon name="lock" size={18} />
            <span>
              {isHiddenAnswer
                ? `${partnerFirstName} can review and accept the wager without seeing your prediction. Once they submit the real answer, both values are revealed and the suggested winner still requires mutual confirmation.`
                : `Once ${partnerFirstName} accepts, the wager and both private wheel pools are locked. Neither of you sees the other person’s wheel options before settlement.`}{' '}
              Any revealed result is playful and voluntary.
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
            {submitting ? 'Sending…' : `Send to ${partnerFirstName}`}
          </button>
        </footer>
      </section>
    </div>
  );
}

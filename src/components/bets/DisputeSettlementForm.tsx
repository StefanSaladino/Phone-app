import { useState } from 'react';
import type { Bet } from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';

interface DisputeSettlementFormProps {
  bet: Bet;
  submitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

/** Records a disagreement without choosing a winner or spinning a wheel. */
export function DisputeSettlementForm({
  bet,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: DisputeSettlementFormProps) {
  const [reason, setReason] = useState('');

  return (
    <div
      className="modal-backdrop bets-modal-backdrop"
      role="presentation"
      onMouseDown={onCancel}
    >
      <section
        className="idea-form-card settlement-form-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispute-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="idea-form-card__header">
          <div>
            <p className="section-heading__eyebrow">Pause settlement</p>
            <h2 id="dispute-form-title">Dispute this result</h2>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onCancel}
            aria-label="Close dispute form"
          >
            <AppIcon name="close" size={19} />
          </button>
        </header>

        <div className="form-stack">
          <div className="settlement-bet-summary">
            <strong>{bet.title}</strong>
            <span>The bet remains active until you both agree.</span>
          </div>

          <label className="field-group">
            <span>
              What needs another look? <small>optional</small>
            </span>
            <textarea
              rows={4}
              maxLength={600}
              value={reason}
              placeholder="Explain the disagreement without changing the locked wager."
              onChange={(event) => setReason(event.target.value)}
            />
          </label>

          {serverError ? (
            <p className="form-message form-message--error" role="alert">
              {serverError}
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
            Go back
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => void onSubmit(reason)}
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Mark as disputed'}
          </button>
        </footer>
      </section>
    </div>
  );
}

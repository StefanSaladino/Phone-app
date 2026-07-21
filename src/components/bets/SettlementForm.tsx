import { useEffect, useState } from 'react';
import type {
  Bet,
  BetSettlement,
  SettlementProposalValues,
} from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';

interface SettlementFormProps {
  bet: Bet;
  settlement: BetSettlement | null;
  currentUserId: string;
  currentFirstName: string;
  partnerFirstName: string;
  submitting: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (values: SettlementProposalValues) => Promise<void>;
}

/** Lets either partner propose a winner or a mutually agreed draw. */
export function SettlementForm({
  bet,
  settlement,
  currentUserId,
  currentFirstName,
  partnerFirstName,
  submitting,
  serverError,
  onCancel,
  onSubmit,
}: SettlementFormProps) {
  const [winnerUserId, setWinnerUserId] = useState<string | null>(
    settlement?.proposed_winner_id ?? null,
  );
  const [note, setNote] = useState(settlement?.proposal_note ?? '');

  useEffect(() => {
    setWinnerUserId(settlement?.proposed_winner_id ?? null);
    setNote(settlement?.proposal_note ?? '');
  }, [settlement]);

  const creatorName =
    bet.created_by === currentUserId ? currentFirstName : partnerFirstName;
  const opponentName =
    bet.opponent_id === currentUserId ? currentFirstName : partnerFirstName;

  const submitForm = async () => {
    await onSubmit({ winnerUserId, note });
  };

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
        aria-labelledby="settlement-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="idea-form-card__header">
          <div>
            <p className="section-heading__eyebrow">Settle together</p>
            <h2 id="settlement-form-title">Who won?</h2>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onCancel}
            aria-label="Close settlement form"
          >
            <AppIcon name="close" size={19} />
          </button>
        </header>

        <div className="form-stack">
          <div className="settlement-bet-summary">
            <strong>{bet.title}</strong>
            <span>{bet.settlement_condition}</span>
          </div>

          <fieldset className="field-group field-group--fieldset">
            <legend>Proposed result</legend>
            <div className="settlement-choice-grid">
              <button
                className={
                  winnerUserId === bet.created_by ? 'is-active' : ''
                }
                type="button"
                aria-pressed={winnerUserId === bet.created_by}
                onClick={() => setWinnerUserId(bet.created_by)}
              >
                <AppIcon name="trophy" size={21} />
                <span>
                  <strong>{creatorName} won</strong>
                  <small>{bet.creator_prediction}</small>
                </span>
              </button>

              <button
                className={
                  winnerUserId === bet.opponent_id ? 'is-active' : ''
                }
                type="button"
                aria-pressed={winnerUserId === bet.opponent_id}
                onClick={() => setWinnerUserId(bet.opponent_id)}
              >
                <AppIcon name="trophy" size={21} />
                <span>
                  <strong>{opponentName} won</strong>
                  <small>{bet.opponent_prediction}</small>
                </span>
              </button>

              <button
                className={winnerUserId === null ? 'is-active' : ''}
                type="button"
                aria-pressed={winnerUserId === null}
                onClick={() => setWinnerUserId(null)}
              >
                <AppIcon name="undo" size={21} />
                <span>
                  <strong>Call it a draw</strong>
                  <small>No coin flip or wheel result.</small>
                </span>
              </button>
            </div>
          </fieldset>

          <label className="field-group">
            <span>
              Note <small>optional</small>
            </span>
            <textarea
              rows={3}
              maxLength={600}
              value={note}
              placeholder="Add a short explanation of the result."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          <p className="wheel-rule-callout">
            Your proposal does not settle the bet by itself. The other person
            must confirm it. They can dispute it instead, and either of you can
            then propose a new result.
          </p>

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
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => void submitForm()}
            disabled={submitting}
          >
            {submitting ? 'Sending…' : `Ask ${partnerFirstName} to confirm`}
          </button>
        </footer>
      </section>
    </div>
  );
}

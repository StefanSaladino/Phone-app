import type {
  BetSettlement,
  RevealedBetOutcome,
} from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';

interface SettlementRevealModalProps {
  settlement: BetSettlement;
  currentUserId: string;
  winnerName: string;
  loserName: string;
  spinnerName: string;
  spinning: boolean;
  outcome: RevealedBetOutcome | null;
  onSpin: () => Promise<void>;
  onClose: () => void;
}

/**
 * Reveals the server-stored coin result first, then lets only the designated
 * person call the protected wheel reveal function.
 */
export function SettlementRevealModal({
  settlement,
  currentUserId,
  winnerName,
  loserName,
  spinnerName,
  spinning,
  outcome,
  onSpin,
  onClose,
}: SettlementRevealModalProps) {
  const consequence = settlement.consequence_type;
  const selectedTitle = outcome?.selected_title ?? settlement.selected_title;
  const selectedDescription =
    outcome?.selected_description ?? settlement.selected_description;
  const isSpinner = settlement.spinner_user_id === currentUserId;
  const hasResult = Boolean(selectedTitle);

  return (
    <div className="settlement-reveal-backdrop" role="presentation">
      <section
        className="settlement-reveal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-reveal-title"
      >
        <button
          className="icon-button settlement-reveal-card__close"
          type="button"
          onClick={onClose}
          disabled={spinning}
          aria-label="Close result"
        >
          <AppIcon name="close" size={19} />
        </button>

        <div className="settlement-reveal-card__heading">
          <p className="section-heading__eyebrow">The result is locked</p>
          <h2 id="settlement-reveal-title">
            {hasResult ? 'Wheel result' : 'Coin flip'}
          </h2>
        </div>

        <div
          className={`settlement-coin settlement-coin--${consequence ?? 'prize'}`}
          aria-label={consequence === 'punishment' ? 'Punishment' : 'Prize'}
        >
          <span aria-hidden="true">
            {consequence === 'punishment' ? 'P' : '★'}
          </span>
        </div>

        <div className="settlement-coin-copy">
          <strong>
            {consequence === 'punishment' ? 'Punishment' : 'Prize'}
          </strong>
          <p>
            {consequence === 'punishment'
              ? `${loserName} spins the private punishment wheel.`
              : `${winnerName} spins the private prize wheel.`}
          </p>
        </div>

        <div
          className={`settlement-wheel${spinning ? ' is-spinning' : ''}`}
          aria-hidden="true"
        >
          <span className="settlement-wheel__pointer" />
          <span className="settlement-wheel__hub">
            <AppIcon
              name={consequence === 'punishment' ? 'bets' : 'trophy'}
              size={24}
            />
          </span>
        </div>

        {hasResult ? (
          <div className="settlement-result-card" aria-live="polite">
            <span>
              {consequence === 'punishment' ? 'Punishment' : 'Prize'}
            </span>
            <h3>{selectedTitle}</h3>
            {selectedDescription ? <p>{selectedDescription}</p> : null}
            <small>
              This is a playful result. Neither person is obligated to do
              anything outside their comfort level.
            </small>
          </div>
        ) : isSpinner ? (
          <button
            className="primary-button settlement-spin-button"
            type="button"
            disabled={spinning}
            onClick={() => void onSpin()}
          >
            <AppIcon name="sparkle" size={19} />
            {spinning
              ? 'Spinning…'
              : `Spin ${consequence === 'punishment' ? 'punishment' : 'prize'} wheel`}
          </button>
        ) : (
          <div className="settlement-waiting-message" role="status">
            <AppIcon name="lock" size={19} />
            <p>Waiting for {spinnerName} to spin the wheel.</p>
          </div>
        )}

        {hasResult ? (
          <button
            className="secondary-button settlement-result-close"
            type="button"
            onClick={onClose}
          >
            Keep this result
          </button>
        ) : null}
      </section>
    </div>
  );
}

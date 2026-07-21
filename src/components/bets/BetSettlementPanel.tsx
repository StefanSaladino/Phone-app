import type { Bet, BetSettlement } from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';

interface BetSettlementPanelProps {
  bet: Bet;
  settlement: BetSettlement | null;
  currentUserId: string;
  memberName: (userId: string | null) => string;
  busy: boolean;
  onPropose: (bet: Bet) => void;
  onConfirm: (bet: Bet) => void;
  onDispute: (bet: Bet) => void;
  onOpenReveal: (bet: Bet) => void;
  onRequestCompletion: (bet: Bet) => void;
  onConfirmCompletion: (bet: Bet) => void;
  onWaive: (bet: Bet) => void;
}

/** Presents each mutual settlement state without exposing hidden wheel data. */
export function BetSettlementPanel({
  bet,
  settlement,
  currentUserId,
  memberName,
  busy,
  onPropose,
  onConfirm,
  onDispute,
  onOpenReveal,
  onRequestCompletion,
  onConfirmCompletion,
  onWaive,
}: BetSettlementPanelProps) {
  if (!settlement) {
    return (
      <section className="bet-settlement-panel">
        <div>
          <span className="bet-settlement-panel__eyebrow">Ready to settle?</span>
          <strong>Agree on the winner together.</strong>
          <p>
            One person proposes the result and the other confirms or disputes
            it before any coin or wheel result is created.
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={busy}
          onClick={() => onPropose(bet)}
        >
          <AppIcon name="trophy" size={18} />
          Propose result
        </button>
      </section>
    );
  }

  if (settlement.status === 'awaiting_confirmation') {
    const proposedResult = settlement.proposed_winner_id
      ? `${memberName(settlement.proposed_winner_id)} won`
      : 'Draw';
    const canRespond = settlement.proposed_by !== currentUserId;

    return (
      <section className="bet-settlement-panel bet-settlement-panel--pending">
        <div>
          <span className="bet-settlement-panel__eyebrow">
            Result proposed by {memberName(settlement.proposed_by)}
          </span>
          <strong>{proposedResult}</strong>
          {settlement.proposal_note ? <p>{settlement.proposal_note}</p> : null}
        </div>

        {canRespond ? (
          <div className="bet-settlement-panel__actions">
            <button
              className="secondary-button"
              type="button"
              disabled={busy}
              onClick={() => onDispute(bet)}
            >
              Dispute
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() => onConfirm(bet)}
            >
              <AppIcon name="check" size={17} />
              Confirm result
            </button>
          </div>
        ) : (
          <p className="bet-settlement-panel__waiting">
            Waiting for {memberName(
              settlement.proposed_by === bet.created_by
                ? bet.opponent_id
                : bet.created_by,
            )}{' '}
            to respond.
          </p>
        )}
      </section>
    );
  }

  if (settlement.status === 'disputed') {
    return (
      <section className="bet-settlement-panel bet-settlement-panel--disputed">
        <div>
          <span className="bet-settlement-panel__eyebrow">Result disputed</span>
          <strong>The bet remains active.</strong>
          <p>
            {settlement.response_note ??
              'Talk it over and propose another winner or a draw.'}
          </p>
        </div>
        <button
          className="primary-button"
          type="button"
          disabled={busy}
          onClick={() => onPropose(bet)}
        >
          Propose a new result
        </button>
      </section>
    );
  }

  if (settlement.status === 'draw') {
    return (
      <section className="bet-settlement-panel bet-settlement-panel--complete">
        <AppIcon name="undo" size={21} />
        <div>
          <span className="bet-settlement-panel__eyebrow">Settled as a draw</span>
          <strong>No prize or punishment was selected.</strong>
        </div>
      </section>
    );
  }

  if (settlement.status === 'ready_to_reveal') {
    const spinnerName = memberName(settlement.spinner_user_id);
    const isSpinner = settlement.spinner_user_id === currentUserId;

    return (
      <section className="bet-settlement-panel bet-settlement-panel--reveal">
        <div>
          <span className="bet-settlement-panel__eyebrow">Coin flip complete</span>
          <strong>
            {settlement.consequence_type === 'punishment'
              ? 'Punishment wheel'
              : 'Prize wheel'}
          </strong>
          <p>
            {isSpinner
              ? 'The private result is ready for you to spin.'
              : `Waiting for ${spinnerName} to spin the private wheel.`}
          </p>
        </div>
        <button
          className={isSpinner ? 'primary-button' : 'secondary-button'}
          type="button"
          disabled={busy}
          onClick={() => onOpenReveal(bet)}
        >
          <AppIcon name="sparkle" size={18} />
          {isSpinner ? 'Open and spin' : 'View coin result'}
        </button>
      </section>
    );
  }

  if (
    settlement.status === 'revealed' ||
    settlement.status === 'completion_requested'
  ) {
    const completionRequestedByCurrent =
      settlement.completion_requested_by === currentUserId;
    const canWaive = settlement.winner_user_id === currentUserId;

    return (
      <section className="bet-settlement-panel bet-settlement-panel--result">
        <div className="bet-settlement-result-copy">
          <span className="bet-settlement-panel__eyebrow">
            {settlement.consequence_type === 'punishment'
              ? 'Punishment revealed'
              : 'Prize revealed'}
          </span>
          <strong>{settlement.selected_title}</strong>
          {settlement.selected_description ? (
            <p>{settlement.selected_description}</p>
          ) : null}
        </div>

        <div className="bet-settlement-panel__actions">
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => onOpenReveal(bet)}
          >
            View result
          </button>

          {settlement.status === 'revealed' ? (
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() => onRequestCompletion(bet)}
            >
              Mark as done
            </button>
          ) : completionRequestedByCurrent ? (
            <span className="bet-settlement-panel__waiting">
              Waiting for partner confirmation.
            </span>
          ) : (
            <button
              className="primary-button"
              type="button"
              disabled={busy}
              onClick={() => onConfirmCompletion(bet)}
            >
              <AppIcon name="check" size={17} />
              Confirm complete
            </button>
          )}
        </div>

        {canWaive ? (
          <button
            className="text-button"
            type="button"
            disabled={busy}
            onClick={() => onWaive(bet)}
          >
            Waive this result
          </button>
        ) : null}
      </section>
    );
  }

  if (settlement.status === 'completed') {
    return (
      <section className="bet-settlement-panel bet-settlement-panel--complete">
        <AppIcon name="check" size={21} />
        <div>
          <span className="bet-settlement-panel__eyebrow">Completed together</span>
          <strong>{settlement.selected_title}</strong>
          <p>Both people confirmed that this playful result is complete.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bet-settlement-panel bet-settlement-panel--complete">
      <AppIcon name="heart" size={21} />
      <div>
        <span className="bet-settlement-panel__eyebrow">Outcome waived</span>
        <strong>{settlement.selected_title}</strong>
        <p>The winner chose to let this result go.</p>
      </div>
    </section>
  );
}

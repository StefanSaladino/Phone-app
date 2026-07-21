import type { Bet, BetSettlement, HiddenBetState } from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';
import { BetSettlementPanel } from './BetSettlementPanel';
import { HiddenAnswerPanel } from './HiddenAnswerPanel';

interface BetCardProps {
  bet: Bet;
  settlement: BetSettlement | null;
  hiddenState: HiddenBetState | null;
  currentUserId: string;
  creatorName: string;
  opponentName: string;
  busy: boolean;
  memberName: (userId: string | null) => string;
  onAccept: (bet: Bet) => void;
  onReject: (bet: Bet) => void;
  onCancel: (bet: Bet) => void;
  onSubmitHiddenAnswer: (bet: Bet, answer: string) => Promise<void>;
  onProposeSettlement: (bet: Bet) => void;
  onConfirmSettlement: (bet: Bet) => void;
  onDisputeSettlement: (bet: Bet) => void;
  onOpenReveal: (bet: Bet) => void;
  onRequestCompletion: (bet: Bet) => void;
  onConfirmCompletion: (bet: Bet) => void;
  onWaive: (bet: Bet) => void;
}

const statusLabels: Record<Bet['status'], string> = {
  pending: 'Awaiting agreement',
  active: 'Active',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  settled: 'Settled',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

/** Displays locked bet terms and either normal or hidden-answer gameplay. */
export function BetCard({
  bet,
  settlement,
  hiddenState,
  currentUserId,
  creatorName,
  opponentName,
  busy,
  memberName,
  onAccept,
  onReject,
  onCancel,
  onSubmitHiddenAnswer,
  onProposeSettlement,
  onConfirmSettlement,
  onDisputeSettlement,
  onOpenReveal,
  onRequestCompletion,
  onConfirmCompletion,
  onWaive,
}: BetCardProps) {
  const isCreator = bet.created_by === currentUserId;
  const canRespond = bet.status === 'pending' && !isCreator;
  const canCancel = bet.status === 'pending' && isCreator;
  const isHiddenAnswer = bet.bet_type === 'hidden_answer';
  const hiddenAnswerRevealed = hiddenState?.status === 'revealed';
  const canUseSettlement = !isHiddenAnswer || hiddenAnswerRevealed;

  return (
    <article
      className={`bet-card bet-card--${bet.status} ${
        isHiddenAnswer ? 'bet-card--hidden-answer' : ''
      }`}
    >
      <header className="bet-card__header">
        <div className="bet-card__badges">
          <span className={`bet-status bet-status--${bet.status}`}>
            {statusLabels[bet.status]}
          </span>
          {isHiddenAnswer ? (
            <span className="bet-type-badge bet-type-badge--hidden">
              <AppIcon name="lock" size={14} />
              Hidden answer
            </span>
          ) : null}
        </div>
        <span className="bet-card__created-by">Proposed by {creatorName}</span>
      </header>

      <div className="bet-card__body">
        <h3>{bet.title}</h3>
        {bet.description ? <p>{bet.description}</p> : null}
      </div>

      {isHiddenAnswer ? (
        <HiddenAnswerPanel
          bet={bet}
          hiddenState={hiddenState}
          currentUserId={currentUserId}
          creatorName={creatorName}
          opponentName={opponentName}
          busy={busy}
          onSubmitAnswer={onSubmitHiddenAnswer}
        />
      ) : (
        <section className="bet-predictions" aria-label="Predictions">
          <div>
            <span>{creatorName}</span>
            <strong>{bet.creator_prediction}</strong>
          </div>
          <div>
            <span>{opponentName}</span>
            <strong>{bet.opponent_prediction}</strong>
          </div>
        </section>
      )}

      <dl className="bet-terms">
        <div>
          <dt>{isHiddenAnswer ? 'Answer instructions' : 'Settlement condition'}</dt>
          <dd>{bet.settlement_condition}</dd>
        </div>
        {bet.settlement_due_at ? (
          <div>
            <dt>Expected by</dt>
            <dd>{formatDate(bet.settlement_due_at)}</dd>
          </div>
        ) : null}
      </dl>

      {bet.status === 'active' && !settlement && !isHiddenAnswer ? (
        <div className="bet-lock-summary">
          <AppIcon name="lock" size={18} />
          <span>
            The wager and both private wheel pools are locked. Agree on the
            result together before the server flips the coin.
          </span>
        </div>
      ) : null}

      {canUseSettlement &&
      (bet.status === 'active' || bet.status === 'settled') ? (
        <BetSettlementPanel
          bet={bet}
          settlement={settlement}
          currentUserId={currentUserId}
          memberName={memberName}
          busy={busy}
          onPropose={onProposeSettlement}
          onConfirm={onConfirmSettlement}
          onDispute={onDisputeSettlement}
          onOpenReveal={onOpenReveal}
          onRequestCompletion={onRequestCompletion}
          onConfirmCompletion={onConfirmCompletion}
          onWaive={onWaive}
        />
      ) : null}

      {canRespond ? (
        <footer className="bet-card__actions">
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={() => onReject(bet)}
          >
            Reject
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={() => onAccept(bet)}
          >
            <AppIcon name="check" size={17} />
            Accept bet
          </button>
        </footer>
      ) : null}

      {canCancel ? (
        <footer className="bet-card__actions bet-card__actions--quiet">
          <button
            className="text-button text-button--danger"
            type="button"
            disabled={busy}
            onClick={() => onCancel(bet)}
          >
            Cancel invitation
          </button>
        </footer>
      ) : null}
    </article>
  );
}

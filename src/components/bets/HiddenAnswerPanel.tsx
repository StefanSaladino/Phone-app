import { useState } from 'react';
import type { Bet, HiddenBetState } from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';

interface HiddenAnswerPanelProps {
  bet: Bet;
  hiddenState: HiddenBetState | null;
  currentUserId: string;
  creatorName: string;
  opponentName: string;
  busy: boolean;
  onSubmitAnswer: (bet: Bet, answer: string) => Promise<void>;
}

/**
 * Shows only privacy-safe hidden-answer state. Before reveal, the answerer
 * never receives the creator's secret value from Supabase.
 */
export function HiddenAnswerPanel({
  bet,
  hiddenState,
  currentUserId,
  creatorName,
  opponentName,
  busy,
  onSubmitAnswer,
}: HiddenAnswerPanelProps) {
  const [answer, setAnswer] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!hiddenState) {
    return (
      <section className="hidden-answer-panel hidden-answer-panel--locked">
        <AppIcon name="lock" size={20} />
        <div>
          <strong>Hidden prediction protected</strong>
          <p>The private answer is unavailable until the wager is accepted.</p>
        </div>
      </section>
    );
  }

  const isSecretOwner = hiddenState.secret_owner_id === currentUserId;
  const isAnswerer = hiddenState.answerer_user_id === currentUserId;
  const hasRevealed = hiddenState.status === 'revealed';

  if (hasRevealed) {
    return (
      <section className="hidden-answer-panel hidden-answer-panel--revealed">
        <header>
          <div>
            <span className="hidden-answer-panel__eyebrow">Answers revealed</span>
            <strong>
              {hiddenState.exact_match ? 'Exact text match' : 'Not an exact text match'}
            </strong>
          </div>
          <span
            className={`hidden-answer-match ${
              hiddenState.exact_match ? 'is-match' : 'is-different'
            }`}
          >
            <AppIcon
              name={hiddenState.exact_match ? 'check' : 'search'}
              size={16}
            />
            {hiddenState.exact_match ? 'Match' : 'Review together'}
          </span>
        </header>

        <div className="hidden-answer-comparison">
          <div>
            <span>{creatorName}&apos;s hidden prediction</span>
            <strong>{hiddenState.secret_answer}</strong>
          </div>
          <div>
            <span>{opponentName}&apos;s submitted answer</span>
            <strong>{hiddenState.submitted_answer}</strong>
          </div>
        </div>

        <p>
          The app suggested a winner using a trimmed, case-insensitive exact
          comparison. Similar wording can still be disputed and decided together.
        </p>
      </section>
    );
  }

  if (bet.status === 'pending') {
    return (
      <section className="hidden-answer-panel hidden-answer-panel--locked">
        <AppIcon name="lock" size={20} />
        <div>
          <strong>
            {isSecretOwner
              ? `Your hidden prediction: ${hiddenState.secret_answer ?? 'Locked'}`
              : `${creatorName}'s prediction is hidden`}
          </strong>
          <p>
            {isSecretOwner
              ? `${opponentName} cannot receive this value until after accepting and submitting the real answer.`
              : `You can review the question and terms without seeing the prediction. After accepting, you will enter the real answer first.`}
          </p>
        </div>
      </section>
    );
  }

  if (bet.status !== 'active') {
    return (
      <section className="hidden-answer-panel hidden-answer-panel--locked">
        <AppIcon name="lock" size={20} />
        <div>
          <strong>Hidden answer was not revealed</strong>
          <p>This wager ended before the real answer was submitted.</p>
        </div>
      </section>
    );
  }

  if (isSecretOwner) {
    return (
      <section className="hidden-answer-panel hidden-answer-panel--waiting">
        <AppIcon name="lock" size={20} />
        <div>
          <span className="hidden-answer-panel__eyebrow">Your secret is locked</span>
          <strong>{hiddenState.secret_answer}</strong>
          <p>
            Waiting for {opponentName} to submit the real answer. Your prediction
            is not included in their page data before they submit.
          </p>
        </div>
      </section>
    );
  }

  if (isAnswerer && hiddenState.can_submit_answer) {
    const submit = async () => {
      const normalized = answer.trim();
      if (!normalized) {
        setValidationError('Enter the real answer before revealing the prediction.');
        return;
      }

      setValidationError(null);
      try {
        await onSubmitAnswer(bet, normalized);
        setAnswer('');
      } catch {
        // The parent displays the sanitized server error above the bet list.
      }
    };

    return (
      <section className="hidden-answer-panel hidden-answer-panel--entry">
        <div>
          <span className="hidden-answer-panel__eyebrow">Your answer comes first</span>
          <strong>Enter the real answer to reveal the prediction</strong>
          <p>{bet.settlement_condition}</p>
        </div>

        <label className="field-group">
          <span>Actual answer</span>
          <input
            type="text"
            maxLength={240}
            autoComplete="off"
            value={answer}
            placeholder="Filet mignon"
            onChange={(event) => setAnswer(event.target.value)}
          />
        </label>

        {validationError ? (
          <p className="form-message form-message--error" role="alert">
            {validationError}
          </p>
        ) : null}

        <button
          className="primary-button"
          type="button"
          disabled={busy}
          onClick={() => void submit()}
        >
          <AppIcon name="send" size={17} />
          {busy ? 'Locking answer…' : 'Lock answer and reveal'}
        </button>

        <small>
          Submitting is one-way. The server stores your answer before returning
          the hidden prediction, so it cannot be changed after the reveal.
        </small>
      </section>
    );
  }

  return null;
}

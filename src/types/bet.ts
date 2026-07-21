export type WheelItemType = 'prize' | 'punishment';
export type WheelItemStatus = 'active' | 'archived';

export interface WheelItem {
  id: string;
  couple_id: string;
  created_by: string;
  target_user_id: string;
  item_type: WheelItemType;
  title: string;
  description: string | null;
  status: WheelItemStatus;
  created_at: string;
  updated_at: string;
}

export interface WheelItemValues {
  itemType: WheelItemType;
  title: string;
  description: string;
}

export interface WheelReadiness {
  user_id: string;
  prize_ready: boolean;
  punishment_ready: boolean;
}

export type BetType = 'standard' | 'hidden_answer';

export type BetStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'cancelled'
  | 'settled';

export interface Bet {
  id: string;
  couple_id: string;
  created_by: string;
  opponent_id: string;
  bet_type: BetType;
  title: string;
  description: string | null;
  creator_prediction: string | null;
  opponent_prediction: string | null;
  settlement_condition: string;
  settlement_due_at: string | null;
  status: BetStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BetValues {
  betType: BetType;
  title: string;
  description: string;
  creatorPrediction: string;
  opponentPrediction: string;
  hiddenPrediction: string;
  settlementCondition: string;
  settlementDueAt: string;
}

export type HiddenBetAnswerStatus = 'awaiting_answer' | 'revealed';

/**
 * Privacy-safe hidden-answer state returned by get_hidden_bet_states().
 * Before reveal, the secret is returned only to the person who entered it.
 */
export interface HiddenBetState {
  bet_id: string;
  secret_owner_id: string;
  answerer_user_id: string;
  status: HiddenBetAnswerStatus;
  secret_answer: string | null;
  submitted_answer: string | null;
  exact_match: boolean | null;
  can_submit_answer: boolean;
  submitted_at: string | null;
  revealed_at: string | null;
}

export interface BetWheelEntry {
  id: string;
  bet_id: string;
  source_wheel_item_id: string | null;
  created_by: string;
  target_user_id: string;
  item_type: WheelItemType;
  title_snapshot: string;
  description_snapshot: string | null;
  created_at: string;
}

export type BetSettlementStatus =
  | 'awaiting_confirmation'
  | 'disputed'
  | 'ready_to_reveal'
  | 'revealed'
  | 'completion_requested'
  | 'completed'
  | 'waived'
  | 'draw';

export type BetConsequenceType = 'prize' | 'punishment';

/**
 * Safe settlement shape returned by get_bet_settlements(). The selected text
 * remains null until the designated spinner reveals the result.
 */
export interface BetSettlement {
  id: string;
  bet_id: string;
  couple_id: string;
  proposed_by: string;
  proposed_winner_id: string | null;
  proposal_note: string | null;
  status: BetSettlementStatus;
  responded_by: string | null;
  response_note: string | null;
  winner_user_id: string | null;
  loser_user_id: string | null;
  consequence_type: BetConsequenceType | null;
  spinner_user_id: string | null;
  selected_title: string | null;
  selected_description: string | null;
  proposed_at: string;
  confirmed_at: string | null;
  disputed_at: string | null;
  revealed_at: string | null;
  completion_requested_by: string | null;
  completion_requested_at: string | null;
  completed_by: string | null;
  completed_at: string | null;
  waived_by: string | null;
  waived_at: string | null;
  updated_at: string;
}

export interface SettlementProposalValues {
  winnerUserId: string | null;
  note: string;
}

export interface RevealedBetOutcome {
  bet_id: string;
  consequence_type: BetConsequenceType;
  spinner_user_id: string;
  winner_user_id: string;
  loser_user_id: string;
  selected_title: string;
  selected_description: string | null;
  revealed_at: string;
}

export type BetsPageTab = 'bets' | 'wheels';

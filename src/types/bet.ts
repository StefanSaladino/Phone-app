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

export type BetStatus = 'pending' | 'active' | 'rejected' | 'cancelled' | 'settled';

export interface Bet {
  id: string;
  couple_id: string;
  created_by: string;
  opponent_id: string;
  title: string;
  description: string | null;
  creator_prediction: string;
  opponent_prediction: string;
  settlement_condition: string;
  settlement_due_at: string | null;
  status: BetStatus;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BetValues {
  title: string;
  description: string;
  creatorPrediction: string;
  opponentPrediction: string;
  settlementCondition: string;
  settlementDueAt: string;
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

export type BetsPageTab = 'bets' | 'wheels';

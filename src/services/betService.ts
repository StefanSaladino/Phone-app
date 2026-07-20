import { supabase } from '../lib/supabase';
import type {
  Bet,
  BetValues,
  WheelItem,
  WheelItemValues,
  WheelReadiness,
} from '../types/bet';

const wheelItemSelect =
  'id, couple_id, created_by, target_user_id, item_type, title, description, status, created_at, updated_at';

const betSelect =
  'id, couple_id, created_by, opponent_id, title, description, creator_prediction, opponent_prediction, settlement_condition, settlement_due_at, status, accepted_at, rejected_at, cancelled_at, created_at, updated_at';

interface CreateWheelItemOptions {
  coupleId: string;
  currentUserId: string;
  partnerUserId: string;
  values: WheelItemValues;
}

interface CreateBetOptions {
  coupleId: string;
  currentUserId: string;
  partnerUserId: string;
  values: BetValues;
}

export interface BetWorkspaceData {
  bets: Bet[];
  wheelItems: WheelItem[];
  wheelReadiness: WheelReadiness[];
}

/** Converts an unknown Supabase failure into a stable Error instance. */
function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return new Error(error.message);
  }

  return new Error(fallbackMessage);
}

/**
 * Loads shared bets, the signed-in user's private wheel entries, and safe
 * readiness booleans for both partners. Wheel contents never cross users.
 */
export async function loadBetWorkspace(
  coupleId: string,
  currentUserId: string,
): Promise<BetWorkspaceData> {
  const [betsResult, wheelItemsResult, readinessResult] = await Promise.all([
    supabase
      .from('bets')
      .select(betSelect)
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .returns<Bet[]>(),
    supabase
      .from('wheel_items')
      .select(wheelItemSelect)
      .eq('couple_id', coupleId)
      .eq('created_by', currentUserId)
      .order('created_at', { ascending: false })
      .returns<WheelItem[]>(),
    supabase.rpc('get_wheel_readiness', { p_couple_id: coupleId }),
  ]);

  const firstError = betsResult.error ?? wheelItemsResult.error ?? readinessResult.error;

  if (firstError) {
    throw toError(firstError, 'Unable to load the bets workspace.');
  }

  return {
    bets: betsResult.data ?? [],
    wheelItems: wheelItemsResult.data ?? [],
    wheelReadiness: Array.isArray(readinessResult.data)
      ? (readinessResult.data as WheelReadiness[])
      : [],
  };
}

/**
 * Creates either a private personal prize or a private punishment for the
 * partner. The target is derived in code and checked again by database RLS.
 */
export async function createWheelItem({
  coupleId,
  currentUserId,
  partnerUserId,
  values,
}: CreateWheelItemOptions): Promise<WheelItem> {
  const targetUserId =
    values.itemType === 'prize' ? currentUserId : partnerUserId;

  const result = await supabase
    .from('wheel_items')
    .insert({
      couple_id: coupleId,
      created_by: currentUserId,
      target_user_id: targetUserId,
      item_type: values.itemType,
      title: values.title.trim(),
      description: values.description.trim() || null,
      status: 'active',
    })
    .select(wheelItemSelect)
    .single<WheelItem>();

  if (result.error) {
    throw toError(result.error, 'Unable to add this private wheel option.');
  }

  return result.data;
}

/** Removes an item from future bets without changing snapshots already locked. */
export async function archiveWheelItem(itemId: string): Promise<WheelItem> {
  const result = await supabase
    .rpc('archive_wheel_item', { p_item_id: itemId })
    .select(wheelItemSelect)
    .single<WheelItem>();

  if (result.error) {
    throw toError(result.error, 'Unable to archive this wheel option.');
  }

  return result.data;
}

/** Sends an immutable bet invitation to the linked partner. */
export async function createBet({
  coupleId,
  currentUserId,
  partnerUserId,
  values,
}: CreateBetOptions): Promise<Bet> {
  const settlementDueAt = values.settlementDueAt
    ? new Date(values.settlementDueAt).toISOString()
    : null;

  const result = await supabase
    .from('bets')
    .insert({
      couple_id: coupleId,
      created_by: currentUserId,
      opponent_id: partnerUserId,
      title: values.title.trim(),
      description: values.description.trim() || null,
      creator_prediction: values.creatorPrediction.trim(),
      opponent_prediction: values.opponentPrediction.trim(),
      settlement_condition: values.settlementCondition.trim(),
      settlement_due_at: settlementDueAt,
      status: 'pending',
    })
    .select(betSelect)
    .single<Bet>();

  if (result.error) {
    throw toError(result.error, 'Unable to send this bet invitation.');
  }

  return result.data;
}

/** Accepts a bet and snapshots both partners' private wheel pools. */
export async function acceptBet(betId: string): Promise<Bet> {
  const result = await supabase
    .rpc('accept_bet', { p_bet_id: betId })
    .select(betSelect)
    .single<Bet>();

  if (result.error) {
    throw toError(result.error, 'Unable to accept this bet.');
  }

  return result.data;
}

/** Rejects an invitation as the invited partner. */
export async function rejectBet(betId: string): Promise<Bet> {
  const result = await supabase
    .rpc('reject_bet', { p_bet_id: betId })
    .select(betSelect)
    .single<Bet>();

  if (result.error) {
    throw toError(result.error, 'Unable to reject this bet.');
  }

  return result.data;
}

/** Cancels a still-pending invitation created by the current user. */
export async function cancelBet(betId: string): Promise<Bet> {
  const result = await supabase
    .rpc('cancel_bet', { p_bet_id: betId })
    .select(betSelect)
    .single<Bet>();

  if (result.error) {
    throw toError(result.error, 'Unable to cancel this invitation.');
  }

  return result.data;
}

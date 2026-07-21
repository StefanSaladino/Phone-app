import { supabase } from '../lib/supabase';
import type {
  NotificationPreferences,
  NotificationPreferencesValues,
  PushSubscriptionRecord,
} from '../types/notification';

const preferenceSelect =
  'user_id, event_reminders_enabled, bet_updates_enabled, reminder_minutes_before, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone, created_at, updated_at';

const subscriptionSelect =
  'id, user_id, endpoint, device_label, is_active, created_at, updated_at';

interface SavePushSubscriptionOptions {
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  deviceLabel: string;
  userAgent: string;
}

function stableError(error: unknown, fallbackMessage: string): Error {
  if (import.meta.env.DEV) {
    console.error(fallbackMessage, error);
  }

  return new Error(fallbackMessage);
}

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) {
    return (data[0] as T | undefined) ?? null;
  }

  if (typeof data === 'object' && data !== null) {
    return data as T;
  }

  return null;
}

export async function loadNotificationPreferences(
  currentUserId: string,
): Promise<NotificationPreferences> {
  const result = await supabase
    .from('notification_preferences')
    .select(preferenceSelect)
    .eq('user_id', currentUserId)
    .single<NotificationPreferences>();

  if (result.error || !result.data) {
    throw stableError(
      result.error,
      'Unable to load notification preferences.',
    );
  }

  return result.data;
}

export async function listActivePushSubscriptions(
  currentUserId: string,
): Promise<PushSubscriptionRecord[]> {
  const result = await supabase
    .from('push_subscriptions')
    .select(subscriptionSelect)
    .eq('user_id', currentUserId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .returns<PushSubscriptionRecord[]>();

  if (result.error) {
    throw stableError(result.error, 'Unable to load registered devices.');
  }

  return result.data ?? [];
}

export async function saveNotificationPreferences(
  values: NotificationPreferencesValues,
): Promise<NotificationPreferences> {
  const result = await supabase.rpc('set_notification_preferences', {
    p_event_reminders_enabled: values.eventRemindersEnabled,
    p_bet_updates_enabled: values.betUpdatesEnabled,
    p_reminder_minutes_before: values.reminderMinutesBefore,
    p_quiet_hours_enabled: values.quietHoursEnabled,
    p_quiet_hours_start: values.quietHoursStart,
    p_quiet_hours_end: values.quietHoursEnd,
    p_timezone: values.timezone,
  });

  if (result.error) {
    throw stableError(result.error, 'Unable to save notification preferences.');
  }

  const preferences = firstRow<NotificationPreferences>(result.data);

  if (!preferences) {
    throw new Error('Unable to save notification preferences.');
  }

  return preferences;
}

export async function savePushSubscription({
  endpoint,
  p256dhKey,
  authKey,
  deviceLabel,
  userAgent,
}: SavePushSubscriptionOptions): Promise<PushSubscriptionRecord> {
  const result = await supabase.rpc('upsert_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh_key: p256dhKey,
    p_auth_key: authKey,
    p_device_label: deviceLabel,
    p_user_agent: userAgent,
  });

  if (result.error) {
    throw stableError(result.error, 'Unable to register this device.');
  }

  const subscription = firstRow<PushSubscriptionRecord>(result.data);

  if (!subscription) {
    throw new Error('Unable to register this device.');
  }

  return subscription;
}

export async function disablePushSubscription(endpoint: string): Promise<void> {
  const result = await supabase.rpc('disable_push_subscription', {
    p_endpoint: endpoint,
  });

  if (result.error) {
    throw stableError(result.error, 'Unable to disable notifications.');
  }
}

export async function enqueueTestNotification(): Promise<void> {
  const result = await supabase.rpc('enqueue_test_notification');

  if (result.error) {
    throw stableError(result.error, 'Unable to queue a test notification.');
  }
}

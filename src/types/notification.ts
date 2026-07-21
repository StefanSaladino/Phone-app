export interface NotificationPreferences {
  user_id: string;
  event_reminders_enabled: boolean;
  bet_updates_enabled: boolean;
  reminder_minutes_before: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface PushSubscriptionRecord {
  id: string;
  user_id: string;
  endpoint: string;
  device_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferencesValues {
  eventRemindersEnabled: boolean;
  betUpdatesEnabled: boolean;
  reminderMinutesBefore: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
}

export type PushAvailability =
  | 'available'
  | 'unsupported'
  | 'install-required'
  | 'configuration-missing';

export type PushBusyAction =
  | 'enable'
  | 'disable'
  | 'save'
  | 'test'
  | null;

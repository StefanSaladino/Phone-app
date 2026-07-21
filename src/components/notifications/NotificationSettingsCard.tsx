import { useEffect, useState } from 'react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import type { NotificationPreferencesValues } from '../../types/notification';
import { AppIcon } from '../ui/AppIcon';

interface NotificationSettingsCardProps {
  currentUserId: string;
}

const reminderOptions = [
  { value: 30, label: '30 minutes before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
];

function defaultTimezone(): string {
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto'
  );
}

/**
 * User-facing Web Push controls. Permission is requested only from the direct
 * Enable button click, which is required by iPhone and other browsers.
 */
export function NotificationSettingsCard({
  currentUserId,
}: NotificationSettingsCardProps) {
  const push = usePushNotifications(currentUserId);
  const [values, setValues] = useState<NotificationPreferencesValues | null>(
    null,
  );

  useEffect(() => {
    if (!push.preferences) return;

    setValues({
      eventRemindersEnabled: push.preferences.event_reminders_enabled,
      betUpdatesEnabled: push.preferences.bet_updates_enabled,
      reminderMinutesBefore: push.preferences.reminder_minutes_before,
      quietHoursEnabled: push.preferences.quiet_hours_enabled,
      quietHoursStart: push.preferences.quiet_hours_start.slice(0, 5),
      quietHoursEnd: push.preferences.quiet_hours_end.slice(0, 5),
      timezone: push.preferences.timezone || defaultTimezone(),
    });
  }, [push.preferences]);

  const statusLabel = push.enabledOnThisDevice
    ? 'Enabled'
    : push.permission === 'denied'
      ? 'Blocked'
      : 'Off';

  return (
    <section className="notification-settings-card" aria-labelledby="notification-settings-title">
      <header className="notification-settings-card__header">
        <span className="notification-settings-card__icon" aria-hidden="true">
          <AppIcon name="bell" size={23} />
        </span>

        <div>
          <p className="section-heading__eyebrow">Stay in the loop</p>
          <h2 id="notification-settings-title">Notifications</h2>
          <p>
            Get planned-date reminders and bet updates even when Together is
            closed.
          </p>
        </div>

        <span
          className={`notification-status notification-status--${statusLabel.toLowerCase()}`}
        >
          {statusLabel}
        </span>
      </header>

      {push.availability === 'install-required' ? (
        <div className="notification-help-card">
          <strong>Install Together first</strong>
          <p>
            On iPhone or iPad, open the Share menu, choose Add to Home Screen,
            then open Together from its new icon before enabling notifications.
          </p>
        </div>
      ) : null}

      {push.availability === 'unsupported' ? (
        <div className="notification-help-card">
          <strong>Web Push is unavailable here</strong>
          <p>
            Use a current browser with service-worker and notification support.
          </p>
        </div>
      ) : null}

      {push.availability === 'configuration-missing' ? (
        <div className="notification-help-card">
          <strong>Notification setup is not finished</strong>
          <p>
            This build is missing its public VAPID key. The app remains fully
            usable without notifications.
          </p>
        </div>
      ) : null}

      {push.loading ? (
        <p className="notification-settings-card__loading" aria-live="polite">
          Loading notification settings…
        </p>
      ) : values ? (
        <div className="notification-settings-card__content">
          <div className="notification-device-row">
            <div>
              <strong>
                {push.enabledOnThisDevice
                  ? 'This device is registered'
                  : 'Enable this device'}
              </strong>
              <span>
                {push.activeDeviceCount === 1
                  ? '1 active device on your account'
                  : `${push.activeDeviceCount} active devices on your account`}
              </span>
            </div>

            {push.enabledOnThisDevice ? (
              <button
                className="secondary-button"
                type="button"
                disabled={push.busyAction !== null}
                onClick={() => void push.disable()}
              >
                {push.busyAction === 'disable' ? 'Disabling…' : 'Disable'}
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                disabled={
                  push.busyAction !== null ||
                  push.availability !== 'available'
                }
                onClick={() => void push.enable()}
              >
                <AppIcon name="bell" size={18} />
                {push.busyAction === 'enable'
                  ? 'Enabling…'
                  : 'Enable notifications'}
              </button>
            )}
          </div>

          <div className="notification-preferences">
            <label className="notification-toggle">
              <span>
                <strong>Planned-date reminders</strong>
                <small>Remind me before a planned date begins.</small>
              </span>
              <input
                type="checkbox"
                checked={values.eventRemindersEnabled}
                onChange={(event) =>
                  setValues((current) =>
                    current
                      ? {
                          ...current,
                          eventRemindersEnabled: event.target.checked,
                        }
                      : current,
                  )
                }
              />
            </label>

            {values.eventRemindersEnabled ? (
              <label className="notification-field">
                <span>Reminder timing</span>
                <select
                  value={values.reminderMinutesBefore}
                  onChange={(event) =>
                    setValues((current) =>
                      current
                        ? {
                            ...current,
                            reminderMinutesBefore: Number(event.target.value),
                          }
                        : current,
                    )
                  }
                >
                  {reminderOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="notification-toggle">
              <span>
                <strong>Bet updates</strong>
                <small>
                  Invitations, settlement requests, reveals, and completion
                  updates.
                </small>
              </span>
              <input
                type="checkbox"
                checked={values.betUpdatesEnabled}
                onChange={(event) =>
                  setValues((current) =>
                    current
                      ? {
                          ...current,
                          betUpdatesEnabled: event.target.checked,
                        }
                      : current,
                  )
                }
              />
            </label>

            <label className="notification-toggle">
              <span>
                <strong>Quiet hours</strong>
                <small>Hold non-urgent alerts until the quiet period ends.</small>
              </span>
              <input
                type="checkbox"
                checked={values.quietHoursEnabled}
                onChange={(event) =>
                  setValues((current) =>
                    current
                      ? {
                          ...current,
                          quietHoursEnabled: event.target.checked,
                        }
                      : current,
                  )
                }
              />
            </label>

            {values.quietHoursEnabled ? (
              <div className="notification-time-grid">
                <label className="notification-field">
                  <span>Starts</span>
                  <input
                    type="time"
                    value={values.quietHoursStart}
                    onChange={(event) =>
                      setValues((current) =>
                        current
                          ? { ...current, quietHoursStart: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>

                <label className="notification-field">
                  <span>Ends</span>
                  <input
                    type="time"
                    value={values.quietHoursEnd}
                    onChange={(event) =>
                      setValues((current) =>
                        current
                          ? { ...current, quietHoursEnd: event.target.value }
                          : current,
                      )
                    }
                  />
                </label>
              </div>
            ) : null}

            <p className="notification-timezone">
              Times use <strong>{values.timezone}</strong>.
            </p>
          </div>

          <div className="notification-settings-card__actions">
            <button
              className="secondary-button"
              type="button"
              disabled={!push.enabledOnThisDevice || push.busyAction !== null}
              onClick={() => void push.sendTest()}
            >
              {push.busyAction === 'test' ? 'Queueing…' : 'Send a test'}
            </button>

            <button
              className="primary-button"
              type="button"
              disabled={push.busyAction !== null}
              onClick={() => void push.savePreferences(values)}
            >
              {push.busyAction === 'save' ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>
      ) : null}

      {push.error ? (
        <p className="form-message form-message--error" role="alert">
          {push.error}
        </p>
      ) : null}

      {push.successMessage ? (
        <p className="notification-success" role="status">
          <AppIcon name="check" size={17} />
          {push.successMessage}
        </p>
      ) : null}

      <p className="notification-privacy-note">
        <AppIcon name="lock" size={16} />
        Surprise notes never create push notifications or lock-screen previews.
      </p>
    </section>
  );
}

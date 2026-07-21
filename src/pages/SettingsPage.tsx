import { useEffect, useState } from 'react';
import { NotificationSettingsCard } from '../components/notifications/NotificationSettingsCard';
import { supabase } from '../lib/supabase';

/**
 * Dedicated settings page for notification permissions and preferences.
 */
export default function SettingsPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [userError, setUserError] = useState('');

  useEffect(() => {
    let isActive = true;

    async function loadCurrentUser(): Promise<void> {
      setIsLoadingUser(true);
      setUserError('');

      const { data, error } = await supabase.auth.getUser();

      if (!isActive) {
        return;
      }

      if (error || !data.user) {
        setCurrentUserId(null);
        setUserError(
          'Unable to load notification settings for the current account.',
        );
        setIsLoadingUser(false);
        return;
      }

      setCurrentUserId(data.user.id);
      setIsLoadingUser(false);
    }

    void loadCurrentUser();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="settings-page">
      <header className="settings-page__header">
        <p className="settings-page__eyebrow">Together preferences</p>

        <h1>Settings</h1>

        <p>
          Configure notifications for this account and device. Each partner can
          choose their own preferences independently.
        </p>
      </header>

      <div className="settings-page__content">
        {isLoadingUser ? (
          <section className="settings-card">
            <p aria-live="polite" className="settings-card__status">
              Loading notification settings…
            </p>
          </section>
        ) : null}

        {userError ? (
          <section className="settings-card">
            <p
              aria-live="assertive"
              className="settings-card__message is-error"
            >
              {userError}
            </p>
          </section>
        ) : null}

        {!isLoadingUser && currentUserId ? (
          <NotificationSettingsCard currentUserId={currentUserId} />
        ) : null}
      </div>
    </div>
  );
}
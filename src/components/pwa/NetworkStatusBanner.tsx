import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/** Displays a persistent but compact warning while shared data is unavailable. */
export function NetworkStatusBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="network-status-banner" role="status" aria-live="polite">
      <span aria-hidden="true">↯</span>
      <span>
        <strong>You’re offline.</strong> The app shell is available, but shared lists need a
        connection.
      </span>
    </div>
  );
}

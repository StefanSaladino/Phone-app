import { Outlet } from 'react-router-dom';
import { useCouple } from '../../hooks/useCouple';

/**
 * Prevents the private app shell from rendering until the shared workspace exists.
 */
export function CoupleGuard() {
  const { workspace, loading, error, refreshWorkspace } = useCouple();

  if (loading) {
    return (
      <main className="route-loader" aria-live="polite">
        <span className="route-loader__mark" aria-hidden="true">
          ♥
        </span>
        <p>Opening your shared space…</p>
      </main>
    );
  }

  if (error || !workspace) {
    return (
      <main className="workspace-error-page">
        <section className="workspace-error-card" role="alert">
          <span className="workspace-error-card__mark" aria-hidden="true">
            ♥
          </span>
          <p className="section-heading__eyebrow">We couldn’t open your space</p>
          <h1>Something is missing.</h1>
          <p>
            {error ??
              'This account is signed in, but it is not connected to a couple workspace.'}
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() => void refreshWorkspace()}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  return <Outlet />;
}

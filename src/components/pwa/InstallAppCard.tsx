import { useState } from 'react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

/**
 * Gives iPhone users the exact Safari installation steps and uses the native
 * browser prompt on platforms that expose it.
 */
export function InstallAppCard() {
  const { canPromptInstall, isInstalled, isIos, requestInstall } = useInstallPrompt();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isInstalled || isDismissed) return null;

  async function handleInstall() {
    await requestInstall();
  }

  return (
    <section className="install-app-card" aria-labelledby="install-app-title">
      <button
        className="install-app-card__dismiss"
        type="button"
        aria-label="Hide installation instructions"
        onClick={() => setIsDismissed(true)}
      >
        ×
      </button>

      <span className="install-app-card__icon" aria-hidden="true">
        ♥
      </span>

      <div>
        <p className="section-heading__eyebrow">Keep it close</p>
        <h2 id="install-app-title">Add Together to your Home Screen</h2>

        {canPromptInstall ? (
          <>
            <p>Install the private app for a full-screen, app-like experience.</p>
            <button className="secondary-button" type="button" onClick={() => void handleInstall()}>
              Install Together
            </button>
          </>
        ) : isIos ? (
          <ol className="install-app-card__steps">
            <li>Open this page in Safari.</li>
            <li>Tap the Share button.</li>
            <li>Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.</li>
          </ol>
        ) : (
          <p>
            Open the browser menu and choose <strong>Install app</strong> or{' '}
            <strong>Add to Home Screen</strong>.
          </p>
        )}
      </div>
    </section>
  );
}

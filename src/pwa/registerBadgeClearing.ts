/**
 * Minimal optional Badging API shape.
 *
 * Do not extend Navigator or ServiceWorkerRegistration because newer
 * TypeScript DOM definitions already declare clearAppBadge().
 */
type OptionalBadgeClearer = {
  clearAppBadge?: () => Promise<void>;
};

/**
 * Clears the Home Screen badge through both the active page and service-worker
 * registration. Unsupported browsers simply skip these calls.
 */
async function clearApplicationBadge(): Promise<void> {
  if (typeof navigator === 'undefined') {
    return;
  }

  const badgeNavigator = navigator as unknown as OptionalBadgeClearer;

  try {
    if (typeof badgeNavigator.clearAppBadge === 'function') {
      await badgeNavigator.clearAppBadge();
    }
  } catch {
    // Badge clearing must never prevent the application from loading.
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    const badgeRegistration =
      registration as unknown as OptionalBadgeClearer;

    if (typeof badgeRegistration.clearAppBadge === 'function') {
      await badgeRegistration.clearAppBadge();
    }

    registration.active?.postMessage({
      type: 'CLEAR_APP_BADGE',
    });
  } catch {
    // The service worker may still be installing during the first app opening.
  }
}

function requestBadgeClear(): void {
  void clearApplicationBadge();
}

/**
 * Clear the badge immediately and whenever the installed PWA returns to the
 * foreground.
 */
if (typeof window !== 'undefined') {
  requestBadgeClear();

  window.addEventListener('focus', requestBadgeClear);
  window.addEventListener('pageshow', requestBadgeClear);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestBadgeClear();
    }
  });
}
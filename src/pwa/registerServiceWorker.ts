/**
 * Registers the production service worker after the window finishes loading.
 * Development builds deliberately skip registration so stale caches cannot
 * interfere with Vite's hot-reload workflow.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/service-worker.js').catch((error: unknown) => {
      console.error('Unable to register the Together service worker.', error);
    });
  });
}

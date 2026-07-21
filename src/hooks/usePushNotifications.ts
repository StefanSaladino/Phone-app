import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  disablePushSubscription,
  enqueueTestNotification,
  listActivePushSubscriptions,
  loadNotificationPreferences,
  saveNotificationPreferences,
  savePushSubscription,
} from '../services/notificationService';
import type {
  NotificationPreferences,
  NotificationPreferencesValues,
  PushAvailability,
  PushBusyAction,
} from '../types/notification';

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

interface UsePushNotificationsResult {
  availability: PushAvailability;
  permission: NotificationPermission;
  enabledOnThisDevice: boolean;
  activeDeviceCount: number;
  preferences: NotificationPreferences | null;
  loading: boolean;
  busyAction: PushBusyAction;
  error: string | null;
  successMessage: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  savePreferences: (values: NotificationPreferencesValues) => Promise<void>;
  sendTest: () => Promise<void>;
}

function isIosDevice(): boolean {
  const navigatorWithTouch = navigator as Navigator & {
    maxTouchPoints?: number;
  };

  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' &&
      (navigatorWithTouch.maxTouchPoints ?? 0) > 1)
  );
}

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as NavigatorWithStandalone).standalone === true
  );
}

function base64UrlToArrayBuffer(value: string): ArrayBuffer {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const normalized = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const decoded = window.atob(normalized);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes.buffer;
}

function getDeviceLabel(): string {
  if (isIosDevice()) return 'iPhone or iPad';

  if (/Android/i.test(navigator.userAgent)) return 'Android device';
  if (/Windows/i.test(navigator.userAgent)) return 'Windows browser';
  if (/Macintosh|Mac OS X/i.test(navigator.userAgent)) return 'Mac browser';

  return 'Web browser';
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  const existingRegistration = await navigator.serviceWorker.getRegistration('/');

  if (existingRegistration) return existingRegistration;

  return navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
}

export function usePushNotifications(
  currentUserId: string,
): UsePushNotificationsResult {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim() ?? '';
  const browserSupportsPush =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  const installRequired = isIosDevice() && !isStandaloneDisplay();

  const availability = useMemo<PushAvailability>(() => {
    if (!browserSupportsPush) return 'unsupported';
    if (installRequired) return 'install-required';
    if (!vapidPublicKey) return 'configuration-missing';
    return 'available';
  }, [browserSupportsPush, installRequired, vapidPublicKey]);

  const [permission, setPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'default',
  );
  const [preferences, setPreferences] =
    useState<NotificationPreferences | null>(null);
  const [activeDeviceCount, setActiveDeviceCount] = useState(0);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<PushBusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [loadedPreferences, devices] = await Promise.all([
        loadNotificationPreferences(currentUserId),
        listActivePushSubscriptions(currentUserId),
      ]);

      setPreferences(loadedPreferences);
      setActiveDeviceCount(devices.length);

      if (browserSupportsPush) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const subscription = await registration?.pushManager.getSubscription();
        setCurrentEndpoint(subscription?.endpoint ?? null);
        setPermission(Notification.permission);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to load notification settings.',
      );
    } finally {
      setLoading(false);
    }
  }, [browserSupportsPush, currentUserId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusyAction('enable');
    setError(null);
    setSuccessMessage(null);

    try {
      if (availability === 'install-required') {
        throw new Error(
          'Install Together on your Home Screen before enabling iPhone notifications.',
        );
      }

      if (availability === 'configuration-missing') {
        throw new Error('Push notifications are not configured for this build yet.');
      }

      if (availability !== 'available') {
        throw new Error('This browser does not support Web Push notifications.');
      }

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        throw new Error(
          nextPermission === 'denied'
            ? 'Notifications are blocked. Enable Together in your device notification settings.'
            : 'Notification permission was not granted.',
        );
      }

      const registration = await getServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToArrayBuffer(vapidPublicKey),
        });
      }

      const subscriptionJson = subscription.toJSON();
      const p256dhKey = subscriptionJson.keys?.p256dh;
      const authKey = subscriptionJson.keys?.auth;

      if (!subscriptionJson.endpoint || !p256dhKey || !authKey) {
        throw new Error('The browser returned an incomplete push subscription.');
      }

      await savePushSubscription({
        endpoint: subscriptionJson.endpoint,
        p256dhKey,
        authKey,
        deviceLabel: getDeviceLabel(),
        userAgent: navigator.userAgent,
      });

      setCurrentEndpoint(subscription.endpoint);
      setSuccessMessage('Notifications are enabled on this device.');
      await refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to enable notifications.',
      );
    } finally {
      setBusyAction(null);
    }
  }, [availability, refresh, vapidPublicKey]);

  const disable = useCallback(async () => {
    setBusyAction('disable');
    setError(null);
    setSuccessMessage(null);

    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      const endpoint = subscription?.endpoint ?? currentEndpoint;

      if (endpoint) {
        await disablePushSubscription(endpoint);
      }

      if (subscription) {
        await subscription.unsubscribe();
      }

      setCurrentEndpoint(null);
      setSuccessMessage('Notifications are disabled on this device.');
      await refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to disable notifications.',
      );
    } finally {
      setBusyAction(null);
    }
  }, [currentEndpoint, refresh]);

  const savePreferences = useCallback(
    async (values: NotificationPreferencesValues) => {
      setBusyAction('save');
      setError(null);
      setSuccessMessage(null);

      try {
        const savedPreferences = await saveNotificationPreferences(values);
        setPreferences(savedPreferences);
        setSuccessMessage('Notification preferences saved.');
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Unable to save notification preferences.',
        );
      } finally {
        setBusyAction(null);
      }
    },
    [],
  );

  const sendTest = useCallback(async () => {
    setBusyAction('test');
    setError(null);
    setSuccessMessage(null);

    try {
      await enqueueTestNotification();
      setSuccessMessage(
        'Test queued. It should arrive after the notification worker runs.',
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to queue a test notification.',
      );
    } finally {
      setBusyAction(null);
    }
  }, []);

  return {
    availability,
    permission,
    enabledOnThisDevice:
      permission === 'granted' && currentEndpoint !== null,
    activeDeviceCount,
    preferences,
    loading,
    busyAction,
    error,
    successMessage,
    enable,
    disable,
    savePreferences,
    sendTest,
  };
}

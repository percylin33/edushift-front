import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp, getApps } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { environment } from '@env/environment';
import { AuthService } from '@core/services/auth.service';
import { NotificationDevicesApiService } from './notification-devices-api.service';

export type PushActivationResult =
  | 'enabled'
  | 'permission-denied'
  | 'unsupported'
  | 'not-configured'
  | 'not-authenticated'
  | 'failed';

export type PushDeactivationResult = 'disabled' | 'not-authenticated' | 'failed';

@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly storageKeyPrefix = 'edushift.push-enabled:';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly devices = inject(NotificationDevicesApiService);

  constructor() {
    if (isPlatformBrowser(this.platformId)) void this.listenForForegroundMessages();
  }

  isEnabledForCurrentUser(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    const userId = this.auth.user()?.publicUuid;
    if (!userId) return false;
    try {
      return localStorage.getItem(this.storageKeyPrefix + userId) === 'true';
    } catch {
      return false;
    }
  }

  async activateForCurrentDevice(): Promise<PushActivationResult> {
    if (!isPlatformBrowser(this.platformId) || !('Notification' in globalThis)) {
      return 'unsupported';
    }
    if (!this.auth.isAuthenticated()) return 'not-authenticated';

    const config = environment.firebase;
    const vapidKey = config?.messagingVapidKey;
    if (
      !config ||
      !vapidKey ||
      vapidKey.startsWith('REPLACE_ME') ||
      config.apiKey.startsWith('REPLACE_ME') ||
      config.messagingSenderId.startsWith('REPLACE_ME') ||
      config.appId.startsWith('REPLACE_ME')
    ) {
      return 'not-configured';
    }
    if (!isSecureContext || !('serviceWorker' in navigator)) return 'unsupported';

    try {
      if (!(await isSupported())) return 'unsupported';

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return 'permission-denied';

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) return 'unsupported';
      const firebaseApp =
        getApps().find((app) => app.options.projectId === config.projectId) ??
        initializeApp(config, 'edushift-push');
      const messaging = getMessaging(firebaseApp);
      const registrationToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });

      if (!registrationToken) return 'failed';
      await this.devices.register(registrationToken, 'WEB');
      this.setEnabledForCurrentUser(true);
      return 'enabled';
    } catch {
      return 'failed';
    }
  }

  async deactivateForCurrentDevice(): Promise<PushDeactivationResult> {
    if (!isPlatformBrowser(this.platformId) || !('Notification' in globalThis)) return 'failed';
    if (!this.auth.isAuthenticated()) return 'not-authenticated';
    if (Notification.permission !== 'granted') {
      this.setEnabledForCurrentUser(false);
      return 'disabled';
    }

    const config = environment.firebase;
    const vapidKey = config?.messagingVapidKey;
    if (!config || !vapidKey || vapidKey.startsWith('REPLACE_ME')) return 'failed';

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active) return 'failed';
      const firebaseApp =
        getApps().find((app) => app.options.projectId === config.projectId) ??
        initializeApp(config, 'edushift-push');
      const messaging = getMessaging(firebaseApp);
      const registrationToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      });
      if (!registrationToken) return 'failed';

      await this.devices.unregister(registrationToken);
      await deleteToken(messaging).catch(() => false);
      this.setEnabledForCurrentUser(false);
      return 'disabled';
    } catch {
      return 'failed';
    }
  }

  private setEnabledForCurrentUser(enabled: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const userId = this.auth.user()?.publicUuid;
    if (!userId) return;
    try {
      if (enabled) localStorage.setItem(this.storageKeyPrefix + userId, 'true');
      else localStorage.removeItem(this.storageKeyPrefix + userId);
    } catch {
      // Browser storage can be unavailable; push registration still succeeds.
    }
  }

  private async listenForForegroundMessages(): Promise<void> {
    const config = environment.firebase;
    if (!config) return;

    try {
      if (!(await isSupported())) return;
      const firebaseApp =
        getApps().find((app) => app.options.projectId === config.projectId) ??
        initializeApp(config, 'edushift-push');
      const messaging = getMessaging(firebaseApp);
      onMessage(messaging, (payload) => {
        if (Notification.permission !== 'granted') return;
        const notification = new Notification(
          payload.notification?.title ?? 'Notificación de EduShift',
          {
            body: payload.notification?.body ?? 'Tienes una actualización en EduShift.',
            icon: '/icons/icon-192.svg',
            badge: '/icons/notification-badge.svg',
            tag: payload.data?.['notificationPublicUuid']
              ? `edushift-${payload.data['notificationPublicUuid']}`
              : undefined,
            data: { url: '/notifications' },
          },
        );
        notification.onclick = () => {
          notification.close();
          window.focus();
          window.location.assign(new URL('/notifications', window.location.origin).toString());
        };
      });
    } catch {
      // Push remains optional on browsers without Firebase Messaging support.
    }
  }
}

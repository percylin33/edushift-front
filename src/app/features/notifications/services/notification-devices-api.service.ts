import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { firstValueFrom } from 'rxjs';

/**
 * Sprint cierre-C / B8 — FCM device token registration.
 *
 * <p>The Firebase JS SDK calls {@code getToken()} after a user explicitly
 * enables notifications. This service registers the resulting token with
 * the BE so {@code FcmSender} can deliver to the device. Device cleanup is
 * called when the user disables notifications or logs out.</p>
 */
@Injectable({ providedIn: 'root' })
export class NotificationDevicesApiService {
  private readonly api = inject(ApiService);

  register(token: string, platform: 'ANDROID' | 'IOS' | 'WEB'): Promise<void> {
    return firstValueFrom(
      this.api.post<void, { token: string; platform: string }>(API.NOTIFICATIONS.DEVICES.ROOT, {
        token,
        platform,
      }),
    );
  }

  heartbeat(token: string): Promise<void> {
    return firstValueFrom(
      this.api.put<void, { token: string }>(API.NOTIFICATIONS.DEVICES.HEARTBEAT, { token }),
    );
  }

  unregister(token: string): Promise<void> {
    return firstValueFrom(
      this.api.delete<void, { token: string }>(API.NOTIFICATIONS.DEVICES.ROOT, undefined, {
        token,
      }),
    );
  }
}

import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';

/**
 * Sprint cierre-C / B8 — FCM device token registration.
 *
 * <p>The Firebase JS SDK in the FE calls {@code getToken()} on each
 * successful login + on each app open. We send the token to the BE so
 * the {@link NotificationService} can fan out via
 * {@code FcmSender.sendEachForMulticast}. On logout we
 * {@code DELETE} so the token gets deactivated (soft-delete via the
 * {@code active} flag) and never picked up again.</p>
 */
@Injectable({ providedIn: 'root' })
export class NotificationDevicesApiService {
	private readonly api = inject(ApiService);

	register(token: string, platform: 'ANDROID' | 'IOS' | 'WEB'): Promise<void> {
		return this.api.post<void, { token: string; platform: string }>(
			API.NOTIFICATIONS.DEVICES.ROOT,
			{ token, platform },
		).then(() => undefined);
	}

	heartbeat(token: string): Promise<void> {
		return this.api
			.put<void, { token: string }>(API.NOTIFICATIONS.DEVICES.HEARTBEAT, { token })
			.then(() => undefined);
	}

	unregister(token: string): Promise<void> {
		return this.api
			.delete<void>(API.NOTIFICATIONS.DEVICES.ROOT, { data: { token } } as never)
			.then(() => undefined);
	}
}
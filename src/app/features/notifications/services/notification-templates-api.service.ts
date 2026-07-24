import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import { API } from '@core/constants';

/**
 * Notification template row (Sprint cierre-C / F11).
 *
 * <p>Mirrors the BE
 * {@code com.edushift.modules.notifications.entity.NotificationTemplate}.
 * Body HTML uses {@code {{key}}} placeholders that the
 * {@code NotificationTemplateEngine} expands from the notification's
 * JSONB payload. The BE sanitizes the body with jsoup on write
 * (allowlist of safe tags); `version` is bumped on each save so the
 * cache invalidates.</p>
 */
export interface NotificationTemplate {
	publicUuid: string;
	templateKey: string;
	locale: string;
	subject: string;
	bodyHtml: string;
	version: number;
	system: boolean;
}

/**
 * HTTP boundary for the templates editor. Endpoints live under
 * {@code /v1/notifications/templates}; gated by
 * {@code LMS_NOTIFICATIONS_MANAGE} on the BE.
 */
@Injectable({ providedIn: 'root' })
export class NotificationTemplatesApiService {
	private readonly api = inject(ApiService);

	list(): Observable<readonly NotificationTemplate[]> {
		return this.api
			.get<ApiResponse<NotificationTemplate[]>>(API.NOTIFICATIONS.TEMPLATES.ROOT)
			.pipe(map((env) => env.data ?? []));
	}

	update(
		publicUuid: string,
		req: { subject: string; bodyHtml: string },
	): Observable<NotificationTemplate> {
		return this.api
			.patch<ApiResponse<NotificationTemplate>, { subject: string; bodyHtml: string }>(
				API.NOTIFICATIONS.TEMPLATES.BY_ID(publicUuid),
				req,
			)
			.pipe(map((env) => env.data));
	}
}
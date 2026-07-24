import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import { API } from '@core/constants';

/**
 * Recurring report template (Sprint cierre-C / B12).
 *
 * <p>Mirrors the BE
 * {@code com.edushift.modules.reports.entity.ReportTemplate}. The
 * {@code nextRunAt} is pre-computed on save so the FE can show
 * "Próxima ejecución: 2026-08-01 08:00" without re-running cron
 * parsing client-side.</p>
 */
export interface ReportTemplate {
	publicUuid: string;
	name: string;
	description: string | null;
	reportType: 'GRADE_BOOK' | 'ATTENDANCE_SUMMARY' | 'PERIOD_CLOSE' | 'STUDENT_TRANSCRIPT' | string;
	format: 'PDF' | 'XLSX' | 'CSV' | string;
	active: boolean;
	cronExpression: string;
	timezone: string;
	lastRunAt: string | null;
	nextRunAt: string | null;
	recipients: readonly string[];
	emailSubject: string | null;
	emailBodyTemplate: string | null;
	params: string;
	createdAt: string;
	updatedAt: string;
}

export interface ReportTemplateRequest {
	name: string;
	description: string | null;
	reportType: ReportTemplate['reportType'];
	format: ReportTemplate['format'];
	active: boolean;
	cronExpression: string;
	timezone: string;
	recipients: readonly string[];
	emailSubject: string | null;
	emailBodyTemplate: string | null;
	params: string;
}

/**
 * HTTP boundary for the templates catalog. All endpoints under
 * {@code /v1/reports/templates}; TENANT_ADMIN only on the BE.
 */
@Injectable({ providedIn: 'root' })
export class ReportTemplatesApiService {
	private readonly api = inject(ApiService);

	list(page = 0, size = 50): Observable<readonly ReportTemplate[]> {
		return this.api
			.get<ApiResponse<{ content: ReportTemplate[]; totalElements: number }>>(
				API.REPORTS.TEMPLATES.ROOT,
				{ params: { page, size } },
			)
			.pipe(map((env) => env.data?.content ?? []));
	}

	get(publicUuid: string): Observable<ReportTemplate> {
		return this.api
			.get<ApiResponse<ReportTemplate>>(API.REPORTS.TEMPLATES.BY_ID(publicUuid))
			.pipe(map((env) => env.data));
	}

	create(req: ReportTemplateRequest): Observable<ReportTemplate> {
		return this.api
			.post<ApiResponse<ReportTemplate>, ReportTemplateRequest>(
				API.REPORTS.TEMPLATES.ROOT,
				req,
			)
			.pipe(map((env) => env.data));
	}

	update(publicUuid: string, req: ReportTemplateRequest): Observable<ReportTemplate> {
		return this.api
			.put<ApiResponse<ReportTemplate>, ReportTemplateRequest>(
				API.REPORTS.TEMPLATES.BY_ID(publicUuid),
				req,
			)
			.pipe(map((env) => env.data));
	}

	softDelete(publicUuid: string): Observable<void> {
		return this.api
			.delete<ApiResponse<unknown>>(API.REPORTS.TEMPLATES.BY_ID(publicUuid))
			.pipe(map(() => undefined));
	}
}
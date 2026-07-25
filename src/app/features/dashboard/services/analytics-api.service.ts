import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import { API } from '@core/constants';

/**
 * Point shape returned by {@code GET /v1/analytics/charts/*}.
 *
 * <p>Mirrors the BE {@code ChartSeriesResponse.Point} record
 * ({@code periodStart}, {@code periodEnd}, {@code value}) introduced in
 * Sprint cierre-A / B1.</p>
 */
export interface AnalyticsChartPoint {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly value: number;
}

export interface AnalyticsChartSeries {
  readonly metricKey: string;
  readonly points: readonly AnalyticsChartPoint[];
}

export interface AnalyticsKpiEntry {
  readonly metricKey: 'ATTENDANCE_RATE' | 'PERFORMANCE_AVG' | 'MOROSIDAD' | string;
  readonly value: number;
  readonly computedAt: string;
  readonly dimensions?: Record<string, unknown>;
}

export interface AnalyticsKpiSummary {
  readonly kpis: readonly AnalyticsKpiEntry[];
}

export interface AnalyticsKpiSummaryResponse {
  readonly data: AnalyticsKpiSummary;
}

/**
 * HTTP boundary for the analytics dashboard (Sprint cierre-A / B1 + F10).
 *
 * <p>All endpoints are tenant-scoped on the server side via the JWT
 * {@code tenant_id} claim; the FE never sends a tenant id explicitly.</p>
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
	private readonly api = inject(ApiService);

	/** Current-period KPI snapshot (attendance rate, performance avg, morosidad). */
	getKpis(): Observable<AnalyticsKpiSummary> {
		return this.api
			.get<ApiResponse<AnalyticsKpiSummary>>(API.ANALYTICS.KPIS)
			.pipe(map((env) => env.data));
	}

	/** Time series of {@code ATTENDANCE_RATE} for the given period. */
	getAttendanceSeries(from: string, to: string): Observable<AnalyticsChartSeries> {
		return this.api
			.get<ApiResponse<AnalyticsChartSeries>>(API.ANALYTICS.CHARTS_ATTENDANCE, { from, to })
			.pipe(map((env) => env.data));
	}

	/** Time series of {@code PERFORMANCE_AVG} for the given period. */
	getPerformanceSeries(from: string, to: string): Observable<AnalyticsChartSeries> {
		return this.api
			.get<ApiResponse<AnalyticsChartSeries>>(API.ANALYTICS.CHARTS_PERFORMANCE, { from, to })
			.pipe(map((env) => env.data));
	}

	/** Time series of {@code MOROSIDAD} for the given period. */
	getMorosidadSeries(from: string, to: string): Observable<AnalyticsChartSeries> {
		return this.api
			.get<ApiResponse<AnalyticsChartSeries>>(API.ANALYTICS.CHARTS_MOROSIDAD, { from, to })
			.pipe(map((env) => env.data));
	}
}
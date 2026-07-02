import { Injectable, inject } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { ApiResponse } from '@core/models/api-response.model';
import { API } from '@core/constants/api.constants';
import { Observable, map } from 'rxjs';

/**
 * AI usage service (FE-8.4).
 *
 * <p>Reads the BE-8.4 endpoints to power the TENANT_ADMIN
 * dashboard: quota meter, by-feature breakdown, daily history,
 * CSV export.</p>
 */
@Injectable({ providedIn: 'root' })
export class AiUsageService {
  private readonly api = inject(ApiService);

  /** One-shot summary (current UTC month). */
  summary(): Observable<UsageSummary> {
    return this.api.get<ApiResponse<UsageSummary>>(API.AI.USAGE_SUMMARY).pipe(map((e) => e.data));
  }

  /** CSV URL for the "Exportar CSV" button. The user clicks and the
   * browser downloads via the {@code text/csv} content-type. */
  csvDownloadUrl(): string {
    return API.AI.USAGE_EXPORT_CSV;
  }
}

export interface UsageSummary {
  periodStart: string;
  periodEnd: string;
  dailyRequestQuota: number | null;
  monthlyTokenQuota: number | null;
  usedRequests: number;
  usedTokens: number;
  successCount: number;
  failedCount: number;
  byFeature: Array<{
    feature: string;
    requestCount: number;
    tokensIn: number;
    tokensOut: number;
  }>;
  daily: Array<{
    day: string;
    requestCount: number;
    successCount: number;
    failedCount: number;
    tokensIn: number;
    tokensOut: number;
  }>;
  generatedAt: string;
}

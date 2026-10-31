import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { ReportsApiService } from '@features/reports/services/reports-api.service';
import { ReportFormat, ReportJob } from '@features/reports/models/report.model';
import {
  AttendanceReportParams,
  serializeReportParams,
} from '../models/attendance-report-params.model';

const MAX_POLL_MS = 5 * 60 * 1000;

export interface AttendanceExportResult {
  job: ReportJob;
  downloadUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AttendanceReportService {
  private readonly reportsApi = inject(ReportsApiService);
  private readonly http = inject(HttpClient);

  /**
   * Creates an async ATTENDANCE_SUMMARY job and polls until DONE/FAILED.
   */
  async requestInstitutionalExport(
    params: AttendanceReportParams,
    format: ReportFormat,
  ): Promise<AttendanceExportResult> {
    const idemKey = this.buildIdemKey(params, format);
    const job = await firstValueFrom(
      this.reportsApi.create({
        reportType: 'ATTENDANCE_SUMMARY',
        format,
        params: serializeReportParams(params),
        idemKey,
      }),
    );
    const finalJob = await this.pollUntilDone(job.publicUuid);
    if (finalJob.status !== 'DONE') {
      throw new Error(finalJob.errorMessage ?? 'No se pudo generar el reporte');
    }
    return { job: finalJob, downloadUrl: this.reportsApi.downloadUrl(finalJob.publicUuid) };
  }

  /** Triggers browser download for a completed report job. */
  downloadJob(publicUuid: string, filename: string): void {
    const url = this.reportsApi.downloadUrl(publicUuid);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.click();
  }

  /** Direct scoped export for student (/me) or parent (/family). */
  async downloadScopedAttendance(
    scope: 'me' | 'family',
    studentPublicUuid: string | null,
    from: string | undefined,
    to: string | undefined,
    format: ReportFormat,
  ): Promise<void> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    params.set('format', format);
    const qs = params.toString();
    const path =
      scope === 'me'
        ? `/api/v1/me/attendance/export?${qs}`
        : `/api/v1/family/children/${studentPublicUuid}/attendance/export?${qs}`;
    const blob = await firstValueFrom(this.http.get(path, { responseType: 'blob' }));
    const ext = format.toLowerCase() === 'xlsx' ? 'xlsx' : format.toLowerCase();
    const name =
      scope === 'me'
        ? `mi-asistencia.${ext}`
        : `asistencia-${studentPublicUuid?.slice(0, 8)}.${ext}`;
    this.saveBlob(blob, name);
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private pollUntilDone(publicUuid: string): Promise<ReportJob> {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      let sub: Subscription | null = null;
      const tick = (attempt: number): void => {
        if (Date.now() - started > MAX_POLL_MS) {
          sub?.unsubscribe();
          reject(new Error('El reporte está tardando más de lo esperado'));
          return;
        }
        sub = this.reportsApi.get(publicUuid).subscribe({
          next: (job) => {
            if (job.status === 'DONE' || job.status === 'FAILED' || job.status === 'CANCELLED') {
              sub?.unsubscribe();
              resolve(job);
              return;
            }
            const delay = [2000, 4000, 8000, 8000, 15000][Math.min(attempt, 4)];
            setTimeout(() => tick(attempt + 1), delay);
          },
          error: (err) => {
            sub?.unsubscribe();
            reject(err);
          },
        });
      };
      tick(0);
    });
  }

  private buildIdemKey(params: AttendanceReportParams, format: ReportFormat): string {
    const base = serializeReportParams(params);
    return `att-${format}-${base.slice(0, 200)}`;
  }
}

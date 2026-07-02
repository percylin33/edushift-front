import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, finalize, of, tap } from 'rxjs';
import { AttendanceDashboardOverview, DashboardWidget, Metric } from '../models';
import { DashboardApiService } from '../services/dashboard-api.service';

/**
 * Single-source-of-truth for the dashboard feature.
 *
 * <p>State is split into two logical sections:
 * <ul>
 *   <li>Legacy generic {@code metrics}/{@code widgets} signals — kept
 *       intact for forward compatibility with a future generic
 *       dashboard endpoint. Not wired to any UI today.</li>
 *   <li>Attendance {@code overview} (FE-6.4) — admin-only KPIs +
 *       widgets sourced from {@code GET /v1/attendance/dashboard/overview}.</li>
 * </ul>
 *
 * <p>Loading and error are shared; the page never displays both
 * states at once because the overview is the only thing the page
 * fetches in the current sprint.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly api = inject(DashboardApiService);

  private readonly _metrics = signal<Metric[]>([]);
  private readonly _widgets = signal<DashboardWidget[]>([]);
  private readonly _overview = signal<AttendanceDashboardOverview | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _lastLoadedAt = signal<Date | null>(null);

  readonly metrics = this._metrics.asReadonly();
  readonly widgets = this._widgets.asReadonly();
  readonly overview = this._overview.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastLoadedAt = this._lastLoadedAt.asReadonly();

  readonly isEmpty = computed(
    () => this._overview() === null && this._metrics().length === 0 && this._widgets().length === 0,
  );

  setMetrics(metrics: Metric[]): void {
    this._metrics.set(metrics);
  }

  setWidgets(widgets: DashboardWidget[]): void {
    this._widgets.set(widgets);
  }

  setLoading(value: boolean): void {
    this._loading.set(value);
  }

  setError(error: string | null): void {
    this._error.set(error);
  }

  /**
   * Fetch the admin attendance overview snapshot.
   *
   * <p>Soft-fails: a network/403 error sets {@link #error} and leaves
   * the previous {@link #overview} untouched, so a transient hiccup
   * during silent refresh does not blank the UI mid-session.
   */
  loadAttendanceOverview(): void {
    if (this._loading()) return;
    this._loading.set(true);
    this._error.set(null);

    this.api
      .getAttendanceOverview()
      .pipe(
        tap((overview) => {
          this._overview.set(overview);
          this._lastLoadedAt.set(new Date());
        }),
        catchError((err: unknown) => {
          const message =
            err instanceof Error ? err.message : 'No se pudo cargar el resumen de asistencia.';
          this._error.set(message);
          return of(null);
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  reset(): void {
    this._metrics.set([]);
    this._widgets.set([]);
    this._overview.set(null);
    this._loading.set(false);
    this._error.set(null);
    this._lastLoadedAt.set(null);
  }
}

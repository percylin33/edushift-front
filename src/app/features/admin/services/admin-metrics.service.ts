import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { TenantMetric } from '../models';
import { catchError, forkJoin, map, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminMetricsService {
  private readonly api = inject(ApiService);

  private readonly _students = signal<TenantMetric[]>([]);
  private readonly _teachers = signal<TenantMetric[]>([]);
  private readonly _storage = signal<TenantMetric[]>([]);
  private readonly _ai = signal<TenantMetric[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly students = this._students.asReadonly();
  readonly teachers = this._teachers.asReadonly();
  readonly storage = this._storage.asReadonly();
  readonly ai = this._ai.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  loadAll(): void {
    this._loading.set(true);
    this._error.set(null);

    const metric = (url: string) => this.api.get<unknown>(url).pipe(
      map((response) => ({ response, error: null as string | null })),
      catchError((err) => of({ response: null, error: err?.error?.message ?? 'Una o más métricas no pudieron cargarse.' })),
    );
    forkJoin({
      students: metric(API.ADMIN.METRICS_STUDENTS),
      teachers: metric(API.ADMIN.METRICS_TEACHERS),
      storage: metric(API.ADMIN.METRICS_STORAGE),
      ai: metric(API.ADMIN.METRICS_AI),
    }).subscribe((results) => {
      this._students.set(this.rows(results.students.response));
      this._teachers.set(this.rows(results.teachers.response));
      this._storage.set(this.rows(results.storage.response));
      this._ai.set(this.rows(results.ai.response));
      const errors = Object.values(results).map((result) => result.error).filter((value): value is string => !!value);
      this._error.set(errors.length ? [...new Set(errors)].join(' ') : null);
      this._loading.set(false);
    });
  }

  /** The API returns `{ total, byTenant }`, not the row list itself. */
  private rows(res: unknown): TenantMetric[] {
    if (Array.isArray(res)) {
      return res as TenantMetric[];
    }
    const envelope = res && typeof res === 'object' ? res as { data?: unknown } : {};
    const payload = envelope.data ?? res;
    const byTenant = payload && typeof payload === 'object' && 'byTenant' in payload
      ? (payload as { byTenant?: unknown }).byTenant
      : payload;
    return Array.isArray(byTenant) ? byTenant as TenantMetric[] : [];
  }
}

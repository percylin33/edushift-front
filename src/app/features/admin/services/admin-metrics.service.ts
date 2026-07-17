import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { TenantMetric } from '../models';

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

    this.api.get<any>(API.ADMIN.METRICS_STUDENTS).subscribe({
      next: (res) => this._students.set(res.data ?? res),
      error: () => this._students.set([]),
    });
    this.api.get<any>(API.ADMIN.METRICS_TEACHERS).subscribe({
      next: (res) => this._teachers.set(res.data ?? res),
      error: () => this._teachers.set([]),
    });
    this.api.get<any>(API.ADMIN.METRICS_STORAGE).subscribe({
      next: (res) => this._storage.set(res.data ?? res),
      error: () => this._storage.set([]),
    });
    this.api.get<any>(API.ADMIN.METRICS_AI).subscribe({
      next: (res) => this._ai.set(res.data ?? res),
      error: () => this._ai.set([]),
    });

    this._loading.set(false);
  }
}

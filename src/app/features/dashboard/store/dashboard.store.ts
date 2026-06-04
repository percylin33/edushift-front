import { Injectable, computed, signal } from '@angular/core';
import { DashboardWidget, Metric } from '../models';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly _metrics = signal<Metric[]>([]);
  private readonly _widgets = signal<DashboardWidget[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly metrics = this._metrics.asReadonly();
  readonly widgets = this._widgets.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly isEmpty = computed(() => this._metrics().length === 0 && this._widgets().length === 0);

  setMetrics(metrics: Metric[]): void { this._metrics.set(metrics); }
  setWidgets(widgets: DashboardWidget[]): void { this._widgets.set(widgets); }
  setLoading(value: boolean): void { this._loading.set(value); }
  setError(error: string | null): void { this._error.set(error); }

  reset(): void {
    this._metrics.set([]);
    this._widgets.set([]);
    this._loading.set(false);
    this._error.set(null);
  }
}

import { Injectable, computed, signal } from '@angular/core';
import { Report } from '../models';

@Injectable({ providedIn: 'root' })
export class ReportsStore {
  private readonly _items = signal<Report[]>([]);
  private readonly _generating = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly generating = this._generating.asReadonly();
  readonly error = this._error.asReadonly();

  readonly readyCount = computed(() => this._items().filter((r) => r.status === 'ready').length);
  readonly pendingCount = computed(
    () => this._items().filter((r) => r.status === 'pending' || r.status === 'generating').length,
  );

  setItems(items: Report[]): void {
    this._items.set(items);
  }
  setGenerating(value: boolean): void {
    this._generating.set(value);
  }
  setError(error: string | null): void {
    this._error.set(error);
  }

  upsert(report: Report): void {
    this._items.update((list) => {
      const index = list.findIndex((r) => r.id === report.id);
      if (index >= 0) {
        const next = list.slice();
        next[index] = report;
        return next;
      }
      return [report, ...list];
    });
  }

  reset(): void {
    this._items.set([]);
    this._generating.set(false);
    this._error.set(null);
  }
}

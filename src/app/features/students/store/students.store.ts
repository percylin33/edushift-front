import { Injectable, computed, signal } from '@angular/core';
import { Student } from '../models';

interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class StudentsStore {
  private readonly _items = signal<Student[]>([]);
  private readonly _selected = signal<Student | null>(null);
  private readonly _pagination = signal<PaginationState>({ page: 1, pageSize: 20, total: 0 });
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly selected = this._selected.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly count = computed(() => this._items().length);
  readonly hasItems = computed(() => this._items().length > 0);
  readonly totalPages = computed(() => {
    const { pageSize, total } = this._pagination();
    return pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  });

  setItems(items: Student[]): void { this._items.set(items); }
  setSelected(student: Student | null): void { this._selected.set(student); }
  setPagination(pagination: Partial<PaginationState>): void {
    this._pagination.update((current) => ({ ...current, ...pagination }));
  }
  setLoading(value: boolean): void { this._loading.set(value); }
  setError(error: string | null): void { this._error.set(error); }

  upsert(student: Student): void {
    this._items.update((list) => {
      const index = list.findIndex((s) => s.id === student.id);
      if (index >= 0) {
        const next = list.slice();
        next[index] = student;
        return next;
      }
      return [student, ...list];
    });
  }

  remove(id: string): void {
    this._items.update((list) => list.filter((s) => s.id !== id));
  }

  reset(): void {
    this._items.set([]);
    this._selected.set(null);
    this._pagination.set({ page: 1, pageSize: 20, total: 0 });
    this._loading.set(false);
    this._error.set(null);
  }
}

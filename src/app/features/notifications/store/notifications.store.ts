import { Injectable, computed, signal } from '@angular/core';
import { NotificationItem, NotificationPreferences } from '../models';

@Injectable({ providedIn: 'root' })
export class NotificationsStore {
  private readonly _items = signal<NotificationItem[]>([]);
  private readonly _preferences = signal<NotificationPreferences | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly preferences = this._preferences.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly unreadCount = computed(() => this._items().filter((n) => !n.readAt).length);

  setItems(items: NotificationItem[]): void {
    this._items.set(items);
  }
  setPreferences(preferences: NotificationPreferences | null): void {
    this._preferences.set(preferences);
  }
  setLoading(value: boolean): void {
    this._loading.set(value);
  }
  setError(error: string | null): void {
    this._error.set(error);
  }

  markRead(id: string): void {
    this._items.update((list) =>
      list.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
    );
  }
  markAllRead(): void {
    const now = new Date().toISOString();
    this._items.update((list) => list.map((n) => (n.readAt ? n : { ...n, readAt: now })));
  }

  reset(): void {
    this._items.set([]);
    this._preferences.set(null);
    this._loading.set(false);
    this._error.set(null);
  }
}

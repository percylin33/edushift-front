import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title?: string;
  message: string;
  timeout?: number;
}

/**
 * Lightweight in-memory toast/notification queue. UI layer can subscribe to
 * the `messages` signal to render toasts. Replace later with a real toast lib.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _messages = signal<AppNotification[]>([]);
  readonly messages = this._messages.asReadonly();

  push(notification: Omit<AppNotification, 'id'>): string {
    const id = crypto.randomUUID();
    const next: AppNotification = { id, timeout: 4000, ...notification };
    this._messages.update((list) => [...list, next]);
    if (next.timeout && next.timeout > 0) {
      setTimeout(() => this.dismiss(id), next.timeout);
    }
    return id;
  }

  success(message: string, title?: string): string {
    return this.push({ kind: 'success', message, title });
  }

  info(message: string, title?: string): string {
    return this.push({ kind: 'info', message, title });
  }

  warning(message: string, title?: string): string {
    return this.push({ kind: 'warning', message, title });
  }

  error(message: string, title?: string): string {
    return this.push({ kind: 'error', message, title });
  }

  dismiss(id: string): void {
    this._messages.update((list) => list.filter((n) => n.id !== id));
  }

  clear(): void {
    this._messages.set([]);
  }
}

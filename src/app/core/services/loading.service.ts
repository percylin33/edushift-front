import { Injectable, computed, signal } from '@angular/core';

/**
 * Global pending-requests counter. Increment/decrement from the HTTP loading
 * interceptor (or anywhere) and bind UI to the `loading` signal.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = signal(0);

  readonly loading = computed(() => this.pending() > 0);

  start(): void {
    this.pending.update((n) => n + 1);
  }

  stop(): void {
    this.pending.update((n) => Math.max(0, n - 1));
  }

  reset(): void {
    this.pending.set(0);
  }
}

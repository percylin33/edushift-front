import { Injectable, computed, signal } from '@angular/core';

/**
 * Local UI state for the auth feature (loading flag, last error, etc.).
 * The session (`user`, `token`) lives in `AuthService` (core) because it is
 * needed by guards and interceptors that should not depend on a feature.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly hasError = computed(() => this._error() !== null);

  setLoading(value: boolean): void {
    this._loading.set(value);
  }

  setError(error: string | null): void {
    this._error.set(error);
  }

  reset(): void {
    this._loading.set(false);
    this._error.set(null);
  }
}

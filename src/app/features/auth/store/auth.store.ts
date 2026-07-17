import { Injectable, computed, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { mapHttpError, HttpErrorOptions } from '@shared/utils';

/**
 * Local UI state for the auth feature (loading flag, last error, etc.).
 * The session (`user`, `token`) lives in `AuthService` (core) because it is
 * needed by guards and interceptors that should not depend on a feature.
 *
 * <p>Convenience helpers {@link #beginSubmit} / {@link #failSubmit} collapse
 * the "setLoading(true) + setError(null)" / "setLoading(false) + setError(msg)"
 * two-liner that's repeated in every form's submit handler.
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

  /** Equivalent to `setLoading(true) + setError(null)`. */
  beginSubmit(): void {
    this._loading.set(true);
    this._error.set(null);
  }

  /** Equivalent to `setLoading(false) + setError(mapHttpError(err))`. */
  failSubmit(err: HttpErrorResponse, opts?: HttpErrorOptions): void {
    this._loading.set(false);
    this._error.set(mapHttpError(err, opts));
  }

  reset(): void {
    this._loading.set(false);
    this._error.set(null);
  }
}
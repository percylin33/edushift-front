import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GradeBookApiService } from '../services';
import { GradeBook } from '../models';

/**
 * Reactive store del feature {@code gradebook} (FE-5B.4).
 *
 * <p>Una sola operación: cargar el snapshot de la matriz para un
 * teacher assignment. No hay mutaciones — los GradeRecords se editan
 * desde la página dedicada (FE-5B.3) y el gradebook se vuelve a leer al
 * volver.</p>
 */
@Injectable({ providedIn: 'root' })
export class GradeBookStore {
  private readonly api = inject(GradeBookApiService);

  private readonly _gradebook = signal<GradeBook | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly gradebook = this._gradebook.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isEmpty = computed(() => {
    const gb = this._gradebook();
    return (
      !this._loading() &&
      !!gb &&
      gb.students.length === 0 &&
      gb.evaluations.length === 0
    );
  });

  /** Suma de pesos de las evaluations PUBLISHED+CLOSED con scale numeric. */
  readonly totalWeight = computed(() => {
    const gb = this._gradebook();
    if (!gb) return 0;
    return gb.evaluations
      .filter((e) => e.status !== 'DRAFT')
      .reduce((acc, e) => acc + e.weight, 0);
  });

  async load(assignmentPublicUuid: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const gb = await firstValueFrom(
        this.api.getByAssignment(assignmentPublicUuid)
      );
      this._gradebook.set(gb);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._gradebook.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  clear(): void {
    this._gradebook.set(null);
    this._error.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as {
        message?: unknown;
        error?: { message?: unknown };
      };
      if (typeof anyErr.error?.message === 'string') return anyErr.error.message;
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'Ocurrió un error inesperado.';
  }
}

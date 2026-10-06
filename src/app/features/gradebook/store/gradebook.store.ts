import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GradeBookApiService } from '../services';
import {
  GradeBook,
  GradeBookCell,
  GradeBookQuery,
  cellKey,
} from '../models';

/**
 * Reactive store del feature {@code gradebook} (FE-5B.4 / F1b–F4).
 */
@Injectable({ providedIn: 'root' })
export class GradeBookStore {
  private readonly api = inject(GradeBookApiService);

  private readonly _gradebook = signal<GradeBook | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _includeWithdrawn = signal(false);
  private readonly _includeTransferred = signal(false);
  private readonly _exporting = signal<'xlsx' | 'pdf' | null>(null);
  private readonly _savingCell = signal<string | null>(null);

  readonly gradebook = this._gradebook.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly includeWithdrawn = this._includeWithdrawn.asReadonly();
  readonly includeTransferred = this._includeTransferred.asReadonly();
  readonly exporting = this._exporting.asReadonly();
  readonly savingCell = this._savingCell.asReadonly();

  readonly isEmpty = computed(() => {
    const gb = this._gradebook();
    return !this._loading() && !!gb && gb.students.length === 0 && gb.evaluations.length === 0;
  });

  /** Suma de pesos de las evaluations PUBLISHED+CLOSED con scale numeric. */
  readonly totalWeight = computed(() => {
    const gb = this._gradebook();
    if (!gb) return 0;
    return gb.evaluations.filter((e) => e.status !== 'DRAFT').reduce((acc, e) => acc + e.weight, 0);
  });

  private query(): GradeBookQuery {
    return {
      includeWithdrawn: this._includeWithdrawn(),
      includeTransferred: this._includeTransferred(),
    };
  }

  async load(assignmentPublicUuid: string): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const gb = await firstValueFrom(
        this.api.getByAssignment(assignmentPublicUuid, this.query()),
      );
      this._gradebook.set(gb);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._gradebook.set(null);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Recarga sin spinner — para no romper el foco al guardar celdas en cadena.
   */
  async refreshQuiet(assignmentPublicUuid: string): Promise<void> {
    try {
      const gb = await firstValueFrom(
        this.api.getByAssignment(assignmentPublicUuid, this.query()),
      );
      this._gradebook.set(gb);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
    }
  }

  async setIncludeWithdrawn(value: boolean, assignmentUuid: string): Promise<void> {
    this._includeWithdrawn.set(value);
    await this.load(assignmentUuid);
  }

  async setIncludeTransferred(value: boolean, assignmentUuid: string): Promise<void> {
    this._includeTransferred.set(value);
    await this.load(assignmentUuid);
  }

  /**
   * Actualiza la celda en memoria tras un upsert exitoso (sin reload completo).
   */
  patchCellScore(
    studentPublicUuid: string,
    evaluationPublicUuid: string,
    score: number | null,
  ): void {
    const gb = this._gradebook();
    if (!gb) return;
    const key = cellKey(studentPublicUuid, evaluationPublicUuid);
    const nextIndex = new Map(gb.cellIndex);
    const prev = nextIndex.get(key);
    const nextCell: GradeBookCell = {
      studentPublicUuid,
      evaluationPublicUuid,
      score,
      literal: null,
      recordedAt: new Date(),
    };
    if (score === null && !prev) {
      nextIndex.delete(key);
    } else {
      nextIndex.set(key, { ...prev, ...nextCell, literal: prev?.literal ?? null });
    }
    this._gradebook.set({ ...gb, cellIndex: nextIndex });
  }

  setSavingCell(key: string | null): void {
    this._savingCell.set(key);
  }

  async exportXlsx(assignmentPublicUuid: string): Promise<void> {
    await this.download(
      'xlsx',
      () => firstValueFrom(this.api.exportXlsx(assignmentPublicUuid, this.query())),
      'registro-notas.xlsx',
    );
  }

  async exportPdf(assignmentPublicUuid: string): Promise<void> {
    await this.download(
      'pdf',
      () => firstValueFrom(this.api.exportPdf(assignmentPublicUuid, this.query())),
      'registro-notas.pdf',
    );
  }

  clear(): void {
    this._gradebook.set(null);
    this._error.set(null);
    this._includeWithdrawn.set(false);
    this._includeTransferred.set(false);
    this._exporting.set(null);
    this._savingCell.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  private async download(
    kind: 'xlsx' | 'pdf',
    fetchBlob: () => Promise<Blob>,
    filename: string,
  ): Promise<void> {
    this._exporting.set(kind);
    this._error.set(null);
    try {
      const blob = await fetchBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
    } finally {
      this._exporting.set(null);
    }
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

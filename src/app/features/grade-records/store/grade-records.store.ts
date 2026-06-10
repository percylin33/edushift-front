import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GradeRecordsApiService } from '../services';
import {
  BulkGradeRecordSummary,
  CreateGradeRecordRequest,
  GradeRecordDetail,
  GradeRecordFilters,
  GradeRecordRow,
  UpdateGradeRecordRequest
} from '../models';

/**
 * Reactive store del feature {@code grade-records} (FE-5B.3).
 *
 * <h3>Slices</h3>
 * <ul>
 *   <li><b>List</b> — la grilla de notas para una evaluation. El store
 *       mantiene {@link #_currentEvaluationUuid} para que cambios de
 *       filtros se re-fetcheen sobre la misma evaluation.</li>
 *   <li><b>Busy rows</b> — set de UUIDs en operación (PUT / DELETE) para
 *       que el inline-edit muestre un spinner local sin bloquear el resto
 *       de la tabla.</li>
 *   <li><b>Bulk</b> — outcome del último bulk upsert (para mostrar al
 *       usuario "X creadas / Y actualizadas").</li>
 * </ul>
 *
 * <p>Las operaciones de mutación devuelven la entidad nueva (o
 * {@code null} en error) para que los components decidan: cerrar el
 * modal, refrescar el banner, etc. Los errores se exponen en
 * {@link #error} como string legible.</p>
 */
@Injectable({ providedIn: 'root' })
export class GradeRecordsStore {
  private readonly api = inject(GradeRecordsApiService);

  // -------- list slice --------
  private readonly _rows = signal<GradeRecordRow[]>([]);
  private readonly _filters = signal<GradeRecordFilters>({});
  private readonly _currentEvaluationUuid = signal<string | null>(null);
  private readonly _loading = signal<boolean>(false);

  // -------- per-row busy --------
  private readonly _busyRowUuids = signal<Set<string>>(new Set());

  // -------- bulk feedback --------
  private readonly _lastBulk = signal<BulkGradeRecordSummary | null>(null);

  // -------- shared --------
  private readonly _saving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly rows = this._rows.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly currentEvaluationUuid = this._currentEvaluationUuid.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly busyRowUuids = this._busyRowUuids.asReadonly();
  readonly lastBulk = this._lastBulk.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasRows = computed(() => this._rows().length > 0);
  readonly isEmpty = computed(
    () => !this._loading() && this._rows().length === 0
  );

  /** Conteo rápido para el header de la tabla. */
  readonly counts = computed(() => {
    const rows = this._rows();
    return {
      total: rows.length,
      active: rows.filter((r) => r.isActive).length
    };
  });

  // ===========================================================================
  // List
  // ===========================================================================

  async loadByEvaluation(
    evaluationPublicUuid: string,
    filters: GradeRecordFilters = {}
  ): Promise<void> {
    this._currentEvaluationUuid.set(evaluationPublicUuid);
    this._filters.set({ ...filters });
    await this.fetchRows();
  }

  async setFilters(filters: GradeRecordFilters): Promise<void> {
    this._filters.set({ ...filters });
    await this.fetchRows();
  }

  async clearFilters(): Promise<void> {
    this._filters.set({});
    await this.fetchRows();
  }

  // ===========================================================================
  // Single upsert
  // ===========================================================================

  async upsert(
    evaluationPublicUuid: string,
    request: CreateGradeRecordRequest
  ): Promise<GradeRecordDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(
        this.api.upsertGrade(evaluationPublicUuid, request)
      );
      this.upsertRow(detail);
      return detail;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Update by publicUuid (inline edit)
  // ===========================================================================

  async update(
    publicUuid: string,
    patch: UpdateGradeRecordRequest
  ): Promise<GradeRecordDetail | null> {
    this.markRowBusy(publicUuid, true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.updateGrade(publicUuid, patch));
      this.upsertRow(detail);
      return detail;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this.markRowBusy(publicUuid, false);
    }
  }

  // ===========================================================================
  // Bulk
  // ===========================================================================

  async bulkUpsert(
    evaluationPublicUuid: string,
    rows: CreateGradeRecordRequest[]
  ): Promise<BulkGradeRecordSummary | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const summary = await firstValueFrom(
        this.api.bulkUpsert(evaluationPublicUuid, { records: rows })
      );
      summary.records.forEach((r) => this.upsertRow(r));
      this._lastBulk.set(summary);
      return summary;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  clearBulkSummary(): void {
    this._lastBulk.set(null);
  }

  // ===========================================================================
  // Delete
  // ===========================================================================

  async remove(publicUuid: string): Promise<boolean> {
    this.markRowBusy(publicUuid, true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.deleteGrade(publicUuid));
      this._rows.update((rows) =>
        rows.filter((r) => r.publicUuid !== publicUuid)
      );
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this.markRowBusy(publicUuid, false);
    }
  }

  // ===========================================================================
  // Housekeeping
  // ===========================================================================

  clear(): void {
    this._rows.set([]);
    this._filters.set({});
    this._currentEvaluationUuid.set(null);
    this._busyRowUuids.set(new Set());
    this._lastBulk.set(null);
    this._error.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async fetchRows(): Promise<void> {
    const uuid = this._currentEvaluationUuid();
    if (!uuid) return;
    this._loading.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(
        this.api.listByEvaluation(uuid, this._filters())
      );
      this._rows.set(rows);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._rows.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  private upsertRow(detail: GradeRecordDetail): void {
    const row: GradeRecordRow = {
      publicUuid: detail.publicUuid,
      studentPublicUuid: detail.studentPublicUuid,
      studentFullName: detail.studentFullName,
      studentFirstName: detail.studentFirstName,
      studentLastName: detail.studentLastName,
      score: detail.score,
      literal: detail.literal,
      comments: detail.comments,
      recordedAt: detail.recordedAt,
      isActive: detail.isActive,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    };
    this._rows.update((rows) => {
      const idx = rows.findIndex((r) => r.publicUuid === row.publicUuid);
      if (idx === -1) return [row, ...rows];
      const next = rows.slice();
      next[idx] = row;
      return next;
    });
  }

  private markRowBusy(publicUuid: string, busy: boolean): void {
    const set = new Set(this._busyRowUuids());
    if (busy) set.add(publicUuid);
    else set.delete(publicUuid);
    this._busyRowUuids.set(set);
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

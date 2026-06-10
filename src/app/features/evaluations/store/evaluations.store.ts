import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RubricDetail } from '@features/rubrics/models';
import { EvaluationsApiService } from '../services';
import {
  CreateEvaluationRequest,
  EvaluationDetail,
  EvaluationFilters,
  EvaluationRow,
  EvaluationStatus,
  UpdateEvaluationRequest
} from '../models';

/**
 * Reactive store del feature {@code evaluations} (FE-5B.1).
 *
 * <h3>Slices</h3>
 * <ol>
 *   <li><b>By-assignment list</b> — la grilla de evaluations dentro
 *       del listing por assignment. Mantiene {@link #_currentAssignmentUuid}
 *       para que cambios de filtros re-fetcheen sobre el mismo
 *       assignment sin volver a pasar el id.</li>
 *   <li><b>Selected detail</b> — la evaluation que se está editando o
 *       inspeccionando en el detail. Se setea por
 *       {@link #loadDetail} y se mantiene sincronizada con cada
 *       lifecycle hop (publish / close).</li>
 * </ol>
 *
 * <p>Todos los signals son <em>reactivos</em> y triggers de cambio
 * (`computed`) viven aquí en lugar de los components — eso permite
 * que un mismo cambio se propague tanto al listing como al detail
 * cuando ambos están abiertos (e.g. el modal de edición arriba del
 * listing).</p>
 */
@Injectable({ providedIn: 'root' })
export class EvaluationsStore {
  private readonly api = inject(EvaluationsApiService);

  // -------- by-assignment slice --------
  private readonly _rows = signal<EvaluationRow[]>([]);
  private readonly _filters = signal<EvaluationFilters>({});
  private readonly _currentAssignmentUuid = signal<string | null>(null);
  private readonly _loading = signal<boolean>(false);

  // -------- detail slice --------
  private readonly _selected = signal<EvaluationDetail | null>(null);
  private readonly _loadingDetail = signal<boolean>(false);

  // -------- attached rubric slice (FE-5B.5) --------
  private readonly _attachedRubric = signal<RubricDetail | null>(null);
  private readonly _loadingRubric = signal<boolean>(false);

  // -------- shared --------
  private readonly _saving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly rows = this._rows.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly currentAssignmentUuid = this._currentAssignmentUuid.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();

  readonly attachedRubric = this._attachedRubric.asReadonly();
  readonly loadingRubric = this._loadingRubric.asReadonly();
  readonly hasAttachedRubric = computed(() => this._attachedRubric() !== null);

  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasRows = computed(() => this._rows().length > 0);
  readonly isEmpty = computed(
    () => !this._loading() && this._rows().length === 0
  );

  /**
   * Suma de pesos de evaluations PUBLISHED + CLOSED. Útil para alertar
   * al docente cuando el total ≠ 100 (no es un constraint server-side
   * pero sí best practice pedagógica).
   */
  readonly weightTotalLive = computed(() =>
    this._rows()
      .filter((r) => r.status !== EvaluationStatus.DRAFT)
      .reduce((acc, r) => acc + r.weight, 0)
  );

  // ===========================================================================
  // List
  // ===========================================================================

  async loadByAssignment(
    assignmentPublicUuid: string,
    filters: EvaluationFilters = {}
  ): Promise<void> {
    this._currentAssignmentUuid.set(assignmentPublicUuid);
    this._filters.set({ ...filters });
    await this.fetchRows();
  }

  async setFilters(filters: EvaluationFilters): Promise<void> {
    this._filters.set({ ...filters });
    await this.fetchRows();
  }

  async clearFilters(): Promise<void> {
    this._filters.set({});
    await this.fetchRows();
  }

  // ===========================================================================
  // Create
  // ===========================================================================

  async create(
    assignmentPublicUuid: string,
    request: CreateEvaluationRequest
  ): Promise<EvaluationDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const created = await firstValueFrom(
        this.api.createForAssignment(assignmentPublicUuid, request)
      );
      if (this._currentAssignmentUuid() === assignmentPublicUuid) {
        this._rows.update((rows) => [this.toRow(created), ...rows]);
      }
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Detail / patch / lifecycle
  // ===========================================================================

  async loadDetail(publicUuid: string): Promise<EvaluationDetail | null> {
    this._loadingDetail.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.getEvaluation(publicUuid));
      this._selected.set(detail);
      return detail;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._selected.set(null);
      return null;
    } finally {
      this._loadingDetail.set(false);
    }
  }

  async update(
    publicUuid: string,
    patch: UpdateEvaluationRequest
  ): Promise<EvaluationDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const updated = await firstValueFrom(
        this.api.updateEvaluation(publicUuid, patch)
      );
      this.replaceInRows(updated);
      this._selected.set(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async publish(publicUuid: string): Promise<EvaluationDetail | null> {
    return this.lifecycleHop(publicUuid, () =>
      firstValueFrom(this.api.publishEvaluation(publicUuid))
    );
  }

  async close(publicUuid: string): Promise<EvaluationDetail | null> {
    return this.lifecycleHop(publicUuid, () =>
      firstValueFrom(this.api.closeEvaluation(publicUuid))
    );
  }

  async remove(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.deleteEvaluation(publicUuid));
      this._rows.update((rows) => rows.filter((r) => r.publicUuid !== publicUuid));
      if (this._selected()?.publicUuid === publicUuid) {
        this._selected.set(null);
      }
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Rubric attachment (FE-5B.5)
  // ===========================================================================

  /**
   * Carga la rúbrica vinculada a la evaluation actual. 404
   * `EVAL_RUBRIC_NOT_SET` se traduce a `null` (no es error de UX).
   */
  async loadAttachedRubric(evaluationPublicUuid: string): Promise<void> {
    this._loadingRubric.set(true);
    this._error.set(null);
    try {
      const rubric = await firstValueFrom(
        this.api.getAttachedRubric(evaluationPublicUuid)
      );
      this._attachedRubric.set(rubric);
    } catch (err) {
      // El 404 EVAL_RUBRIC_NOT_SET no es un error real, sólo significa
      // "no hay rubric vinculada".
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this._attachedRubric.set(null);
      } else {
        this._error.set(this.toErrorMessage(err));
        this._attachedRubric.set(null);
      }
    } finally {
      this._loadingRubric.set(false);
    }
  }

  async attachRubric(
    evaluationPublicUuid: string,
    rubricPublicUuid: string
  ): Promise<RubricDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const rubric = await firstValueFrom(
        this.api.attachRubric(evaluationPublicUuid, rubricPublicUuid)
      );
      this._attachedRubric.set(rubric);
      return rubric;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async detachRubric(evaluationPublicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.detachRubric(evaluationPublicUuid));
      this._attachedRubric.set(null);
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Housekeeping
  // ===========================================================================

  clear(): void {
    this._rows.set([]);
    this._filters.set({});
    this._currentAssignmentUuid.set(null);
    this._selected.set(null);
    this._attachedRubric.set(null);
  }

  clearSelected(): void {
    this._selected.set(null);
    this._attachedRubric.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async fetchRows(): Promise<void> {
    const assignmentUuid = this._currentAssignmentUuid();
    if (!assignmentUuid) return;
    this._loading.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(
        this.api.listByAssignment(assignmentUuid, this._filters())
      );
      this._rows.set(rows);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._rows.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  private async lifecycleHop(
    publicUuid: string,
    op: () => Promise<EvaluationDetail>
  ): Promise<EvaluationDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const updated = await op();
      this.replaceInRows(updated);
      if (this._selected()?.publicUuid === publicUuid) {
        this._selected.set(updated);
      }
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  private replaceInRows(detail: EvaluationDetail): void {
    this._rows.update((rows) =>
      rows.map((r) => (r.publicUuid === detail.publicUuid ? this.toRow(detail) : r))
    );
  }

  private toRow(detail: EvaluationDetail): EvaluationRow {
    return {
      publicUuid: detail.publicUuid,
      kind: detail.kind,
      name: detail.name,
      weight: detail.weight,
      scheduledDate: detail.scheduledDate,
      dueDate: detail.dueDate,
      scale: detail.scale,
      status: detail.status,
      gradeCount: detail.gradeCount,
      isActive: detail.isActive,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt
    };
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

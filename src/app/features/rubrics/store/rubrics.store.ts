import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RubricsApiService } from '../services';
import {
  CreateRubricRequest,
  RubricDetail,
  RubricFilters,
  RubricRow,
  UpdateRubricRequest,
} from '../models';

/**
 * Reactive store del feature {@code rubrics} (FE-5B.2).
 *
 * <h3>Slices</h3>
 * <ol>
 *   <li><b>List</b> — la grilla de rúbricas con filtros server-side
 *       (systemOnly, isActive, q). Carga lazy desde {@code rubrics-list.page}.</li>
 *   <li><b>Selected detail</b> — la rúbrica abierta en el form de edición.</li>
 * </ol>
 *
 * <p>Las rúbricas {@code isSystem=true} son read-only por contrato; el
 * store no aplica ningún cliente-side filter, sólo expone {@link #hasSystemRubrics}
 * para que la list page pueda renderizar el banner "Cargar MINEDU"
 * cuando el tenant está vacío.</p>
 */
@Injectable({ providedIn: 'root' })
export class RubricsStore {
  private readonly api = inject(RubricsApiService);

  // -------- list slice --------
  private readonly _rows = signal<RubricRow[]>([]);
  private readonly _filters = signal<RubricFilters>({});
  private readonly _loading = signal<boolean>(false);
  private readonly _seededOnce = signal<boolean>(false);

  // -------- detail slice --------
  private readonly _selected = signal<RubricDetail | null>(null);
  private readonly _loadingDetail = signal<boolean>(false);

  // -------- shared --------
  private readonly _saving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly rows = this._rows.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();

  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasRows = computed(() => this._rows().length > 0);
  readonly hasSystemRubrics = computed(() => this._rows().some((r) => r.isSystem));
  readonly hasUserRubrics = computed(() => this._rows().some((r) => !r.isSystem));
  readonly isEmpty = computed(() => !this._loading() && this._rows().length === 0);

  // ===========================================================================
  // List
  // ===========================================================================

  async load(filters: RubricFilters = {}): Promise<void> {
    this._filters.set({ ...filters });
    await this.fetchRows();
  }

  async setFilters(filters: RubricFilters): Promise<void> {
    this._filters.set({ ...filters });
    await this.fetchRows();
  }

  async clearFilters(): Promise<void> {
    this._filters.set({});
    await this.fetchRows();
  }

  /**
   * Trae el catálogo MINEDU (BE-5B.2 hace seed on-demand en la primera
   * llamada del tenant). Después actualiza el snapshot del listing si
   * hace falta.
   */
  async loadSystemRubrics(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.listSystemRubrics());
      this._seededOnce.set(true);
      // Refrescamos el listing principal para incluir las nuevas system.
      await this.fetchRows();
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  // ===========================================================================
  // Create / fork / update / delete
  // ===========================================================================

  async create(request: CreateRubricRequest): Promise<RubricDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const created = await firstValueFrom(this.api.createRubric(request));
      this._rows.update((rows) => [this.toRow(created), ...rows]);
      this._selected.set(created);
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async fork(
    publicUuid: string,
    request?: Partial<CreateRubricRequest>,
  ): Promise<RubricDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const forked = await firstValueFrom(this.api.forkRubric(publicUuid, request));
      this._rows.update((rows) => [this.toRow(forked), ...rows]);
      return forked;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async loadDetail(publicUuid: string): Promise<RubricDetail | null> {
    this._loadingDetail.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.getRubric(publicUuid));
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

  async update(publicUuid: string, patch: UpdateRubricRequest): Promise<RubricDetail | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const updated = await firstValueFrom(this.api.updateRubric(publicUuid, patch));
      this._rows.update((rows) =>
        rows.map((r) => (r.publicUuid === publicUuid ? this.toRow(updated) : r)),
      );
      this._selected.set(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async remove(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.deleteRubric(publicUuid));
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

  clearError(): void {
    this._error.set(null);
  }

  clearSelected(): void {
    this._selected.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async fetchRows(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listRubrics(this._filters()));
      this._rows.set(rows);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._rows.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  private toRow(detail: RubricDetail): RubricRow {
    return {
      publicUuid: detail.publicUuid,
      name: detail.name,
      description: detail.description,
      isSystem: detail.isSystem,
      parentRubricPublicUuid: detail.parentRubricPublicUuid,
      criterionCount: detail.criteria.length,
      criterionSummary: detail.criteria.map((c) => `${c.weight}% ${c.name}`),
      isActive: detail.isActive,
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
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

import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AcademicApiService } from '../services';
import {
  CapacityDetail,
  CompetencyDetail,
  CompetencyRow,
  CreateCapacityRequest,
  CreateCompetencyRequest,
  UpdateCapacityRequest,
  UpdateCompetencyRequest,
} from '../models';

/**
 * Store dedicado para Competencies + Capacities (FE-5A.2).
 *
 * <p>Se mantiene separado del {@code AcademicStore} global porque su
 * ciclo de vida es por-página (dentro del tab "Competencias" de
 * {@code course-detail}) y se descarta con {@code reset()} al
 * desmontar el componente.</p>
 *
 * <h3>Estado</h3>
 * <ul>
 *   <li>{@code _courseUuid}: UUID del curso padre.</li>
 *   <li>{@code _competencies}: Lista plana de competencias (con
 *       capacities embebidas) ordenada por {@code displayOrder}.</li>
 *   <li>{@code _loading}, {@code _saving}, {@code _error}: flags de
 *       estado de la operación.</li>
 * </ul>
 *
 * <h3>Operaciones</h3>
 * <ul>
 *   <li>{@code loadCompetencies(courseUuid, { force? })}: idempotente.</li>
 *   <li>{@code createCompetency}, {@code updateCompetency}, {@code deleteCompetency}:
 *       upsertean o remueven del slice en memoria sin re-fetch.</li>
 *   <li>{@code createCapacity}, {@code updateCapacity}, {@code deleteCapacity}:
 *       mutan la competencia padre en memoria.</li>
 *   <li>{@code optimisticReorder} + {@code commitReorder}: igual que
 *       {@code UnitsStore}.</li>
 *   <li>{@code seedCompetencies}: invoca el endpoint y recarga si tuvo éxito.</li>
 * </ul>
 */
@Injectable({ providedIn: 'root' })
export class CompetenciesStore {
  private readonly api = inject(AcademicApiService);

  private readonly _courseUuid = signal<string | null>(null);
  private readonly _competencies = signal<CompetencyRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly courseUuid = this._courseUuid.asReadonly();
  readonly competencies = this._competencies.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasCompetencies = computed(() => this._competencies().length > 0);
  readonly isEmpty = computed(() => !this.loading() && this._competencies().length === 0);

  /**
   * Carga las competencias del curso. Idempotente: si ya están cargadas
   * y {@code force} es false, no hace nada.
   */
  async loadCompetencies(courseUuid: string, { force = false } = {}): Promise<void> {
    if (!force && this._courseUuid() === courseUuid && this._competencies().length > 0) {
      return;
    }
    this._courseUuid.set(courseUuid);
    this._loading.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listCompetencies(courseUuid));
      this._competencies.set(rows);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
    } finally {
      this._loading.set(false);
    }
  }

  reset(): void {
    this._courseUuid.set(null);
    this._competencies.set([]);
    this._loading.set(false);
    this._saving.set(false);
    this._error.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  async createCompetency(request: CreateCompetencyRequest): Promise<boolean> {
    const courseUuid = this._courseUuid();
    if (!courseUuid) return false;
    this._saving.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.createCompetency(courseUuid, request));
      this.upsertCompetency(detail);
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async updateCompetency(publicUuid: string, patch: UpdateCompetencyRequest): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.updateCompetency(publicUuid, patch));
      this.upsertCompetency(detail);
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async deleteCompetency(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.deleteCompetency(publicUuid));
      this._competencies.update((list) => list.filter((c) => c.publicUuid !== publicUuid));
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async createCapacity(competencyUuid: string, request: CreateCapacityRequest): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.createCapacity(competencyUuid, request));
      this.upsertCapacity(competencyUuid, detail);
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async updateCapacity(publicUuid: string, patch: UpdateCapacityRequest): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const detail = await firstValueFrom(this.api.updateCapacity(publicUuid, patch));
      this.upsertCapacity(detail.competency.publicUuid, detail);
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  async deleteCapacity(publicUuid: string, competencyUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.deleteCapacity(publicUuid));
      this._competencies.update((list) =>
        list.map((c) =>
          c.publicUuid === competencyUuid
            ? { ...c, capacities: c.capacities.filter((cap) => cap.publicUuid !== publicUuid) }
            : c,
        ),
      );
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Reorder optimista: aplica el orden en memoria y guarda un snapshot.
   * Luego llama a {@code commitReorder}.
   */
  private _reorderSnapshot: CompetencyRow[] | null = null;

  optimisticReorder(orderedUuids: string[]): void {
    const current = this._competencies();
    const ordered = orderedUuids
      .map((uuid) => current.find((c) => c.publicUuid === uuid))
      .filter((c): c is CompetencyRow => c !== undefined);

    this._reorderSnapshot = [...current];
    this._competencies.set(ordered.map((c, i) => ({ ...c, displayOrder: i + 1 })));
  }

  async commitReorder(): Promise<boolean> {
    const courseUuid = this._courseUuid();
    const snapshot = this._reorderSnapshot;
    if (!courseUuid || !snapshot) return false;

    this._saving.set(true);
    this._error.set(null);
    try {
      const items = this._competencies().map((c, i) => ({
        publicUuid: c.publicUuid,
        displayOrder: i + 1,
      }));
      await firstValueFrom(this.api.reorderCompetencies(courseUuid, { items }));
      this._reorderSnapshot = null;
      return true;
    } catch (err) {
      this._competencies.set(snapshot);
      this._reorderSnapshot = null;
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  rollbackReorder(): void {
    if (this._reorderSnapshot) {
      this._competencies.set(this._reorderSnapshot);
      this._reorderSnapshot = null;
    }
  }

  async seedCompetencies(): Promise<boolean> {
    const courseUuid = this._courseUuid();
    if (!courseUuid) return false;
    this._saving.set(true);
    this._error.set(null);
    try {
      const res = await firstValueFrom(this.api.seedCompetencies(courseUuid));
      if (res.seeded) {
        await this.loadCompetencies(courseUuid, { force: true });
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
  // Private helpers
  // ===========================================================================

  private upsertCompetency(detail: CompetencyDetail): void {
    this._competencies.update((list) => {
      const idx = list.findIndex((c) => c.publicUuid === detail.publicUuid);
      const row: CompetencyRow = {
        publicUuid: detail.publicUuid,
        code: detail.code,
        name: detail.name,
        displayOrder: detail.displayOrder,
        isActive: detail.isActive,
        capacityCount: detail.capacities.length,
        capacities: detail.capacities.map((cap) => ({
          publicUuid: cap.publicUuid,
          code: cap.code,
          name: cap.name,
          displayOrder: cap.displayOrder,
          isActive: cap.isActive,
          competency: cap.competency,
          createdAt: cap.createdAt,
          updatedAt: cap.updatedAt,
        })),
      };
      if (idx === -1) {
        const newList = [...list, row];
        return newList.sort((a, b) => a.displayOrder - b.displayOrder);
      }
      const newList = [...list];
      newList[idx] = row;
      return newList.sort((a, b) => a.displayOrder - b.displayOrder);
    });
  }

  private upsertCapacity(competencyUuid: string, detail: CapacityDetail): void {
    this._competencies.update((list) =>
      list.map((c) => {
        if (c.publicUuid !== competencyUuid) return c;
        const idx = c.capacities.findIndex((cap) => cap.publicUuid === detail.publicUuid);
        const newRow = {
          publicUuid: detail.publicUuid,
          code: detail.code,
          name: detail.name,
          displayOrder: detail.displayOrder,
          isActive: detail.isActive,
          description: detail.description,
          competency: detail.competency,
          createdAt: detail.createdAt,
          updatedAt: detail.updatedAt,
        };
        const newCapacities = [...c.capacities];
        if (idx === -1) {
          newCapacities.push(newRow);
        } else {
          newCapacities[idx] = newRow;
        }
        return {
          ...c,
          capacityCount: newCapacities.length,
          capacities: newCapacities.sort((a, b) => a.displayOrder - b.displayOrder),
        };
      }),
    );
  }

  private toErrorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = err as { error?: { message?: string; code?: string } };
      return e.error?.message || e.error?.code || 'Error desconocido';
    }
    return err instanceof Error ? err.message : 'Error de red';
  }
}

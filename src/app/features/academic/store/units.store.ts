import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AcademicApiService } from '../services';
import { CreateUnitRequest, UnitDetail, UnitRow, UpdateUnitRequest } from '../models';

/**
 * Reactive façade sobre {@link AcademicApiService} dedicado al slice
 * de unidades dentro de un curso (BE-5A.1 / FE-5A.1).
 *
 * <h3>Por qué un store separado del {@code AcademicStore}</h3>
 * El store grande de academic ya cubre 5 sub-módulos (years, levels,
 * sections, courses, periods). Las unidades viven debajo de un curso
 * <em>específico</em>: el {@link CourseDetailComponent} carga el set
 * cuando el tab "Unidades" se monta y lo descarta cuando navega
 * fuera. Mantener ese ciclo de vida en un store dedicado evita
 * inflar el global con state que sólo es relevante a una página, y
 * permite testearlo en aislamiento.
 *
 * <h3>State slice</h3>
 * <ul>
 *   <li><b>Lista</b> — colección completa del curso, ordenada por
 *       {@code displayOrder asc}. No paginada (el set por curso es
 *       acotado: pocas decenas de unidades como máximo).</li>
 *   <li><b>Flags</b> — {@code loading} (carga inicial),
 *       {@code saving} (cualquier write incluyendo reorder) y
 *       {@code error} (último mensaje user-friendly).</li>
 *   <li><b>Snapshot interno</b> — el orden previo al
 *       {@link #optimisticReorder} se guarda en una variable de
 *       instancia para que {@link #commitReorder} pueda hacer
 *       rollback transparente si la PATCH falla.</li>
 * </ul>
 *
 * <h3>Patrón de mutaciones</h3>
 * Cada mutación setea {@code saving=true} + limpia {@code error},
 * intenta la operación y o bien actualiza el slice (happy path) o
 * setea {@code error} (catch). Las páginas <strong>no</strong> deben
 * llamar a {@link AcademicApiService} directamente: enrutar a través
 * del store mantiene la lista sincronizada tras
 * {@code create/update/delete/reorder} sin re-fetch innecesario.
 */
@Injectable({ providedIn: 'root' })
export class UnitsStore {
  private readonly api = inject(AcademicApiService);

  // -------- state --------
  /** Curso al que pertenece el slice activo. {@code null} antes del primer load. */
  private readonly _courseUuid = signal<string | null>(null);
  private readonly _units = signal<UnitRow[]>([]);
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);

  /**
   * Snapshot del orden previo a un reorder optimista. {@code null}
   * fuera de la ventana entre {@link #optimisticReorder} y
   * {@link #commitReorder}.
   */
  private orderSnapshot: UnitRow[] | null = null;

  // -------- read-only views --------
  readonly courseUuid = this._courseUuid.asReadonly();
  readonly units = this._units.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();

  readonly hasUnits = computed(() => this._units().length > 0);
  readonly isEmpty = computed(() => !this._loading() && this._units().length === 0);

  /**
   * Sugerencia de {@code displayOrder} para el próximo create
   * (último + 1). Mantiene la convención del backend que appendea al
   * tail si el cliente no especifica.
   */
  readonly nextDisplayOrderSuggestion = computed(() => {
    const last = this._units().at(-1);
    return (last?.displayOrder ?? 0) + 1;
  });

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Carga las unidades del curso. Idempotente: si ya hay un slice
   * cargado para el mismo curso, no re-fetches. Pasar
   * {@code force=true} fuerza el reload (post-mutation desde otra
   * pantalla, raro).
   */
  async loadUnits(courseUuid: string, options: { force?: boolean } = {}): Promise<void> {
    const sameCourse = this._courseUuid() === courseUuid;
    if (sameCourse && this._units().length > 0 && !options.force) {
      return;
    }

    this._courseUuid.set(courseUuid);
    this._loading.set(true);
    this._error.set(null);

    try {
      const rows = await firstValueFrom(this.api.listUnits(courseUuid));
      this._units.set(rows);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._units.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  /** Limpia el slice (al desmontar el tab o cambiar de curso). */
  reset(): void {
    this._courseUuid.set(null);
    this._units.set([]);
    this._error.set(null);
    this.orderSnapshot = null;
  }

  clearError(): void {
    this._error.set(null);
  }

  // ===========================================================================
  // Mutations
  // ===========================================================================

  async createUnit(courseUuid: string, request: CreateUnitRequest): Promise<UnitDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.createUnit(courseUuid, request));
      this.upsertFromDetail(created);
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async updateUnit(publicUuid: string, patch: UpdateUnitRequest): Promise<UnitDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.updateUnit(publicUuid, patch));
      this.upsertFromDetail(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async deleteUnit(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.deleteUnit(publicUuid));
      this._units.update((rows) => rows.filter((u) => u.publicUuid !== publicUuid));
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Reorder (optimistic)
  // ===========================================================================

  /**
   * Aplica el orden propuesto en memoria <em>antes</em> de pegar al
   * backend. Guarda un snapshot del orden previo para que
   * {@link #commitReorder} pueda revertir si la PATCH falla.
   *
   * <p>Espeja el patrón {@code optimisticReorderGrades} en
   * {@code AcademicStore}: la UI ya refleja el cambio mientras viaja
   * la request, lo que da la sensación de "instantáneo".</p>
   */
  optimisticReorder(orderedUuids: string[]): void {
    const current = this._units();
    if (orderedUuids.length === 0) return;
    this.orderSnapshot = current.slice();

    const byId = new Map(current.map((u) => [u.publicUuid, u]));
    const reordered: UnitRow[] = [];
    orderedUuids.forEach((id, index) => {
      const u = byId.get(id);
      if (u) reordered.push({ ...u, displayOrder: index + 1 });
    });

    this._units.set(reordered);
  }

  /**
   * Confirma el reorder enviando la PATCH. Si falla, revierte al
   * snapshot capturado en {@link #optimisticReorder}.
   *
   * <p>El BE retorna la lista completa de {@code UnitDetail} con los
   * nuevos {@code displayOrder} — la usamos para reemplazar el slice,
   * descartando cualquier deriva (ej. una unidad que entró por otro
   * tab).</p>
   */
  async commitReorder(): Promise<boolean> {
    const courseUuid = this._courseUuid();
    if (!courseUuid) return false;

    const items = this._units().map((u, i) => ({
      publicUuid: u.publicUuid,
      displayOrder: i + 1,
    }));
    if (items.length === 0) return true;

    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.reorderUnits(courseUuid, { items }));
      this._units.set(
        updated
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((u) => this.detailToRow(u)),
      );
      this.orderSnapshot = null;
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this.rollbackReorder();
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Rollback explícito: restaura el snapshot tomado por
   * {@link #optimisticReorder}. Útil si el caller decide cancelar el
   * drag antes de commit.
   */
  rollbackReorder(): void {
    if (!this.orderSnapshot) return;
    this._units.set(this.orderSnapshot);
    this.orderSnapshot = null;
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  /**
   * Inserta o actualiza una fila a partir de un detail recién devuelto
   * por POST/PUT. Re-ordena por {@code displayOrder asc} para mantener
   * la invariante visual.
   */
  private upsertFromDetail(detail: UnitDetail): void {
    const row = this.detailToRow(detail);
    this._units.update((rows) => {
      const idx = rows.findIndex((u) => u.publicUuid === row.publicUuid);
      const next = idx >= 0 ? [...rows.slice(0, idx), row, ...rows.slice(idx + 1)] : [...rows, row];
      return next.sort((a, b) => a.displayOrder - b.displayOrder);
    });
  }

  private detailToRow(detail: UnitDetail): UnitRow {
    return {
      publicUuid: detail.publicUuid,
      name: detail.name,
      displayOrder: detail.displayOrder,
      startDate: detail.startDate,
      endDate: detail.endDate,
      isActive: detail.isActive,
      sessionCount: detail.sessionCount,
    };
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as { message?: unknown; error?: { message?: unknown } };
      if (typeof anyErr.error?.message === 'string') return anyErr.error.message;
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'Ocurrió un error inesperado.';
  }
}

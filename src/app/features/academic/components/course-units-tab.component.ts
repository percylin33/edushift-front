import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  effect,
  inject,
  input,
  signal
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent
} from '@shared/components';
import { UnitsStore } from '../store';
import { UnitDetail, UnitRow } from '../models';
import { AcademicApiService } from '../services';
import { UnitFormModalComponent } from './unit-form-modal.component';

/**
 * Sub-tab "Unidades" dentro de {@code course-detail}. Lista las
 * unidades del curso ordenadas por {@code displayOrder asc}, permite
 * reordenarlas con drag-and-drop (CDK) y abre un modal para crear o
 * editar. El delete y el toggle se ejecutan inline sobre la fila.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Carga la lista al recibir {@link #courseUuid}; al cambiar el
 *       curso (caso poco común — la página se recrea), refresca.</li>
 *   <li>Drag-drop reorder: aplica
 *       {@link UnitsStore#optimisticReorder} para feedback instantáneo
 *       y luego {@link UnitsStore#commitReorder}, que rollback si la
 *       PATCH falla.</li>
 *   <li>El "Editar" carga el detail vía
 *       {@code AcademicApiService.getUnit} para hidratar
 *       {@code description} (no presente en el list item) — espeja
 *       lo que hace {@code courses-list} con {@code CourseDetail}.</li>
 *   <li>El delete usa {@code window.confirm} (DEBT-UX-1, mismo
 *       patrón que levels-board y courses-list).</li>
 * </ul>
 */
@Component({
  selector: 'app-course-units-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CdkDropList,
    CdkDrag,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    UnitFormModalComponent
  ],
  template: `
    <header class="mb-3 flex items-end justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-content">Unidades</h3>
        <p class="text-sm text-content-muted">
          Bloques pedagógicos del curso. Las sesiones (BE-5A.4) se
          anclan a una unidad y validan su fecha contra el periodo
          del assignment, no contra el rango de la unidad.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        [disabled]="saving() || !courseUuid()"
        (click)="openCreate()"
      >
        <app-icon name="plus" [size]="14" />
        <span class="hidden sm:inline">Nueva unidad</span>
      </button>
    </header>

    <section class="card overflow-hidden">
      @if (loading() && !hasUnits()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando unidades…" />
        </div>
      } @else if (errorMessage()) {
        <div class="alert alert-danger m-5">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar las unidades.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">
            Reintentar
          </button>
        </div>
      } @else if (isEmpty()) {
        <app-empty-state
          icon="book-open"
          title="Aún no hay unidades en este curso"
          description="Crea la primera para empezar a planificar sesiones."
        >
          <button
            type="button"
            class="btn btn-primary btn-sm"
            (click)="openCreate()"
          >
            Nueva unidad
          </button>
        </app-empty-state>
      } @else {
        <ul
          cdkDropList
          class="divide-y divide-border-subtle"
          [cdkDropListData]="units()"
          (cdkDropListDropped)="onDrop($event)"
        >
          @for (unit of units(); track unit.publicUuid) {
            <li
              cdkDrag
              [cdkDragData]="unit"
              class="flex items-center gap-3 px-5 py-3 hover:bg-surface-subtle"
              [class.opacity-60]="saving()"
            >
              <span
                cdkDragHandle
                class="cursor-grab text-content-muted hover:text-content"
                aria-label="Reordenar"
              >
                <app-icon name="menu" [size]="16" />
              </span>

              <div class="min-w-0 flex-1">
                <p class="font-medium text-content">
                  <span class="text-content-muted text-xs mr-2">
                    {{ unit.displayOrder }}.
                  </span>
                  {{ unit.name }}
                  @if (!unit.isActive) {
                    <span class="badge badge-neutral text-[10px] ml-2">
                      Inactiva
                    </span>
                  }
                </p>
                <p class="mt-0.5 text-xs text-content-muted">
                  @if (unit.startDate || unit.endDate) {
                    <span>
                      {{ formatDate(unit.startDate) }} —
                      {{ formatDate(unit.endDate) }}
                    </span>
                    <span class="mx-1">·</span>
                  }
                  <span [class.text-content]="unit.sessionCount > 0">
                    {{ formatSessionCount(unit.sessionCount) }}
                  </span>
                </p>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  aria-label="Editar unidad"
                  [disabled]="saving()"
                  (click)="openEdit(unit)"
                >
                  <app-icon name="edit-2" [size]="14" />
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                  aria-label="Eliminar unidad"
                  [disabled]="saving()"
                  (click)="confirmDelete(unit)"
                >
                  <app-icon name="trash-2" [size]="14" />
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>

    @if (modalOpen()) {
      <app-unit-form-modal
        [unit]="unitBeingEdited()"
        [courseUuid]="courseUuid()"
        (closed)="closeModal()"
        (saved)="onSaved()"
      />
    }
  `,
  styles: [
    `
      :host { display: block; }
    `
  ]
})
export class CourseUnitsTabComponent implements OnChanges {
  private readonly store = inject(UnitsStore);
  private readonly api = inject(AcademicApiService);

  /**
   * UUID del curso al que pertenece el slice. Se setea desde el
   * componente padre ({@code course-detail}). Cambiarlo dispara un
   * reload del slice (caso raro, sólo si el padre re-renderiza con
   * otro curso sin desmontar).
   */
  readonly courseUuid = input.required<string>();

  protected readonly units = this.store.units;
  protected readonly hasUnits = this.store.hasUnits;
  protected readonly isEmpty = this.store.isEmpty;
  protected readonly loading = this.store.loading;
  protected readonly saving = this.store.saving;
  protected readonly errorMessage = this.store.error;

  protected readonly modalOpen = signal(false);
  protected readonly unitBeingEdited = signal<UnitDetail | null>(null);

  /** Cantidad de unidades activas — handy para badges del tab padre. */
  readonly activeCount = computed(
    () => this.units().filter((u) => u.isActive).length
  );

  constructor() {
    /* Reset cuando el componente se destruye (cambio de tab / page).
     * El effect cleanup corre incluso si el padre no llama `reset()`. */
    effect((onCleanup) => {
      onCleanup(() => this.store.reset());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['courseUuid']) {
      const uuid = this.courseUuid();
      if (uuid) {
        void this.store.loadUnits(uuid);
      }
    }
  }

  protected retry(): void {
    this.store.clearError();
    void this.store.loadUnits(this.courseUuid(), { force: true });
  }

  // ===========================================================================
  // CRUD via modal
  // ===========================================================================

  protected openCreate(): void {
    this.unitBeingEdited.set(null);
    this.modalOpen.set(true);
  }

  protected async openEdit(row: UnitRow): Promise<void> {
    /* El list item no incluye description ni audit — pedimos detail
     * antes de abrir el modal, espejo de courses-list/openEdit. */
    try {
      const detail = await firstValueFrom(this.api.getUnit(row.publicUuid));
      this.unitBeingEdited.set(detail);
      this.modalOpen.set(true);
    }
    catch {
      /* Si falla, el banner del store no se actualiza (no pasa por
       * mutación). Activamos uno local mínimo. */
      this.store.clearError();
      this.unitBeingEdited.set(null);
    }
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.unitBeingEdited.set(null);
  }

  protected onSaved(): void {
    this.closeModal();
  }

  protected async confirmDelete(unit: UnitRow): Promise<void> {
    const sessionWarn =
      unit.sessionCount > 0
        ? `\n\nLa unidad tiene ${unit.sessionCount} sesión(es) viva(s); el backend devolverá UNIT_HAS_SESSIONS.`
        : '';
    const ok = confirm(
      `¿Eliminar la unidad "${unit.name}"?\n\n` +
        'Esta operación es reversible solo desde el backend.' +
        sessionWarn
    );
    if (!ok) return;
    await this.store.deleteUnit(unit.publicUuid);
  }

  // ===========================================================================
  // Drag & drop reorder
  // ===========================================================================

  protected async onDrop(event: CdkDragDrop<UnitRow[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;

    const ordered = this.units().slice();
    moveItemInArray(ordered, event.previousIndex, event.currentIndex);
    const orderedUuids = ordered.map((u) => u.publicUuid);

    this.store.optimisticReorder(orderedUuids);
    await this.store.commitReorder();
  }

  // ===========================================================================
  // Formatting
  // ===========================================================================

  protected formatDate(d: Date | undefined): string {
    if (!d) return '—';
    return d.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  protected formatSessionCount(n: number): string {
    if (n === 0) return 'Sin sesiones';
    if (n === 1) return '1 sesión';
    return `${n} sesiones`;
  }
}

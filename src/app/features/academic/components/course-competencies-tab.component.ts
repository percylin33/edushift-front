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
import { firstValueFrom } from 'rxjs';
import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent
} from '@shared/components';
import { CompetenciesStore } from '../store';
import {
  CapacityDetail,
  CompetencyDetail,
  CompetencyRow
} from '../models';
import { AcademicApiService } from '../services';
import { CompetencyCapacityFormModalComponent, FormMode } from './competency-capacity-form-modal.component';

/**
 * Sub-tab "Competencias" dentro de {@code course-detail}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Carga el árbol de competencias y capacidades en un solo flujo
 *       al recibir {@link #courseUuid}.</li>
 *   <li>Botón "Seed MINEDU" que invoca el endpoint de seed. Si ya
 *       está sembrado, muestra un toast/banner informativo.</li>
 *   <li>Accordion jerárquico: cada competencia expandible muestra sus
 *       capacidades. Botones CRUD por nivel.</li>
 *   <li>El "Editar" carga el detail vía {@code AcademicApiService}
 *       para hidratar la descripción (no presente en el list item).</li>
 *   <li>El delete usa {@code window.confirm} (mismo patrón que units).</li>
 * </ul>
 */
@Component({
  selector: 'app-course-competencies-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    CompetencyCapacityFormModalComponent
  ],
  template: `
    <header class="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-content">Competencias y Capacidades</h3>
        <p class="text-sm text-content-muted">
          Define el aggregate pedagógico principal del curso y sus desgloses
          granulares evaluables.
        </p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn btn-outline btn-sm"
          [disabled]="saving() || !courseUuid()"
          (click)="onSeed()"
        >
          <app-icon name="sparkles" [size]="14" />
          <span class="hidden sm:inline">Seed MINEDU</span>
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          [disabled]="saving() || !courseUuid()"
          (click)="openCompetencyCreate()"
        >
          <app-icon name="plus" [size]="14" />
          <span class="hidden sm:inline">Nueva Competencia</span>
        </button>
      </div>
    </header>

    <section class="card overflow-hidden">
      @if (loading() && !hasCompetencies()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando competencias…" />
        </div>
      } @else if (errorMessage()) {
        <div class="alert alert-danger m-5">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar las competencias.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">
            Reintentar
          </button>
        </div>
      } @else if (isEmpty()) {
        <app-empty-state
          icon="target"
          title="Aún no hay competencias en este curso"
          description="Crea la primera o usa el Seed MINEDU para cargar el catálogo predeterminado."
        >
          <div class="flex gap-2">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              (click)="onSeed()"
            >
              Seed MINEDU
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              (click)="openCompetencyCreate()"
            >
              Nueva Competencia
            </button>
          </div>
        </app-empty-state>
      } @else {
        <div class="divide-y divide-border-subtle">
          @for (comp of competencies(); track comp.publicUuid) {
            <details class="group" [open]="expandedCompetencies().has(comp.publicUuid)">
              <summary
                class="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-surface-subtle list-none"
                (click)="toggleCompetency(comp.publicUuid)"
              >
                <app-icon
                  name="chevron-down"
                  [size]="16"
                  class="text-content-muted transition-transform duration-200 group-open:rotate-180"
                />
                <div class="min-w-0 flex-1">
                  <p class="font-medium text-content">
                    <span class="text-content-muted text-xs mr-2">
                      {{ comp.displayOrder }}.
                    </span>
                    {{ comp.name }}
                    @if (!comp.isActive) {
                      <span class="badge badge-neutral text-[10px] ml-2">
                        Inactiva
                      </span>
                    }
                  </p>
                  <p class="mt-0.5 text-xs text-content-muted">
                    Código: {{ comp.code }} · {{ comp.capacityCount }} capacidades
                  </p>
                </div>
                <div class="flex items-center gap-1 shrink-0" (click)="$event.stopPropagation()">
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    aria-label="Editar competencia"
                    [disabled]="saving()"
                    (click)="openCompetencyEdit(comp)"
                  >
                    <app-icon name="edit-2" [size]="14" />
                  </button>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                    aria-label="Eliminar competencia"
                    [disabled]="saving()"
                    (click)="confirmDeleteCompetency(comp)"
                  >
                    <app-icon name="trash-2" [size]="14" />
                  </button>
                </div>
              </summary>

              <div class="bg-surface-subtle px-5 pb-4 pt-2">
                @if (comp.capacities.length === 0) {
                  <p class="text-sm text-content-muted italic py-2">
                    No hay capacidades registradas para esta competencia.
                  </p>
                } @else {
                  <ul class="space-y-2">
                    @for (cap of comp.capacities; track cap.publicUuid) {
                      <li class="flex items-center gap-3 rounded border border-border-subtle bg-surface px-3 py-2">
                        <div class="min-w-0 flex-1">
                          <p class="text-sm font-medium text-content">
                            <span class="text-content-muted text-xs mr-2">
                              {{ cap.displayOrder }}.
                            </span>
                            {{ cap.name }}
                            @if (!cap.isActive) {
                              <span class="badge badge-neutral text-[10px] ml-2">
                                Inactiva
                              </span>
                            }
                          </p>
                          <p class="mt-0.5 text-xs text-content-muted">
                            Código: {{ cap.code }}
                          </p>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm"
                            aria-label="Editar capacidad"
                            [disabled]="saving()"
                            (click)="openCapacityEdit(comp, cap.publicUuid)"
                          >
                            <app-icon name="edit-2" [size]="14" />
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                            aria-label="Eliminar capacidad"
                            [disabled]="saving()"
                            (click)="confirmDeleteCapacity(comp.publicUuid, cap.publicUuid)"
                          >
                            <app-icon name="trash-2" [size]="14" />
                          </button>
                        </div>
                      </li>
                    }
                  </ul>
                }
                <div class="mt-3">
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm text-primary-600 hover:bg-primary-50"
                    [disabled]="saving()"
                    (click)="openCapacityCreate(comp.publicUuid)"
                  >
                    <app-icon name="plus" [size]="14" />
                    Nueva Capacidad
                  </button>
                </div>
              </div>
            </details>
          }
        </div>
      }
    </section>

    @if (modalOpen()) {
      <app-competency-capacity-form-modal
        [mode]="modalMode()"
        [courseUuid]="courseUuid()"
        [competency]="competencyBeingEdited()"
        [capacityPublicUuid]="capacityBeingEdited()"
        (closed)="closeModal()"
        (saved)="onSaved()"
      />
    }
  `,
  styles: [
    `
      :host { display: block; }
      details > summary::-webkit-details-marker {
        display: none;
      }
      details > summary {
        list-style: none;
      }
    `
  ]
})
export class CourseCompetenciesTabComponent implements OnChanges {
  private readonly store = inject(CompetenciesStore);
  private readonly api = inject(AcademicApiService);

  readonly courseUuid = input.required<string>();

  protected readonly competencies = this.store.competencies;
  protected readonly hasCompetencies = this.store.hasCompetencies;
  protected readonly isEmpty = this.store.isEmpty;
  protected readonly loading = this.store.loading;
  protected readonly saving = this.store.saving;
  protected readonly errorMessage = this.store.error;

  protected readonly expandedCompetencies = signal<Set<string>>(new Set());

  protected readonly modalOpen = signal(false);
  protected readonly modalMode = signal<FormMode>('competency-create');
  protected readonly competencyBeingEdited = signal<CompetencyDetail | null>(null);
  protected readonly capacityBeingEdited = signal<string | null>(null);

  constructor() {
    effect((onCleanup) => {
      onCleanup(() => this.store.reset());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['courseUuid']) {
      const uuid = this.courseUuid();
      if (uuid) {
        void this.store.loadCompetencies(uuid);
      }
    }
  }

  protected retry(): void {
    this.store.clearError();
    void this.store.loadCompetencies(this.courseUuid(), { force: true });
  }

  protected toggleCompetency(publicUuid: string): void {
    const set = new Set(this.expandedCompetencies());
    if (set.has(publicUuid)) {
      set.delete(publicUuid);
    } else {
      set.add(publicUuid);
    }
    this.expandedCompetencies.set(set);
  }

  protected async onSeed(): Promise<void> {
    const ok = await this.store.seedCompetencies();
    if (ok) {
      // El store ya recarga si seeded=true
    }
  }

  // ===========================================================================
  // Competency CRUD
  // ===========================================================================

  protected openCompetencyCreate(): void {
    this.modalMode.set('competency-create');
    this.competencyBeingEdited.set(null);
    this.capacityBeingEdited.set(null);
    this.modalOpen.set(true);
  }

  protected async openCompetencyEdit(row: CompetencyRow): Promise<void> {
    try {
      const detail = await firstValueFrom(this.api.getCompetency(row.publicUuid));
      this.competencyBeingEdited.set(detail);
      this.modalMode.set('competency-edit');
      this.capacityBeingEdited.set(null);
      this.modalOpen.set(true);
    } catch {
      this.store.clearError();
      this.competencyBeingEdited.set(null);
    }
  }

  protected async confirmDeleteCompetency(comp: CompetencyRow): Promise<void> {
    const ok = confirm(
      `¿Eliminar la competencia "${comp.name}"?\n\n` +
        'Esta operación es reversible solo desde el backend. ' +
        'Si tiene sesiones asociadas, el backend devolverá COMPETENCY_IN_USE_BY_SESSIONS.'
    );
    if (!ok) return;
    await this.store.deleteCompetency(comp.publicUuid);
  }

  // ===========================================================================
  // Capacity CRUD
  // ===========================================================================

  protected openCapacityCreate(competencyUuid: string): void {
    this.modalMode.set('capacity-create');
    this.capacityBeingEdited.set(null);
    // Necesitamos la competencia padre para el modal
    const comp = this.competencies().find((c) => c.publicUuid === competencyUuid);
    if (comp) {
      // Hack: convertimos CompetencyRow a CompetencyDetail mínimo para el modal
      this.competencyBeingEdited.set({
        ...comp,
        course: { publicUuid: '', code: '', name: '' },
        capacities: comp.capacities || [],
        description: undefined
      });
    }
    this.modalOpen.set(true);
  }

  protected async openCapacityEdit(compRow: CompetencyRow, capacityUuid: string): Promise<void> {
    try {
      // Necesitamos el detalle completo (con 'course') para el modal
      const detail = await firstValueFrom(this.api.getCompetency(compRow.publicUuid));
      this.competencyBeingEdited.set(detail);
      this.capacityBeingEdited.set(capacityUuid);
      this.modalMode.set('capacity-edit');
      this.modalOpen.set(true);
    } catch {
      this.store.clearError();
    }
  }

  protected async confirmDeleteCapacity(competencyUuid: string, capacityUuid: string): Promise<void> {
    const ok = confirm(
      '¿Eliminar esta capacidad?\n\n' +
        'Si tiene sesiones asociadas, el backend devolverá CAPACITY_IN_USE_BY_SESSIONS.'
    );
    if (!ok) return;
    await this.store.deleteCapacity(capacityUuid, competencyUuid);
  }

  // ===========================================================================
  // Modal lifecycle
  // ===========================================================================

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.competencyBeingEdited.set(null);
    this.capacityBeingEdited.set(null);
  }

  protected onSaved(): void {
    this.closeModal();
  }
}
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent
} from '@shared/components';
import {
  GradeFormModalComponent,
  LevelFormModalComponent
} from '../../components';
import { AcademicStore } from '../../store';
import { AcademicLevel, Grade } from '../../models';

/**
 * `/academic/levels` — pantalla del sub-módulo {@code academic.levelgrade}
 * (BE-4.2).
 *
 * <h3>Layout</h3>
 * <p>Dos columnas:</p>
 * <ul>
 *   <li><b>Izquierda</b>: lista de niveles con su ordinal, nombre y badge
 *       del número de grados. Click selecciona el nivel; el panel
 *       derecho refresca al instante (todo el catálogo viene en un
 *       solo round-trip).</li>
 *   <li><b>Derecha</b>: grados del nivel seleccionado, con drag &
 *       drop (`@angular/cdk/drag-drop`) para reordenar. El handler
 *       aplica un reorder optimista y dispara la PATCH al backend; en
 *       error el store hace rollback al snapshot previo.</li>
 * </ul>
 *
 * <h3>Estados</h3>
 * <ul>
 *   <li>Loading inicial: spinner full-pane.</li>
 *   <li>Empty state (tenant sin defaults): mensaje + botón "Nuevo nivel".</li>
 *   <li>Error: alert con botón retry.</li>
 * </ul>
 *
 * <h3>Decisiones</h3>
 * <ul>
 *   <li>El "restaurar defaults" del spec original queda como follow-up
 *       — el backend aún no expone un endpoint dedicado y la UX
 *       prefiere "Nuevo nivel" mientras tanto.</li>
 *   <li>Confirm de delete vía {@code window.confirm} (DEBT-UX-1; se
 *       reemplazará cuando aterrice {@code ConfirmDialogComponent}).</li>
 * </ul>
 */
@Component({
  selector: 'app-levels-board',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    CdkDropList,
    CdkDrag,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    LevelFormModalComponent,
    GradeFormModalComponent
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-content">Niveles y grados</h2>
        <p class="text-sm text-content-muted">
          Estructura curricular del workspace. Selecciona un nivel a la izquierda y arrastra los grados para reordenarlos.
        </p>
      </div>
      <button
        type="button"
        class="btn btn-primary btn-sm self-start sm:self-auto"
        (click)="openLevelModal(null)"
      >
        <app-icon name="plus" [size]="16" />
        <span class="hidden sm:inline">Nuevo nivel</span>
      </button>
    </header>

    @if (loadingLevels() && !hasLevels()) {
      <div class="card">
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando niveles…" />
        </div>
      </div>
    } @else if (errorMessage()) {
      <div class="alert alert-danger">
        <app-icon name="alert-circle" [size]="18" />
        <div class="flex-1">
          <p class="font-medium">No pudimos cargar el catálogo.</p>
          <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">Reintentar</button>
      </div>
    } @else if (isEmpty()) {
      <div class="card">
        <app-empty-state
          icon="layers"
          title="Aún no hay niveles"
          description="Crea el primer nivel (ej. PRIMARIA) y agrega sus grados."
        >
          <button type="button" class="btn btn-primary btn-sm" (click)="openLevelModal(null)">
            Nuevo nivel
          </button>
        </app-empty-state>
      </div>
    } @else {
      <section class="grid gap-4 lg:grid-cols-12">
        <!-- Niveles -->
        <aside class="card lg:col-span-4">
          <header class="card-header">
            <h3 class="card-title text-base">Niveles</h3>
            <p class="card-description">Total: {{ levels().length }}</p>
          </header>
          <ul class="divide-y divide-border-subtle">
            @for (level of levels(); track level.publicUuid) {
              <li>
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-2 px-5 py-3 text-left hover:bg-surface-subtle"
                  [class.bg-primary-50]="isSelected(level)"
                  [class.text-primary-700]="isSelected(level)"
                  (click)="selectLevel(level)"
                >
                  <div class="min-w-0 flex-1">
                    <p class="font-medium">
                      <span class="text-content-muted text-xs mr-2">{{ level.ordinal }}.</span>
                      {{ level.name }}
                    </p>
                    <p class="text-xs text-content-muted">
                      <span class="font-mono">{{ level.code }}</span>
                      · {{ level.grades.length }} grados
                    </p>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <span
                      class="btn btn-ghost btn-sm"
                      role="button"
                      tabindex="0"
                      aria-label="Editar nivel"
                      (click)="onLevelEdit($event, level)"
                      (keydown.enter)="onLevelEdit($event, level)"
                    >
                      <app-icon name="edit-2" [size]="14" />
                    </span>
                    <span
                      class="btn btn-ghost btn-sm text-danger-600"
                      role="button"
                      tabindex="0"
                      aria-label="Eliminar nivel"
                      (click)="onLevelDelete($event, level)"
                      (keydown.enter)="onLevelDelete($event, level)"
                    >
                      <app-icon name="trash-2" [size]="14" />
                    </span>
                  </div>
                </button>
              </li>
            }
          </ul>
        </aside>

        <!-- Grades del level seleccionado -->
        <section class="card lg:col-span-8">
          <header class="card-header flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0">
              <h3 class="card-title text-base">
                @if (selectedLevel(); as lvl) {
                  Grados de {{ lvl.name }}
                } @else {
                  Selecciona un nivel
                }
              </h3>
              <p class="card-description">
                @if (selectedGrades().length > 0) {
                  Arrastra una fila para reordenar. El cambio se persiste al soltar.
                } @else if (selectedLevel()) {
                  Aún no hay grados. Agrega el primero abajo.
                } @else {
                  El panel mostrará los grados del nivel que elijas.
                }
              </p>
            </div>
            @if (selectedLevel()) {
              <button
                type="button"
                class="btn btn-outline btn-sm"
                (click)="openGradeModal(null)"
              >
                <app-icon name="plus" [size]="14" />
                <span class="hidden sm:inline">Nuevo grado</span>
              </button>
            }
          </header>

          @if (selectedLevel(); as lvl) {
            @if (selectedGrades().length === 0) {
              <div class="px-5 py-10 text-center text-sm text-content-muted">
                Sin grados todavía.
              </div>
            } @else {
              <ul
                cdkDropList
                class="divide-y divide-border-subtle"
                [cdkDropListData]="selectedGrades()"
                (cdkDropListDropped)="onGradeDrop($event, lvl)"
              >
                @for (grade of selectedGrades(); track grade.publicUuid) {
                  <li
                    cdkDrag
                    [cdkDragData]="grade"
                    class="flex items-center gap-3 px-5 py-3 hover:bg-surface-subtle"
                    [class.opacity-50]="savingGrade()"
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
                        <span class="text-content-muted text-xs mr-2">{{ grade.ordinal }}.</span>
                        {{ grade.name }}
                      </p>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        aria-label="Editar grado"
                        (click)="openGradeModal(grade)"
                      >
                        <app-icon name="edit-2" [size]="14" />
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm text-danger-600"
                        aria-label="Eliminar grado"
                        [disabled]="savingGrade()"
                        (click)="confirmDeleteGrade(grade)"
                      >
                        <app-icon name="trash-2" [size]="14" />
                      </button>
                    </div>
                  </li>
                }
              </ul>
            }
          } @else {
            <div class="px-5 py-10 text-center text-sm text-content-muted">
              Selecciona un nivel a la izquierda para ver sus grados.
            </div>
          }
        </section>
      </section>
    }

    <!-- Modales -->
    @if (levelModalOpen()) {
      <app-level-form-modal
        [level]="levelBeingEdited()"
        (closed)="closeLevelModal()"
        (saved)="onLevelSaved()"
      />
    }

    @if (gradeModalOpen() && selectedLevel(); as lvl) {
      <app-grade-form-modal
        [grade]="gradeBeingEdited()"
        [levelUuid]="lvl.publicUuid"
        [suggestedOrdinal]="nextOrdinalSuggestion()"
        (closed)="closeGradeModal()"
        (saved)="onGradeSaved()"
      />
    }
  `
})
export class LevelsBoardComponent implements OnInit {
  private readonly store = inject(AcademicStore);

  protected readonly levels = this.store.levels;
  protected readonly hasLevels = this.store.hasLevels;
  protected readonly isEmpty = this.store.isLevelsEmpty;
  protected readonly loadingLevels = this.store.loadingLevels;
  protected readonly savingGrade = this.store.savingGrade;
  protected readonly selectedLevel = this.store.selectedLevel;
  protected readonly selectedGrades = this.store.selectedGrades;
  protected readonly errorMessage = this.store.error;

  protected readonly levelModalOpen = signal(false);
  protected readonly gradeModalOpen = signal(false);
  protected readonly levelBeingEdited = signal<AcademicLevel | null>(null);
  protected readonly gradeBeingEdited = signal<Grade | null>(null);

  /**
   * Sugerencia de {@code ordinal} para el próximo grade (último + 1).
   * Evita colisiones con {@code GRADE_ORDINAL_TAKEN} en el caso común.
   */
  protected readonly nextOrdinalSuggestion = computed(() => {
    const last = this.selectedGrades().at(-1);
    return (last?.ordinal ?? 0) + 1;
  });

  ngOnInit(): void {
    if (!this.hasLevels()) {
      void this.store.loadLevels();
    }
  }

  protected isSelected(level: AcademicLevel): boolean {
    return this.selectedLevel()?.publicUuid === level.publicUuid;
  }

  protected selectLevel(level: AcademicLevel): void {
    this.store.selectLevel(level.publicUuid);
  }

  protected retry(): void {
    this.store.clearError();
    void this.store.loadLevels();
  }

  // ===========================================================================
  // Level CRUD
  // ===========================================================================

  protected openLevelModal(level: AcademicLevel | null): void {
    this.levelBeingEdited.set(level);
    this.levelModalOpen.set(true);
  }

  protected closeLevelModal(): void {
    this.levelModalOpen.set(false);
    this.levelBeingEdited.set(null);
  }

  protected onLevelSaved(): void {
    this.closeLevelModal();
  }

  protected onLevelEdit(event: Event, level: AcademicLevel): void {
    event.stopPropagation();
    this.openLevelModal(level);
  }

  protected onLevelDelete(event: Event, level: AcademicLevel): void {
    event.stopPropagation();
    void this.confirmDeleteLevel(level);
  }

  protected async confirmDeleteLevel(level: AcademicLevel): Promise<void> {
    if (level.grades.length > 0) {
      alert(
        `No se puede eliminar el nivel "${level.name}" porque aún tiene ${level.grades.length} grados.\n\nElimina o mueve los grados primero.`
      );
      return;
    }
    const ok = confirm(`¿Eliminar el nivel "${level.name}"?`);
    if (!ok) return;
    await this.store.deleteLevel(level.publicUuid);
  }

  // ===========================================================================
  // Grade CRUD
  // ===========================================================================

  protected openGradeModal(grade: Grade | null): void {
    this.gradeBeingEdited.set(grade);
    this.gradeModalOpen.set(true);
  }

  protected closeGradeModal(): void {
    this.gradeModalOpen.set(false);
    this.gradeBeingEdited.set(null);
  }

  protected onGradeSaved(): void {
    this.closeGradeModal();
  }

  protected async confirmDeleteGrade(grade: Grade): Promise<void> {
    const ok = confirm(`¿Eliminar el grado "${grade.name}"?`);
    if (!ok) return;
    await this.store.deleteGrade(grade.levelPublicUuid, grade.publicUuid);
  }

  // ===========================================================================
  // Drag & drop reorder
  // ===========================================================================

  /**
   * Handler de CDK. {@code moveItemInArray} sobre una copia local nos
   * da el orden visual; lo enviamos al store, que aplica el optimistic
   * update y dispara la PATCH. Si el backend falla, el store revierte
   * al snapshot.
   */
  protected async onGradeDrop(
    event: CdkDragDrop<Grade[]>,
    level: AcademicLevel
  ): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;

    const ordered = this.selectedGrades().slice();
    moveItemInArray(ordered, event.previousIndex, event.currentIndex);
    const orderedUuids = ordered.map((g) => g.publicUuid);

    this.store.optimisticReorderGrades(level.publicUuid, orderedUuids);
    await this.store.commitGradeReorder(level.publicUuid);
  }
}

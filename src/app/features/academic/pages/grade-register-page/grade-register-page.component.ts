import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent,
} from '@shared/components';
import { AcademicStore } from '../../store';
import { AcademicYearRow, AcademicYearStatus } from '../../models';
import {
  GradeCategory,
  GradeCategoryColumnMode,
  GradeRegisterRecommendedLevel,
  GradeRegisterTemplate,
  GradeRegisterTemplateListItem,
  resolveSlotLabels,
} from '../../models/grade-register-template.model';
import { GradeRegisterApiService } from '../../services/grade-register-api.service';

/** Color tokens aligned with backend seed catalog (F1). */
export const GRADE_CATEGORY_COLOR_TOKENS = [
  'amber',
  'green',
  'blue',
  'slate',
  'violet',
] as const;

type CatalogLevelFilter = 'ALL' | GradeRegisterRecommendedLevel;

type CategoryDraft = {
  name: string;
  colorToken: string;
  weight: number;
  contributesToAverage: boolean;
  allowsTeacherColumns: boolean;
  sortOrder: number;
  columnMode: GradeCategoryColumnMode;
  slotCount: number;
  slotLabelPrefix: string;
  /** Comma or newline separated custom slot names (optional). */
  slotLabelsText: string;
};

type PreviewMockColumn = { key: string; label: string };

type PreviewMockGroup = {
  category: GradeCategory;
  columns: PreviewMockColumn[];
};

type PreviewMockRow = {
  name: string;
  prom: string;
  scores: Record<string, number>;
  categoryProm: Record<string, string>;
};

type CatalogPreviewState = {
  listItem: GradeRegisterTemplateListItem;
  detail: GradeRegisterTemplate;
  mock: { groups: PreviewMockGroup[]; rows: PreviewMockRow[] };
};

const PREVIEW_STUDENT_NAMES = [
  'AGUILAR, Dilan J.',
  'BENITES, María A.',
  'CASTRO, Luis R.',
] as const;

const CATALOG_LEVEL_TABS: { id: CatalogLevelFilter; label: string }[] = [
  { id: 'ALL', label: 'Todos' },
  { id: 'INICIAL', label: 'Inicial' },
  { id: 'PRIMARIA', label: 'Primaria' },
  { id: 'SECUNDARIA', label: 'Secundaria' },
];

/**
 * `/academic/grade-register` — plantillas del registro formal (F1).
 *
 * Catálogo del sistema + plantilla activa del año; editor planilla
 * de categorías (bandas, slots, peso, promedio, columnas).
 */
@Component({
  selector: 'app-grade-register-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
  ],
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-lg font-semibold text-content">Registro de notas</h2>
        <p class="text-sm text-content-muted">
          Adoptá una plantilla del catálogo y ajustá categorías y pesos para el año académico.
        </p>
      </div>
      <div class="flex flex-wrap items-end gap-2 self-start sm:self-auto">
        <div>
          <label class="label" for="gr-year">Año académico</label>
          <select
            id="gr-year"
            class="select min-w-[12rem]"
            [ngModel]="yearFilter()"
            (ngModelChange)="onYearChange($event)"
          >
            <option [ngValue]="null">— Año activo —</option>
            @for (y of years(); track y.publicUuid) {
              <option [ngValue]="y.publicUuid">{{ y.name }} · {{ statusLabel(y.status) }}</option>
            }
          </select>
        </div>
        <button
          type="button"
          class="btn btn-outline btn-sm"
          [disabled]="loading()"
          (click)="reload()"
        >
          <app-icon name="rotate-cw" [size]="16" />
          <span>Actualizar</span>
        </button>
      </div>
    </header>

    @if (error(); as err) {
      <div class="alert alert-danger mb-4">
        <app-icon name="alert-circle" [size]="18" />
        <p class="flex-1 text-sm">{{ err }}</p>
        <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">Reintentar</button>
      </div>
    }

    @if (loading() && catalog().length === 0 && mine().length === 0) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando plantillas…" />
      </div>
    } @else {
      <section class="mb-8" aria-labelledby="gr-catalog-title">
        <h3
          id="gr-catalog-title"
          class="mb-1 text-sm font-semibold uppercase tracking-wide text-content-muted"
        >
          Catálogo
        </h3>
        <p class="mb-3 text-xs text-content-muted">
          Acta SIAGIE oficial usa literales en Inicial/Primaria; estas plantillas son registro
          interno 0–20.
        </p>

        <div
          class="mb-3 flex flex-wrap gap-1"
          role="tablist"
          aria-label="Filtrar catálogo por nivel"
        >
          @for (tab of catalogLevelTabs; track tab.id) {
            <button
              type="button"
              role="tab"
              class="btn btn-sm"
              [class.btn-primary]="catalogLevelFilter() === tab.id"
              [class.btn-ghost]="catalogLevelFilter() !== tab.id"
              [attr.aria-selected]="catalogLevelFilter() === tab.id"
              (click)="catalogLevelFilter.set(tab.id)"
            >
              {{ tab.label }}
            </button>
          }
        </div>

        @if (filteredCatalog().length === 0) {
          <app-empty-state
            icon="layout-grid"
            title="Catálogo vacío"
            description="No hay plantillas del sistema para este filtro."
          />
        } @else {
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            @for (t of filteredCatalog(); track t.publicUuid) {
              <article class="card flex flex-col p-4">
                <h4 class="font-semibold text-content">{{ t.name }}</h4>
                <p class="mt-1 flex-1 text-sm text-content-muted">
                  {{ t.description || 'Sin descripción.' }}
                </p>
                @if (t.recommendedLevels?.length) {
                  <div class="mt-2 flex flex-wrap gap-1">
                    @for (lvl of t.recommendedLevels; track lvl) {
                      <span class="badge badge-neutral text-[10px]">
                        Recomendado: {{ levelLabel(lvl) }}
                      </span>
                    }
                  </div>
                }
                <p class="mt-2 text-xs text-content-subtle">
                  {{ t.categoryCount }} categorías
                  @if (t.catalogCode) {
                    · <span class="font-mono">{{ t.catalogCode }}</span>
                  }
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    [disabled]="previewLoading() === t.publicUuid"
                    (click)="openPreview(t)"
                  >
                    @if (previewLoading() === t.publicUuid) {
                      <app-spinner [size]="14" label="Cargando" />
                    } @else {
                      <app-icon name="eye" [size]="14" />
                    }
                    <span>Ver</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="!resolvedYear() || adopting() === t.publicUuid"
                    (click)="adoptOrReplace(t)"
                  >
                    @if (adopting() === t.publicUuid) {
                      <app-spinner [size]="14" label="Adoptando" />
                    } @else {
                      <app-icon
                        [name]="hasActiveTemplate() ? 'rotate-cw' : 'plus'"
                        [size]="14"
                      />
                    }
                    <span>{{ adoptCtaLabel() }}</span>
                  </button>
                </div>
              </article>
            }
          </div>
        }
      </section>

      <section aria-labelledby="gr-mine-title">
        <h3
          id="gr-mine-title"
          class="mb-3 text-sm font-semibold uppercase tracking-wide text-content-muted"
        >
          {{ hasActiveTemplate() ? 'Plantilla del año' : 'Mis plantillas' }}
          @if (resolvedYear(); as y) {
            <span class="font-normal normal-case tracking-normal text-content-subtle">
              · {{ y.name }}
            </span>
          }
        </h3>

        @if (!resolvedYear()) {
          <app-empty-state
            icon="calendar"
            title="Sin año académico"
            description="Activá o seleccioná un año académico para ver y adoptar plantillas."
          />
        } @else if (!hasActiveTemplate() && mine().length === 0) {
          <app-empty-state
            icon="book-open"
            title="Aún no hay plantilla activa"
            description="Elegí una del catálogo"
          />
        } @else {
          @if (activeMine(); as active) {
            <div class="card overflow-hidden">
              <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div class="min-w-0">
                  <p class="font-medium text-content">
                    {{ active.name }}
                    <span class="badge badge-success ml-2 text-[10px]">Activa</span>
                  </p>
                  <p class="text-xs text-content-muted">
                    {{ active.categoryCount }} categorías · scope {{ active.scope }}
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  (click)="toggleExpand(active.publicUuid)"
                >
                  <app-icon
                    [name]="expandedUuid() === active.publicUuid ? 'chevron-up' : 'chevron-down'"
                    [size]="16"
                  />
                  <span>{{
                    expandedUuid() === active.publicUuid ? 'Ocultar' : 'Editar categorías'
                  }}</span>
                </button>
              </div>

              @if (expandedUuid() === active.publicUuid) {
                <div class="border-t border-border-subtle bg-surface-subtle/40 px-4 py-4">
                  @if (detailLoading() === active.publicUuid) {
                    <div class="flex justify-center py-6">
                      <app-spinner [size]="20" label="Cargando categorías…" />
                    </div>
                  } @else {
                    @if (selectedDetail(); as detail) {
                    <p class="mb-3 text-sm text-content-muted">
                      Definí bloques y formato: Libre (docente crea columnas), Serie (S1…Sn) o
                      Casilla única. Arrastrá los grupos para reordenar; clic para editar.
                    </p>

                    <div class="planilla-editor-wrap overflow-x-auto rounded-lg border border-border-subtle bg-surface">
                      <div class="planilla-editor-inner inline-flex min-w-full">
                        <div class="planilla-sticky-cols sticky left-0 z-20 flex shrink-0">
                          <div class="planilla-student-col">
                            <div class="planilla-corner-header">Estudiante</div>
                            @for (ghost of editorGhostRows; track $index) {
                              <div class="planilla-ghost-cell planilla-ghost-name">{{ ghost }}</div>
                            }
                          </div>
                          <div class="planilla-prom-col">
                            <div class="planilla-corner-header">
                              Prom.
                              <span class="block text-[10px] font-normal text-content-muted"
                                >ponderado</span
                              >
                            </div>
                            @for (ghost of editorGhostRows; track $index) {
                              <div class="planilla-ghost-cell">—</div>
                            }
                          </div>
                        </div>

                        <div
                          class="flex"
                          cdkDropList
                          cdkDropListOrientation="horizontal"
                          [cdkDropListData]="detail.categories"
                          [cdkDropListDisabled]="reordering()"
                          (cdkDropListDropped)="onCategoryDrop($event, detail)"
                        >
                          @for (c of detail.categories; track c.publicUuid) {
                            <div
                              class="planilla-group"
                              cdkDrag
                              [class.planilla-group-selected]="
                                selectedCategoryUuid() === c.publicUuid
                              "
                              [ngClass]="categoryBandClass(editDraft(c).colorToken)"
                              (click)="selectCategory(c.publicUuid)"
                            >
                              <div class="planilla-group-header">
                                <button
                                  type="button"
                                  class="planilla-drag-handle"
                                  cdkDragHandle
                                  title="Arrastrar"
                                  (click)="$event.stopPropagation()"
                                >
                                  <app-icon name="grip-vertical" [size]="14" />
                                </button>
                                <span class="planilla-group-title">{{
                                  editDraft(c).name || 'Sin nombre'
                                }}</span>
                                @if (editDraft(c).columnMode === 'SERIES') {
                                  <span
                                    class="ml-auto inline-flex items-center gap-0.5"
                                    (click)="$event.stopPropagation()"
                                  >
                                    <button
                                      type="button"
                                      class="planilla-slot-btn"
                                      title="Quitar casilla"
                                      [disabled]="draftSlotPreview(c).length <= 1"
                                      (click)="removeSlot(c)"
                                    >
                                      −
                                    </button>
                                    <button
                                      type="button"
                                      class="planilla-slot-btn"
                                      title="Añadir casilla"
                                      [disabled]="draftSlotPreview(c).length >= 40"
                                      (click)="addSlot(c)"
                                    >
                                      +
                                    </button>
                                  </span>
                                }
                              </div>
                              <div class="planilla-slots-row">
                                @for (lab of editorSlotLabels(c); track $index) {
                                  <div class="planilla-slot">{{ lab }}</div>
                                }
                                @if (showEditorProm(c)) {
                                  <div class="planilla-slot planilla-slot-prom">Prom.</div>
                                }
                              </div>
                              @for (ghost of editorGhostRows; track $index) {
                                <div class="planilla-slots-row">
                                  @for (lab of editorSlotLabels(c); track $index) {
                                    <div class="planilla-ghost-cell">—</div>
                                  }
                                  @if (showEditorProm(c)) {
                                    <div class="planilla-ghost-cell">—</div>
                                  }
                                </div>
                              }
                            </div>
                          }
                        </div>

                        <div class="planilla-add-col shrink-0">
                          <button
                            type="button"
                            class="planilla-add-btn"
                            title="Añadir categoría"
                            [disabled]="!!addingCategory()"
                            (click)="addCategory(detail)"
                          >
                            @if (addingCategory()) {
                              <app-spinner [size]="14" label="Añadiendo" />
                            } @else {
                              <span aria-hidden="true">+</span>
                            }
                          </button>
                        </div>
                      </div>
                    </div>

                    @if (detail.categories.length === 0) {
                      <p class="mt-2 text-sm text-content-muted">
                        Esta plantilla no tiene categorías. Usá el + para añadir un bloque.
                      </p>
                    }

                    @if (selectedCategoryFrom(detail); as c) {
                      <div
                        class="mt-4 rounded-lg border border-border-subtle bg-surface p-3 sm:p-4"
                      >
                        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p class="text-sm font-semibold text-content">Editar bloque</p>
                          <div class="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              class="btn btn-primary btn-xs"
                              [disabled]="savingCategory() === c.publicUuid || !isDirty(c)"
                              (click)="saveCategory(c)"
                            >
                              @if (savingCategory() === c.publicUuid) {
                                Guardando…
                              } @else {
                                Guardar
                              }
                            </button>
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs text-danger-700"
                              [disabled]="deletingCategory() === c.publicUuid"
                              title="Eliminar categoría"
                              (click)="deleteCategory(c)"
                            >
                              @if (deletingCategory() === c.publicUuid) {
                                …
                              } @else {
                                <app-icon name="trash-2" [size]="14" />
                              }
                            </button>
                          </div>
                        </div>

                        <div
                          class="mb-3 flex flex-wrap gap-1.5"
                          role="group"
                          aria-label="Color"
                        >
                          @for (tok of colorTokens; track tok) {
                            <button
                              type="button"
                              class="h-7 w-7 rounded-full border-2 transition"
                              [class.border-content]="editDraft(c).colorToken === tok"
                              [class.border-transparent]="editDraft(c).colorToken !== tok"
                              [ngClass]="colorDotClass(tok)"
                              [attr.title]="tok"
                              [attr.aria-pressed]="editDraft(c).colorToken === tok"
                              (click)="patchDraft(c.publicUuid, { colorToken: tok })"
                            ></button>
                          }
                        </div>

                        <label class="label" [attr.for]="'gr-cat-name-' + c.publicUuid"
                          >Nombre</label
                        >
                        <input
                          class="input mb-4 w-full text-base font-medium sm:text-lg"
                          [id]="'gr-cat-name-' + c.publicUuid"
                          [ngModel]="editDraft(c).name"
                          (ngModelChange)="patchDraft(c.publicUuid, { name: $event })"
                        />

                        <p class="label mb-1.5">Formato</p>
                        <div class="mb-4 grid gap-2 sm:grid-cols-3">
                          @for (mode of columnModes; track mode.id) {
                            <button
                              type="button"
                              class="rounded-lg border px-3 py-2 text-left transition"
                              [class.border-sky-500]="editDraft(c).columnMode === mode.id"
                              [class.bg-sky-50]="editDraft(c).columnMode === mode.id"
                              [class.border-border-subtle]="
                                editDraft(c).columnMode !== mode.id
                              "
                              (click)="patchDraft(c.publicUuid, { columnMode: mode.id })"
                            >
                              <span class="block text-sm font-semibold text-content">{{
                                mode.label
                              }}</span>
                              <span class="mt-1 flex flex-wrap gap-1">
                                @if (mode.id === 'OPEN') {
                                  <span
                                    class="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] text-content-muted"
                                    >Docente crea</span
                                  >
                                } @else if (mode.id === 'SINGLE') {
                                  <span
                                    class="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] text-content-muted"
                                    >{{
                                      editDraft(c).columnMode === 'SINGLE'
                                        ? draftSlotPreview(c)[0] || 'Nota'
                                        : 'Nota'
                                    }}</span
                                  >
                                } @else {
                                  @for (
                                    lab of seriesPreviewLabels(c, mode.id);
                                    track lab
                                  ) {
                                    <span
                                      class="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] text-content-muted"
                                      >{{ lab }}</span
                                    >
                                  }
                                }
                              </span>
                            </button>
                          }
                        </div>

                        @if (editDraft(c).columnMode === 'SERIES') {
                          <div
                            class="mb-4 space-y-2 rounded-lg border border-border-subtle bg-surface-subtle/50 p-3"
                          >
                            <div class="flex flex-wrap items-end gap-3">
                              <div>
                                <label
                                  class="label"
                                  [attr.for]="'gr-slot-n-' + c.publicUuid"
                                  >Cantidad (N)</label
                                >
                                <input
                                  type="number"
                                  class="input input-sm w-20"
                                  min="1"
                                  max="40"
                                  [id]="'gr-slot-n-' + c.publicUuid"
                                  [ngModel]="editDraft(c).slotCount"
                                  (ngModelChange)="
                                    patchDraft(c.publicUuid, { slotCount: +$event })
                                  "
                                />
                              </div>
                              <div>
                                <label
                                  class="label"
                                  [attr.for]="'gr-slot-prefix-' + c.publicUuid"
                                  >Prefijo</label
                                >
                                <input
                                  class="input input-sm w-16"
                                  maxlength="8"
                                  [id]="'gr-slot-prefix-' + c.publicUuid"
                                  [ngModel]="editDraft(c).slotLabelPrefix"
                                  (ngModelChange)="
                                    patchDraft(c.publicUuid, {
                                      slotLabelPrefix: $event
                                    })
                                  "
                                />
                              </div>
                            </div>
                            <div class="flex flex-wrap gap-1">
                              @for (lab of draftSlotPreview(c); track lab) {
                                <span
                                  class="rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-xs text-content"
                                  >{{ lab }}</span
                                >
                              }
                            </div>
                            <div>
                              <label
                                class="label"
                                [attr.for]="'gr-slot-custom-' + c.publicUuid"
                                >Nombres personalizados</label
                              >
                              <input
                                class="input input-sm w-full"
                                [id]="'gr-slot-custom-' + c.publicUuid"
                                placeholder="S1, S2… (opcional, separados por coma)"
                                [ngModel]="editDraft(c).slotLabelsText"
                                (ngModelChange)="
                                  patchDraft(c.publicUuid, { slotLabelsText: $event })
                                "
                              />
                            </div>
                          </div>
                        }

                        @if (customizingWeights()) {
                          <div class="mb-4 max-w-[10rem]">
                            <label class="label" [attr.for]="'gr-weight-' + c.publicUuid"
                              >Peso</label
                            >
                            <input
                              type="number"
                              class="input input-sm w-full"
                              min="0"
                              max="999.99"
                              step="0.01"
                              [id]="'gr-weight-' + c.publicUuid"
                              [ngModel]="editDraft(c).weight"
                              (ngModelChange)="
                                patchDraft(c.publicUuid, { weight: +$event })
                              "
                            />
                          </div>
                        }

                        <div class="flex flex-col gap-2 sm:flex-row sm:gap-6">
                          <label
                            class="inline-flex cursor-pointer items-center gap-2 text-sm text-content"
                          >
                            <input
                              type="checkbox"
                              class="form-checkbox"
                              [ngModel]="editDraft(c).contributesToAverage"
                              (ngModelChange)="
                                patchDraft(c.publicUuid, {
                                  contributesToAverage: $event
                                })
                              "
                            />
                            <span>Cuenta en el Prom.</span>
                          </label>
                          <label
                            class="inline-flex cursor-pointer items-center gap-2 text-sm text-content"
                          >
                            <input
                              type="checkbox"
                              class="form-checkbox"
                              [ngModel]="editDraft(c).allowsTeacherColumns"
                              (ngModelChange)="
                                patchDraft(c.publicUuid, {
                                  allowsTeacherColumns: $event
                                })
                              "
                            />
                            <span>El docente puede añadir columnas</span>
                          </label>
                        </div>
                      </div>
                    } @else if (detail.categories.length > 0) {
                      <p class="mt-3 text-xs text-content-muted">
                        Seleccioná un bloque de la planilla para editarlo.
                      </p>
                    }

                    <div class="mt-4 rounded-lg border border-border-subtle bg-surface p-3">
                      <div class="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div class="min-w-0">
                          <span class="font-medium text-content">
                            {{ customizingWeights() ? 'Suma de pesos' : 'Pesos iguales' }}
                          </span>
                          @if (!customizingWeights()) {
                            <p class="mt-0.5 text-xs text-content-muted">
                              Cada categoría que aporta al promedio pesa lo mismo
                              (100÷{{ contributingCategoryCount() || 'N' }}).
                            </p>
                          }
                        </div>
                        <span
                          class="tabular-nums font-semibold"
                          [class.text-amber-700]="weightSum() !== 100"
                          [class.text-emerald-700]="weightSum() === 100"
                        >
                          {{ weightSum() }} / 100
                        </span>
                      </div>

                      @if (customizingWeights()) {
                        <ul class="mb-3 space-y-1.5">
                          @for (c of detail.categories; track c.publicUuid) {
                            <li
                              class="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-surface-subtle"
                              [class.ring-1]="selectedCategoryUuid() === c.publicUuid"
                              [class.ring-sky-300]="selectedCategoryUuid() === c.publicUuid"
                            >
                              <button
                                type="button"
                                class="min-w-0 flex-1 truncate text-left text-sm text-content"
                                (click)="selectedCategoryUuid.set(c.publicUuid)"
                                [title]="editDraft(c).name"
                              >
                                <span
                                  class="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                                  [ngClass]="colorDotClass(editDraft(c).colorToken)"
                                ></span>
                                {{ editDraft(c).name || 'Sin nombre' }}
                              </button>
                              <input
                                type="number"
                                class="input input-sm w-20 text-right tabular-nums"
                                min="0"
                                max="100"
                                step="0.5"
                                [attr.aria-label]="
                                  'Peso de ' + (editDraft(c).name || c.name)
                                "
                                [ngModel]="editDraft(c).weight"
                                (ngModelChange)="
                                  patchDraft(c.publicUuid, {
                                    weight:
                                      $event === '' || $event === null ? 0 : +$event,
                                  })
                                "
                              />
                              @if (isWeightDirty(c)) {
                                <span class="text-[10px] font-medium text-amber-700"
                                  >•</span
                                >
                              }
                            </li>
                          }
                        </ul>

                        <div class="h-2 overflow-hidden rounded-full bg-surface-subtle">
                          <div
                            class="h-2 rounded-full transition-all"
                            [style.width.%]="weightBarPercent()"
                            [ngClass]="
                              weightSum() === 100 ? 'bg-emerald-500' : 'bg-amber-400'
                            "
                          ></div>
                        </div>
                        @if (weightSum() !== 100) {
                          <p class="mt-2 text-xs text-amber-800">
                            La suma de pesos debería ser 100. Podés guardar igual; es un
                            aviso suave.
                          </p>
                        }

                        <div class="mt-3 flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs"
                            [disabled]="savingWeights()"
                            (click)="cancelCustomizingWeights()"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            class="btn btn-outline btn-xs"
                            [disabled]="
                              savingWeights() || contributingCategoryCount() === 0
                            "
                            (click)="returnToEqualWeights()"
                          >
                            Volver a pesos iguales
                          </button>
                          <button
                            type="button"
                            class="btn btn-primary btn-xs"
                            [disabled]="savingWeights() || !hasDirtyWeights()"
                            (click)="saveAllWeights()"
                          >
                            @if (savingWeights()) {
                              Guardando…
                            } @else {
                              Guardar
                            }
                          </button>
                        </div>
                      } @else {
                        <ul class="mb-3 space-y-1 text-sm text-content-muted">
                          @for (c of detail.categories; track c.publicUuid) {
                            <li class="flex items-center justify-between gap-2 px-1">
                              <span class="min-w-0 truncate">
                                <span
                                  class="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                                  [ngClass]="colorDotClass(editDraft(c).colorToken)"
                                ></span>
                                {{ editDraft(c).name || 'Sin nombre' }}
                                @if (!editDraft(c).contributesToAverage) {
                                  <span class="text-[10px]">(no aporta)</span>
                                }
                              </span>
                              <span class="tabular-nums text-content">
                                {{
                                  editDraft(c).contributesToAverage
                                    ? (editDraft(c).weight | number: '1.0-2')
                                    : '0'
                                }}
                              </span>
                            </li>
                          }
                        </ul>
                        <div class="flex justify-end">
                          <button
                            type="button"
                            class="btn btn-primary btn-xs"
                            [disabled]="savingWeights() || detail.categories.length === 0"
                            (click)="startCustomizingWeights()"
                          >
                            Personalizar pesos
                          </button>
                        </div>
                      }
                    </div>
                    }
                  }
                </div>
              }
            </div>
          }

          @if (inactiveMine().length > 0) {
            <div class="mt-4">
              <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">
                Otras plantillas (no activas)
              </p>
              <ul class="card divide-y divide-border-subtle overflow-hidden">
                @for (t of inactiveMine(); track t.publicUuid) {
                  <li class="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div class="min-w-0">
                      <p class="font-medium text-content">
                        {{ t.name }}
                        <span class="badge badge-neutral ml-2 text-[10px]">No activa</span>
                      </p>
                      <p class="text-xs text-content-muted">
                        {{ t.categoryCount }} categorías · scope {{ t.scope }}
                      </p>
                    </div>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      (click)="toggleExpand(t.publicUuid)"
                    >
                      <app-icon
                        [name]="expandedUuid() === t.publicUuid ? 'chevron-up' : 'chevron-down'"
                        [size]="16"
                      />
                      <span>{{
                        expandedUuid() === t.publicUuid ? 'Ocultar' : 'Ver categorías'
                      }}</span>
                    </button>
                  </li>
                  @if (expandedUuid() === t.publicUuid) {
                    <li class="border-t border-border-subtle bg-surface-subtle/40 px-4 py-3">
                      @if (detailLoading() === t.publicUuid) {
                        <div class="flex justify-center py-4">
                          <app-spinner [size]="18" label="Cargando…" />
                        </div>
                      } @else {
                        @if (selectedDetail(); as detail) {
                        <p class="mb-2 text-xs text-content-muted">
                          Plantilla no activa — podés revisar categorías; la del año es la
                          marcada como Activa.
                        </p>
                        <ul class="space-y-1 text-sm text-content">
                          @for (c of detail.categories; track c.publicUuid) {
                            <li class="flex items-center gap-2">
                              <span
                                class="inline-block h-2 w-2 rounded-full"
                                [ngClass]="colorDotClass(c.colorToken)"
                              ></span>
                              {{ c.name }}
                              <span class="text-content-muted">(peso {{ c.weight }})</span>
                            </li>
                          }
                        </ul>
                        }
                      }
                    </li>
                  }
                }
              </ul>
            </div>
          }
        }
      </section>
    }

    @if (preview(); as p) {
      <div
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-6"
        role="presentation"
        (click)="closePreview()"
      >
        <div
          class="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-surface shadow-xl"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="'gr-preview-title'"
          (click)="$event.stopPropagation()"
        >
          <header
            class="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5"
          >
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-content-subtle">
                Vista previa
              </p>
              <h3 id="gr-preview-title" class="text-lg font-semibold text-content">
                {{ p.listItem.name }}
              </h3>
              <p class="mt-1 text-sm text-content-muted">
                {{
                  p.detail.description ||
                    'Estructura de categorías y ejemplo de planilla (datos de muestra).'
                }}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="closePreview()"
              title="Cerrar"
            >
              <app-icon name="x" [size]="18" />
              <span class="sr-only">Cerrar</span>
            </button>
          </header>

          <div class="flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-5">
            <section aria-labelledby="gr-preview-cats">
              <h4 id="gr-preview-cats" class="mb-2 text-sm font-semibold text-content">
                Categorías
              </h4>
              @if (p.detail.categories.length === 0) {
                <p class="text-sm text-content-muted">Esta plantilla no define categorías.</p>
              } @else {
                <div class="overflow-x-auto rounded-lg border border-border-subtle">
                  <table class="w-full text-sm">
                    <thead
                      class="bg-surface-subtle text-left text-xs uppercase tracking-wide text-content-subtle"
                    >
                      <tr>
                        <th class="px-3 py-2 font-medium">Categoría</th>
                        <th class="px-3 py-2 font-medium">Color</th>
                        <th class="px-3 py-2 font-medium">Peso</th>
                        <th class="px-3 py-2 font-medium">→ Prom.</th>
                        <th class="px-3 py-2 font-medium">Docente +</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of p.detail.categories; track c.publicUuid) {
                        <tr class="border-t border-border-subtle">
                          <td class="px-3 py-2 font-medium text-content">{{ c.name }}</td>
                          <td class="px-3 py-2">
                            <span class="inline-flex items-center gap-2">
                              <span
                                class="inline-block h-2.5 w-2.5 rounded-full"
                                [ngClass]="colorDotClass(c.colorToken)"
                                aria-hidden="true"
                              ></span>
                              <span class="text-content-muted">{{ c.colorToken || '—' }}</span>
                            </span>
                          </td>
                          <td class="px-3 py-2 tabular-nums">{{ c.weight }}</td>
                          <td class="px-3 py-2">{{ c.contributesToAverage ? 'Sí' : 'No' }}</td>
                          <td class="px-3 py-2">{{ c.allowsTeacherColumns ? 'Sí' : 'No' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>

            <section aria-labelledby="gr-preview-mock">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 id="gr-preview-mock" class="text-sm font-semibold text-content">
                  Ejemplo de planilla
                </h4>
                <span class="badge badge-neutral text-[10px]">Datos de muestra</span>
              </div>
              <p class="mb-3 text-xs text-content-muted">
                Ilustración estática: no son alumnos reales ni se guarda nada. Así se ve el acta
                cuando el docente cree columnas dentro de cada categoría.
              </p>
              @if (p.mock; as mock) {
                <div class="overflow-x-auto rounded-lg border border-border-subtle">
                  <table class="w-full min-w-[36rem] border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr class="bg-surface-subtle text-left">
                        <th class="sticky left-0 z-[1] bg-surface-subtle px-2 py-2 font-medium">
                          Nombre
                        </th>
                        <th class="px-2 py-2 font-medium">Prom.</th>
                        @for (group of mock.groups; track group.category.publicUuid) {
                          <th
                            class="px-2 py-2 text-center font-semibold"
                            [attr.colspan]="group.columns.length + (showGroupProm(group) ? 1 : 0)"
                            [ngClass]="categoryBandClass(group.category.colorToken)"
                          >
                            {{ group.category.name }}
                          </th>
                        }
                      </tr>
                      <tr
                        class="border-t border-border-subtle bg-surface-subtle/80 text-content-subtle"
                      >
                        <th class="sticky left-0 z-[1] bg-surface-subtle/80 px-2 py-1"></th>
                        <th class="px-2 py-1"></th>
                        @for (group of mock.groups; track group.category.publicUuid) {
                          @for (col of group.columns; track col.key) {
                            <th class="px-2 py-1 text-center font-medium">{{ col.label }}</th>
                          }
                          @if (showGroupProm(group)) {
                            <th
                              class="px-2 py-1 text-center font-medium"
                              [ngClass]="categoryBandClass(group.category.colorToken)"
                            >
                              Prom
                            </th>
                          }
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of mock.rows; track row.name) {
                        <tr class="border-t border-border-subtle">
                          <td
                            class="sticky left-0 z-[1] bg-surface px-2 py-1.5 font-medium whitespace-nowrap"
                          >
                            {{ row.name }}
                          </td>
                          <td class="px-2 py-1.5 tabular-nums font-semibold">{{ row.prom }}</td>
                          @for (group of mock.groups; track group.category.publicUuid) {
                            @for (col of group.columns; track col.key) {
                              <td class="px-2 py-1.5 text-center tabular-nums">
                                {{ row.scores[col.key] }}
                              </td>
                            }
                            @if (showGroupProm(group)) {
                              <td
                                class="px-2 py-1.5 text-center tabular-nums font-medium"
                                [ngClass]="categoryBandClass(group.category.colorToken)"
                              >
                                {{ row.categoryProm[group.category.publicUuid] }}
                              </td>
                            }
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </section>
          </div>

          <footer
            class="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-4 py-3 sm:px-5"
          >
            <button type="button" class="btn btn-ghost btn-sm" (click)="closePreview()">
              Cerrar
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="!resolvedYear() || adopting() === p.listItem.publicUuid"
              (click)="adoptFromPreview()"
            >
              @if (adopting() === p.listItem.publicUuid) {
                <app-spinner [size]="14" label="Adoptando" />
              } @else {
                <app-icon
                  [name]="hasActiveTemplate() ? 'rotate-cw' : 'plus'"
                  [size]="14"
                />
              }
              <span>{{ adoptCtaLabel() }}</span>
            </button>
          </footer>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .planilla-editor-wrap {
        background: white;
      }
      .planilla-editor-inner {
        align-items: stretch;
      }
      /* Tokens del tema son "R G B" → hay que envolverlos en rgb(... / 1).
       * Si se usa var() crudo, el background es inválido y queda transparente. */
      .planilla-sticky-cols {
        background-color: rgb(var(--color-surface-subtle, 248 250 252) / 1);
        border-right: 1px solid rgb(var(--color-border-subtle, 241 245 249) / 1);
        box-shadow: 6px 0 10px -4px rgba(0, 0, 0, 0.18);
      }
      .planilla-student-col {
        min-width: 9.5rem;
        max-width: 12rem;
        background-color: rgb(var(--color-surface, 255 255 255) / 1);
      }
      .planilla-prom-col {
        min-width: 4.25rem;
        text-align: center;
        border-left: 1px solid rgb(var(--color-border-subtle, 241 245 249) / 1);
        background-color: rgb(var(--color-surface-muted, 241 245 249) / 1);
      }
      .planilla-corner-header {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 4.5rem;
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        border-bottom: 1px solid rgb(var(--color-border-subtle, 241 245 249) / 1);
        background-color: rgb(var(--color-surface-subtle, 248 250 252) / 1);
      }
      .planilla-sticky-cols .planilla-ghost-cell {
        background-color: rgb(var(--color-surface, 255 255 255) / 1);
      }
      .planilla-sticky-cols .planilla-prom-col .planilla-ghost-cell {
        background-color: rgb(var(--color-surface-muted, 241 245 249) / 1);
      }
      .planilla-group {
        min-width: 5.5rem;
        border-right: 1px solid var(--color-border-subtle, #e5e7eb);
        cursor: pointer;
        transition: box-shadow 0.15s ease, outline-color 0.15s ease;
      }
      .planilla-group:hover {
        filter: brightness(0.985);
      }
      .planilla-group-selected {
        outline: 2px solid var(--color-primary-500, #0ea5e9);
        outline-offset: -2px;
        z-index: 1;
      }
      .planilla-group-header {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        min-height: 2.25rem;
        padding: 0.35rem 0.4rem;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        text-align: center;
        border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
      }
      .planilla-group-title {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .planilla-drag-handle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.1rem;
        border: 0;
        background: transparent;
        cursor: grab;
        color: var(--color-content-muted, #6b7280);
        border-radius: 0.25rem;
      }
      .planilla-drag-handle:active {
        cursor: grabbing;
      }
      .planilla-slot-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.25rem;
        height: 1.25rem;
        border: 1px solid var(--color-border-subtle, #e5e7eb);
        border-radius: 0.25rem;
        background: rgba(255, 255, 255, 0.7);
        font-size: 0.75rem;
        line-height: 1;
        cursor: pointer;
      }
      .planilla-slot-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .planilla-slots-row {
        display: flex;
      }
      .planilla-slot {
        flex: 1;
        min-width: 2.75rem;
        padding: 0.25rem 0.35rem;
        font-size: 0.7rem;
        font-weight: 600;
        text-align: center;
        border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
        border-right: 1px solid var(--color-border-subtle, #e5e7eb);
        white-space: nowrap;
      }
      .planilla-slot:last-child {
        border-right: 0;
      }
      .planilla-slot-prom {
        font-style: italic;
        opacity: 0.9;
      }
      .planilla-ghost-cell {
        min-height: 2rem;
        padding: 0.35rem 0.5rem;
        font-size: 0.75rem;
        text-align: center;
        color: var(--color-content-muted, #9ca3af);
        border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
        border-right: 1px solid var(--color-border-subtle, #e5e7eb);
        background: rgba(255, 255, 255, 0.55);
        flex: 1;
        min-width: 2.75rem;
      }
      .planilla-ghost-name {
        text-align: left;
        border-right: 0;
        background: white;
      }
      .planilla-add-col {
        display: flex;
        align-items: stretch;
        min-width: 2.75rem;
        border-left: 1px dashed rgb(var(--color-border-subtle, 241 245 249) / 1);
        background-color: rgb(var(--color-surface-subtle, 248 250 252) / 1);
      }
      .planilla-add-btn {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        min-height: 100%;
        border: 0;
        background: transparent;
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-content-muted, #6b7280);
        cursor: pointer;
      }
      .planilla-add-btn:hover:not(:disabled) {
        background: rgba(14, 165, 233, 0.08);
        color: var(--color-primary-700, #0369a1);
      }
      .planilla-add-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .cat-band-amber {
        background: rgba(254, 243, 199, 0.55) !important;
      }
      .cat-band-green {
        background: rgba(220, 252, 231, 0.45) !important;
      }
      .cat-band-blue {
        background: rgba(219, 234, 254, 0.55) !important;
      }
      .cat-band-slate {
        background: rgba(241, 245, 249, 0.8) !important;
      }
      .cat-band-violet {
        background: rgba(237, 233, 254, 0.5) !important;
      }
      .cdk-drag-preview {
        box-sizing: border-box;
        opacity: 0.92;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        border-radius: 0.25rem;
      }
      .cdk-drag-placeholder {
        opacity: 0.35;
      }
      .cdk-drag-animating {
        transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
      }
    `,
  ],
})
export class GradeRegisterPageComponent implements OnInit {
  private readonly store = inject(AcademicStore);
  private readonly api = inject(GradeRegisterApiService);

  protected readonly years = this.store.years;
  protected readonly currentActive = this.store.currentActive;
  protected readonly colorTokens = GRADE_CATEGORY_COLOR_TOKENS;
  protected readonly catalogLevelTabs = CATALOG_LEVEL_TABS;
  protected readonly columnModes: { id: GradeCategoryColumnMode; label: string }[] = [
    { id: 'OPEN', label: 'Libre' },
    { id: 'SERIES', label: 'Serie' },
    { id: 'SINGLE', label: 'Única' },
  ];

  protected readonly yearFilter = signal<string | null>(null);
  protected readonly catalog = signal<GradeRegisterTemplateListItem[]>([]);
  protected readonly mine = signal<GradeRegisterTemplateListItem[]>([]);
  protected readonly catalogLevelFilter = signal<CatalogLevelFilter>('ALL');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly adopting = signal<string | null>(null);
  protected readonly expandedUuid = signal<string | null>(null);
  protected readonly detailLoading = signal<string | null>(null);
  protected readonly selectedDetail = signal<GradeRegisterTemplate | null>(null);
  protected readonly savingCategory = signal<string | null>(null);
  protected readonly deletingCategory = signal<string | null>(null);
  protected readonly addingCategory = signal(false);
  protected readonly reordering = signal(false);
  protected readonly savingWeights = signal(false);
  /** When false (default), weights are equal / read-only; Personalizar reveals editors. */
  protected readonly customizingWeights = signal(false);
  protected readonly previewLoading = signal<string | null>(null);
  protected readonly preview = signal<CatalogPreviewState | null>(null);
  protected readonly selectedCategoryUuid = signal<string | null>(null);
  protected readonly editorGhostRows = ['—', '—', '—'] as const;

  private readonly drafts = signal<Record<string, CategoryDraft>>({});

  protected readonly selectedCategory = computed(() => {
    const uuid = this.selectedCategoryUuid();
    const detail = this.selectedDetail();
    if (!uuid || !detail) return null;
    return detail.categories.find((c) => c.publicUuid === uuid) ?? null;
  });

  protected readonly resolvedYear = computed<AcademicYearRow | null>(() => {
    const id = this.yearFilter();
    if (id) return this.years().find((y) => y.publicUuid === id) ?? null;
    return this.currentActive() ?? null;
  });

  /** Active = mine item with isDefault; fallback first TENANT. */
  protected readonly activeMine = computed<GradeRegisterTemplateListItem | null>(() => {
    const items = this.mine();
    const byDefault = items.find((t) => t.isDefault);
    if (byDefault) return byDefault;
    return items.find((t) => t.scope === 'TENANT') ?? null;
  });

  protected readonly inactiveMine = computed(() => {
    const active = this.activeMine();
    if (!active) return this.mine();
    return this.mine().filter((t) => t.publicUuid !== active.publicUuid);
  });

  protected readonly filteredCatalog = computed(() => {
    const filter = this.catalogLevelFilter();
    const items = this.catalog();
    if (filter === 'ALL') return items;
    return items.filter((t) => (t.recommendedLevels ?? []).includes(filter));
  });

  protected readonly weightSum = computed(() => {
    const detail = this.selectedDetail();
    const drafts = this.drafts();
    if (!detail) return 0;
    const sum = detail.categories.reduce((acc, c) => {
      const d = drafts[c.publicUuid];
      return acc + (Number(d?.weight ?? c.weight) || 0);
    }, 0);
    return Math.round(sum * 100) / 100;
  });

  protected readonly contributingCategoryCount = computed(() => {
    const detail = this.selectedDetail();
    const drafts = this.drafts();
    if (!detail) return 0;
    return detail.categories.filter((c) => {
      const d = drafts[c.publicUuid];
      return !!(d?.contributesToAverage ?? c.contributesToAverage);
    }).length;
  });

  protected readonly hasDirtyWeights = computed(() => {
    const detail = this.selectedDetail();
    if (!detail) return false;
    // Touch drafts so the computed re-runs when weights change.
    const drafts = this.drafts();
    return detail.categories.some((c) => {
      const d = drafts[c.publicUuid];
      const w = Number(d?.weight ?? c.weight);
      return w !== Number(c.weight);
    });
  });

  protected weightBarPercent(): number {
    return Math.min(100, Math.max(0, this.weightSum()));
  }

  protected isWeightDirty(c: GradeCategory): boolean {
    return Number(this.editDraft(c).weight) !== Number(c.weight);
  }

  protected startCustomizingWeights(): void {
    this.customizingWeights.set(true);
  }

  protected cancelCustomizingWeights(): void {
    const detail = this.selectedDetail();
    if (detail) this.applyDetail(detail);
    this.customizingWeights.set(false);
  }

  protected async returnToEqualWeights(): Promise<void> {
    await this.equalizeWeights();
    this.customizingWeights.set(false);
  }

  /**
   * Distributes 100 across contributing categories (2 decimals; remainder on last).
   * Non-contributing categories get weight 0.
   */
  protected async equalizeWeights(): Promise<void> {
    const detail = this.selectedDetail();
    if (!detail || detail.categories.length === 0) return;

    const contributing = detail.categories.filter(
      (c) => !!this.editDraft(c).contributesToAverage,
    );
    const shares = this.distributeEqualShares(contributing.length);
    let shareIdx = 0;

    for (const c of detail.categories) {
      const contributes = !!this.editDraft(c).contributesToAverage;
      const nextWeight = contributes ? shares[shareIdx++] : 0;
      this.patchDraft(c.publicUuid, { weight: nextWeight });
    }

    if (!this.hasDirtyWeights()) return;

    this.savingWeights.set(true);
    this.error.set(null);
    try {
      // Snapshot after patches so we persist the equalized values.
      const updates = detail.categories
        .filter((c) => this.isWeightDirty(c))
        .map((c) => ({
          uuid: c.publicUuid,
          to: Number(this.editDraft(c).weight) || 0,
        }));
      let updated = detail;
      for (const u of updates) {
        updated = await firstValueFrom(this.api.updateCategory(u.uuid, { weight: u.to }));
      }
      this.applyDetail(updated);
      await this.reloadMine();
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.savingWeights.set(false);
    }
  }

  /** 100÷N with 2 decimals; last category absorbs remainder so sum === 100. */
  private distributeEqualShares(n: number): number[] {
    if (n <= 0) return [];
    const base = Math.floor((100 / n) * 100) / 100;
    const shares = Array.from({ length: n }, () => base);
    const sum = Math.round(base * n * 100) / 100;
    const remainder = Math.round((100 - sum) * 100) / 100;
    shares[n - 1] = Math.round((base + remainder) * 100) / 100;
    return shares;
  }

  protected async saveAllWeights(): Promise<void> {
    const detail = this.selectedDetail();
    if (!detail) return;

    // Snapshot BEFORE any applyDetail — intermediate responses would wipe
    // remaining dirty drafts and re-save stale weights.
    const updates = detail.categories
      .filter((c) => this.isWeightDirty(c))
      .map((c) => ({
        uuid: c.publicUuid,
        to: Number(this.editDraft(c).weight) || 0,
      }));
    if (updates.length === 0) return;

    this.savingWeights.set(true);
    this.error.set(null);
    try {
      let updated = detail;
      for (const u of updates) {
        updated = await firstValueFrom(
          this.api.updateCategory(u.uuid, { weight: u.to }),
        );
      }
      this.applyDetail(updated);
      await this.reloadMine();
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.savingWeights.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    await this.store.loadYears();
    await this.reload();
  }

  protected hasActiveTemplate(): boolean {
    return this.activeMine() != null;
  }

  protected adoptCtaLabel(): string {
    return this.hasActiveTemplate() ? 'Cambiar por esta…' : 'Usar esta plantilla';
  }

  protected levelLabel(code: string): string {
    switch (code) {
      case 'INICIAL':
        return 'Inicial';
      case 'PRIMARIA':
        return 'Primaria';
      case 'SECUNDARIA':
        return 'Secundaria';
      default:
        return code;
    }
  }

  protected draftSlotPreview(c: GradeCategory): string[] {
    const d = this.editDraft(c);
    return resolveSlotLabels({
      name: d.name,
      columnMode: d.columnMode,
      slotCount: d.slotCount,
      slotLabelPrefix: d.slotLabelPrefix,
      slotLabels: this.parseSlotLabelsText(d.slotLabelsText),
    });
  }

  /** Mini labels for format option buttons (SERIES preview even when not selected). */
  protected seriesPreviewLabels(c: GradeCategory, mode: GradeCategoryColumnMode): string[] {
    if (mode !== 'SERIES') return [];
    const d = this.editDraft(c);
    const n = Math.min(3, Math.max(1, Number(d.slotCount) || 3));
    const prefix = (d.slotLabelPrefix || 'S').trim() || 'S';
    return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
  }

  protected statusLabel(status: AcademicYearStatus): string {
    switch (status) {
      case AcademicYearStatus.Active:
        return 'Activo';
      case AcademicYearStatus.Closed:
        return 'Cerrado';
      case AcademicYearStatus.Planning:
        return 'Planificación';
      default:
        return String(status);
    }
  }

  protected async onYearChange(yearUuid: string | null): Promise<void> {
    this.yearFilter.set(yearUuid);
    this.expandedUuid.set(null);
    this.selectedDetail.set(null);
    await this.reloadMine({ expandActive: true });
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const catalog = await firstValueFrom(this.api.listCatalog());
      this.catalog.set(catalog);
      await this.reloadMine({ expandActive: true });
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  private async reloadMine(opts?: { expandActive?: boolean }): Promise<void> {
    const year = this.resolvedYear();
    if (!year) {
      this.mine.set([]);
      return;
    }
    try {
      const mine = await firstValueFrom(this.api.listMine(year.publicUuid));
      this.mine.set(mine);
      if (opts?.expandActive) {
        const active =
          mine.find((t) => t.isDefault) ?? mine.find((t) => t.scope === 'TENANT') ?? null;
        if (active && this.expandedUuid() !== active.publicUuid) {
          await this.toggleExpand(active.publicUuid);
        }
      }
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
      this.mine.set([]);
    }
  }

  protected async adoptOrReplace(t: GradeRegisterTemplateListItem): Promise<void> {
    const replace = this.hasActiveTemplate();
    if (replace) {
      const ok = confirm(
        `¿Cambiar la plantilla activa por «${t.name}»?\n\n` +
          'La plantilla actual se archivará. Si ya hay evaluaciones o notas ligadas, el cambio puede rechazarse.',
      );
      if (!ok) return;
    }
    await this.adopt(t, replace);
  }

  protected async adopt(
    t: GradeRegisterTemplateListItem,
    replaceActive = false,
  ): Promise<void> {
    const year = this.resolvedYear();
    if (!year) {
      this.error.set('Seleccioná un año académico activo antes de adoptar.');
      return;
    }
    this.adopting.set(t.publicUuid);
    this.error.set(null);
    try {
      const adopted = await firstValueFrom(
        this.api.adopt(t.publicUuid, {
          academicYearPublicUuid: year.publicUuid,
          scope: 'TENANT',
          setAsDefault: true,
          ...(replaceActive ? { replaceActive: true } : {}),
        }),
      );
      this.closePreview();
      await this.reloadMine();
      this.applyDetail(adopted);
      this.expandedUuid.set(adopted.publicUuid);
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.adopting.set(null);
    }
  }

  protected async openPreview(t: GradeRegisterTemplateListItem): Promise<void> {
    this.previewLoading.set(t.publicUuid);
    this.error.set(null);
    try {
      const detail = await firstValueFrom(this.api.get(t.publicUuid));
      this.preview.set({
        listItem: t,
        detail,
        mock: this.buildPreviewMock(detail.categories),
      });
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
      this.preview.set(null);
    } finally {
      this.previewLoading.set(null);
    }
  }

  protected closePreview(): void {
    this.preview.set(null);
  }

  protected async adoptFromPreview(): Promise<void> {
    const p = this.preview();
    if (!p) return;
    await this.adoptOrReplace(p.listItem);
  }

  @HostListener('document:keydown.escape')
  protected onEscapePreview(): void {
    if (this.preview()) this.closePreview();
  }

  protected colorDotClass(token: string | null | undefined): string {
    switch (token) {
      case 'amber':
        return 'bg-amber-400';
      case 'green':
        return 'bg-emerald-400';
      case 'blue':
        return 'bg-sky-400';
      case 'violet':
        return 'bg-violet-400';
      default:
        return 'bg-slate-400';
    }
  }

  protected colorBarClass(token: string | null | undefined): string {
    switch (token) {
      case 'amber':
        return 'bg-amber-400';
      case 'green':
        return 'bg-emerald-400';
      case 'blue':
        return 'bg-sky-400';
      case 'violet':
        return 'bg-violet-400';
      default:
        return 'bg-slate-400';
    }
  }

  protected categoryBandClass(token: string | null | undefined): string {
    switch (token) {
      case 'amber':
        return 'cat-band-amber';
      case 'green':
        return 'cat-band-green';
      case 'blue':
        return 'cat-band-blue';
      case 'violet':
        return 'cat-band-violet';
      default:
        return 'cat-band-slate';
    }
  }

  /** Prom. del bloque solo si aporta al promedio y hay más de una casilla. */
  protected showGroupProm(group: PreviewMockGroup): boolean {
    return group.category.contributesToAverage && group.columns.length > 1;
  }

  protected selectedCategoryFrom(detail: GradeRegisterTemplate): GradeCategory | null {
    const uuid = this.selectedCategoryUuid();
    if (!uuid) return null;
    return detail.categories.find((c) => c.publicUuid === uuid) ?? null;
  }

  protected selectCategory(uuid: string): void {
    this.selectedCategoryUuid.set(uuid);
  }

  /** Labels shown as slot chips in the planilla editor (OPEN → placeholder). */
  protected editorSlotLabels(c: GradeCategory): string[] {
    const d = this.editDraft(c);
    if (d.columnMode === 'OPEN') return ['Docente…'];
    const labels = this.draftSlotPreview(c);
    return labels.length > 0 ? labels : ['…'];
  }

  protected editorColspan(c: GradeCategory): number {
    return this.editorSlotLabels(c).length + (this.showEditorProm(c) ? 1 : 0);
  }

  protected showEditorProm(c: GradeCategory): boolean {
    const d = this.editDraft(c);
    if (!d.contributesToAverage) return false;
    if (d.columnMode === 'OPEN') return false;
    return this.draftSlotPreview(c).length > 1;
  }

  protected addSlot(c: GradeCategory): void {
    const d = this.editDraft(c);
    if (d.columnMode !== 'SERIES') return;
    const custom = this.parseSlotLabelsText(d.slotLabelsText);
    if (custom.length > 0) {
      if (custom.length >= 40) return;
      const prefix = (d.slotLabelPrefix || 'S').trim() || 'S';
      this.patchDraft(c.publicUuid, {
        slotLabelsText: [...custom, `${prefix}${custom.length + 1}`].join(', '),
        slotCount: custom.length + 1,
      });
      return;
    }
    const n = Math.min(40, Math.max(1, Number(d.slotCount) || 1) + 1);
    this.patchDraft(c.publicUuid, { slotCount: n });
  }

  protected removeSlot(c: GradeCategory): void {
    const d = this.editDraft(c);
    if (d.columnMode !== 'SERIES') return;
    const custom = this.parseSlotLabelsText(d.slotLabelsText);
    if (custom.length > 1) {
      const next = custom.slice(0, -1);
      this.patchDraft(c.publicUuid, {
        slotLabelsText: next.join(', '),
        slotCount: next.length,
      });
      return;
    }
    if (custom.length === 1) return;
    const n = Math.max(1, (Number(d.slotCount) || 1) - 1);
    this.patchDraft(c.publicUuid, { slotCount: n });
  }

  protected async onCategoryDrop(
    event: CdkDragDrop<GradeCategory[]>,
    detail: GradeRegisterTemplate,
  ): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const cats = [...detail.categories];
    moveItemInArray(cats, event.previousIndex, event.currentIndex);
    this.reordering.set(true);
    this.error.set(null);
    try {
      for (let i = 0; i < cats.length; i++) {
        const sortOrder = i + 1;
        if (cats[i].sortOrder !== sortOrder) {
          await firstValueFrom(
            this.api.updateCategory(cats[i].publicUuid, { sortOrder }),
          );
        }
      }
      const uuid = this.expandedUuid();
      if (uuid) {
        const updated = await firstValueFrom(this.api.get(uuid));
        this.applyDetail(updated);
      }
      await this.reloadMine();
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.reordering.set(false);
    }
  }

  private buildPreviewMock(categories: GradeCategory[]): {
    groups: PreviewMockGroup[];
    rows: PreviewMockRow[];
  } {
    const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const groups: PreviewMockGroup[] = sorted.map((category) => {
      const labels = resolveSlotLabels(category);
      const columns =
        labels.length > 0
          ? labels.map((label, idx) => ({
              key: `${category.publicUuid}:${idx}:${label}`,
              label,
            }))
          : [
              {
                key: `${category.publicUuid}:hint`,
                label: '…',
              },
            ];
      return { category, columns };
    });

    const baseScores = [
      [18, 15, 16, 17, 14, 16, 13, 15, 17, 16],
      [12, 14, 13, 15, 14, 14, 12, 13, 14, 13],
      [10, 12, 11, 12, 13, 12, 11, 10, 12, 11],
    ];

    const rows: PreviewMockRow[] = PREVIEW_STUDENT_NAMES.map((name, rowIdx) => {
      const scores: Record<string, number> = {};
      const categoryProm: Record<string, string> = {};
      let scoreIdx = 0;
      const contributing: { weight: number; avg: number }[] = [];

      for (const group of groups) {
        const colScores: number[] = [];
        const hasRealSlots = resolveSlotLabels(group.category).length > 0;
        for (const col of group.columns) {
          if (!hasRealSlots) {
            scores[col.key] = 0;
            continue;
          }
          const pool = baseScores[rowIdx] ?? baseScores[0];
          const value = pool[scoreIdx % pool.length] ?? 14;
          scores[col.key] = value;
          colScores.push(value);
          scoreIdx += 1;
        }
        if (!hasRealSlots || colScores.length === 0) {
          continue;
        }
        const avg =
          colScores.reduce((sum, n) => sum + n, 0) / Math.max(colScores.length, 1);
        if (group.category.contributesToAverage) {
          if (group.columns.length > 1) {
            categoryProm[group.category.publicUuid] = avg.toFixed(1);
          }
          contributing.push({ weight: Number(group.category.weight) || 0, avg });
        }
      }

      const weightSum = contributing.reduce((s, c) => s + c.weight, 0);
      const prom =
        weightSum > 0
          ? (
              contributing.reduce((s, c) => s + c.avg * c.weight, 0) / weightSum
            ).toFixed(1)
          : '—';

      return { name, prom, scores, categoryProm };
    });

    return { groups, rows };
  }

  protected async toggleExpand(uuid: string): Promise<void> {
    if (this.expandedUuid() === uuid) {
      this.expandedUuid.set(null);
      this.selectedDetail.set(null);
      this.selectedCategoryUuid.set(null);
      this.customizingWeights.set(false);
      return;
    }
    this.expandedUuid.set(uuid);
    this.selectedCategoryUuid.set(null);
    this.customizingWeights.set(false);
    this.detailLoading.set(uuid);
    this.error.set(null);
    try {
      const detail = await firstValueFrom(this.api.get(uuid));
      this.applyDetail(detail);
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
      this.expandedUuid.set(null);
      this.selectedDetail.set(null);
    } finally {
      this.detailLoading.set(null);
    }
  }

  protected editDraft(c: GradeCategory): CategoryDraft {
    return (
      this.drafts()[c.publicUuid] ?? {
        name: c.name,
        colorToken: c.colorToken || 'slate',
        weight: c.weight,
        contributesToAverage: c.contributesToAverage,
        allowsTeacherColumns: c.allowsTeacherColumns,
        sortOrder: c.sortOrder,
        columnMode: c.columnMode ?? 'OPEN',
        slotCount: c.slotCount ?? 10,
        slotLabelPrefix: c.slotLabelPrefix || 'S',
        slotLabelsText: (c.slotLabels ?? []).join(', '),
      }
    );
  }

  protected patchDraft(uuid: string, patch: Partial<CategoryDraft>): void {
    this.drafts.update((d) => {
      let base = d[uuid];
      if (!base) {
        const cat = this.selectedDetail()?.categories.find((c) => c.publicUuid === uuid);
        if (!cat) return d;
        base = {
          name: cat.name,
          colorToken: cat.colorToken || 'slate',
          weight: cat.weight,
          contributesToAverage: cat.contributesToAverage,
          allowsTeacherColumns: cat.allowsTeacherColumns,
          sortOrder: cat.sortOrder,
          columnMode: cat.columnMode ?? 'OPEN',
          slotCount: cat.slotCount ?? 10,
          slotLabelPrefix: cat.slotLabelPrefix || 'S',
          slotLabelsText: (cat.slotLabels ?? []).join(', '),
        };
      }
      return { ...d, [uuid]: { ...base, ...patch } };
    });
  }

  protected isDirty(c: GradeCategory): boolean {
    const d = this.editDraft(c);
    const labels = this.parseSlotLabelsText(d.slotLabelsText);
    const originalLabels = c.slotLabels ?? [];
    return (
      d.name.trim() !== c.name ||
      (d.colorToken || '') !== (c.colorToken || '') ||
      Number(d.weight) !== Number(c.weight) ||
      !!d.contributesToAverage !== !!c.contributesToAverage ||
      !!d.allowsTeacherColumns !== !!c.allowsTeacherColumns ||
      d.columnMode !== (c.columnMode ?? 'OPEN') ||
      (d.columnMode === 'SERIES' && Number(d.slotCount) !== Number(c.slotCount ?? 0)) ||
      (d.slotLabelPrefix || 'S') !== (c.slotLabelPrefix || 'S') ||
      labels.join('|') !== originalLabels.join('|')
    );
  }

  protected async saveCategory(c: GradeCategory): Promise<void> {
    const d = this.editDraft(c);
    const name = d.name.trim();
    if (!name) {
      this.error.set('El nombre de la categoría no puede estar vacío.');
      return;
    }
    const contributesChanged =
      !!d.contributesToAverage !== !!c.contributesToAverage;
    this.savingCategory.set(c.publicUuid);
    this.error.set(null);
    try {
      const slotLabels = this.parseSlotLabelsText(d.slotLabelsText);
      const updated = await firstValueFrom(
        this.api.updateCategory(c.publicUuid, {
          name,
          colorToken: d.colorToken || null,
          weight: this.customizingWeights() ? d.weight : c.weight,
          contributesToAverage: d.contributesToAverage,
          allowsTeacherColumns: d.allowsTeacherColumns,
          sortOrder: d.sortOrder,
          columnMode: d.columnMode,
          slotCount: d.columnMode === 'SERIES' ? d.slotCount : d.columnMode === 'SINGLE' ? 1 : null,
          slotLabelPrefix: d.slotLabelPrefix || 'S',
          slotLabels: slotLabels.length > 0 ? slotLabels : null,
        }),
      );
      this.applyDetail(updated);
      await this.reloadMine();
      if (!this.customizingWeights() && contributesChanged) {
        await this.equalizeWeights();
      }
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.savingCategory.set(null);
    }
  }

  protected async addCategory(detail: GradeRegisterTemplate): Promise<void> {
    this.addingCategory.set(true);
    this.error.set(null);
    const before = new Set(detail.categories.map((c) => c.publicUuid));
    const nextOrder =
      detail.categories.reduce((max, c) => Math.max(max, c.sortOrder), 0) + 1;
    const proposedName = this.nextUniqueCategoryName(detail.categories);
    try {
      const updated = await firstValueFrom(
        this.api.addCategory(detail.publicUuid, {
          name: proposedName,
          colorToken: 'slate',
          sortOrder: nextOrder,
          weight: 0,
          contributesToAverage: true,
          allowsTeacherColumns: true,
          columnMode: 'OPEN',
        }),
      );
      this.applyDetail(updated);
      const added =
        updated.categories.find((c) => !before.has(c.publicUuid)) ??
        [...updated.categories].sort((a, b) => a.sortOrder - b.sortOrder).at(-1) ??
        null;
      if (added) this.selectedCategoryUuid.set(added.publicUuid);
      await this.reloadMine();
      if (!this.customizingWeights()) {
        await this.equalizeWeights();
      }
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.addingCategory.set(false);
    }
  }

  /** First free "Nueva categoría N" not already used (case-insensitive). */
  private nextUniqueCategoryName(categories: GradeCategory[]): string {
    const taken = new Set(categories.map((c) => c.name.trim().toLowerCase()));
    let n = categories.length + 1;
    for (;;) {
      const name = `Nueva categoría ${n}`;
      if (!taken.has(name.toLowerCase())) return name;
      n += 1;
    }
  }

  protected async deleteCategory(c: GradeCategory): Promise<void> {
    if (!confirm(`¿Eliminar la categoría «${c.name}»?`)) return;
    this.deletingCategory.set(c.publicUuid);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.deleteCategory(c.publicUuid));
      if (this.selectedCategoryUuid() === c.publicUuid) {
        this.selectedCategoryUuid.set(null);
      }
      const uuid = this.expandedUuid();
      if (uuid) {
        const detail = await firstValueFrom(this.api.get(uuid));
        this.applyDetail(detail);
      }
      await this.reloadMine();
      if (!this.customizingWeights() && this.selectedDetail()?.categories.length) {
        await this.equalizeWeights();
      }
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.deletingCategory.set(null);
    }
  }

  protected async moveCategory(
    detail: GradeRegisterTemplate,
    index: number,
    delta: number,
  ): Promise<void> {
    const target = index + delta;
    if (target < 0 || target >= detail.categories.length) return;
    const a = detail.categories[index];
    const b = detail.categories[target];
    this.reordering.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.api.updateCategory(a.publicUuid, { sortOrder: b.sortOrder }),
      );
      const updated = await firstValueFrom(
        this.api.updateCategory(b.publicUuid, { sortOrder: a.sortOrder }),
      );
      this.applyDetail(updated);
      await this.reloadMine();
    } catch (err) {
      this.error.set(this.toErrorMessage(err));
    } finally {
      this.reordering.set(false);
    }
  }

  private applyDetail(detail: GradeRegisterTemplate): void {
    this.selectedDetail.set(detail);
    const next: Record<string, CategoryDraft> = {};
    for (const c of detail.categories) {
      next[c.publicUuid] = {
        name: c.name,
        colorToken: c.colorToken || 'slate',
        weight: c.weight,
        contributesToAverage: c.contributesToAverage,
        allowsTeacherColumns: c.allowsTeacherColumns,
        sortOrder: c.sortOrder,
        columnMode: c.columnMode ?? 'OPEN',
        slotCount: c.slotCount ?? 10,
        slotLabelPrefix: c.slotLabelPrefix || 'S',
        slotLabelsText: (c.slotLabels ?? []).join(', '),
      };
    }
    this.drafts.set(next);
    const selected = this.selectedCategoryUuid();
    if (selected && !detail.categories.some((c) => c.publicUuid === selected)) {
      this.selectedCategoryUuid.set(null);
    }
  }

  private parseSlotLabelsText(text: string): string[] {
    return text
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const http = err as {
        status?: number;
        message?: unknown;
        error?: {
          message?: unknown;
          code?: unknown;
          error?: { message?: unknown; code?: unknown };
        };
      };
      const body = http.error;
      const msgCandidates = [
        body?.error?.message,
        body?.message,
        http.message,
      ];
      const msg = msgCandidates.find((m): m is string => typeof m === 'string' && m.length > 0);
      const code =
        (typeof body?.error?.code === 'string' && body.error.code) ||
        (typeof body?.code === 'string' && body.code) ||
        null;

      if (msg) {
        if (code === 'GRADE_REGISTER_IN_USE' || http.status === 409) {
          return msg;
        }
        return msg;
      }
      if (code === 'GRADE_REGISTER_IN_USE' || http.status === 409) {
        return 'No se puede cambiar la plantilla: está en uso (hay evaluaciones o notas vinculadas).';
      }
    }
    return 'Ocurrió un error inesperado.';
  }
}

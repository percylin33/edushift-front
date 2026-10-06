import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  EVALUATION_KIND_LABELS,
  EVALUATION_SCALE_LABELS,
  EVALUATION_STATUS_LABELS,
  EvaluationKind,
  EvaluationScale,
  EvaluationStatus,
} from '@features/evaluations/models';
import { GradeRecordsApiService } from '@features/grade-records/services';
import { areGradesEditable } from '@features/grade-records/models';
import {
  ENROLLMENT_STATUS_LABELS,
  GradeBookCategoryGroup,
  GradeBookEvaluation,
  GradeBookStudent,
  KIND_GROUP_BAND_CLASS,
  categoryBandClass,
  cellKey,
  formatSalonLabel,
} from '../../models';
import { GradeBookStore } from '../../store';

/**
 * `/evaluations/by-assignment/:assignmentUuid/gradebook` — Grade book
 * matrix (FE-5B.4 / F0–F4 formal register).
 */
@Component({
  selector: 'app-gradebook-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    EmptyStateComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Registro de notas"
        [title]="title()"
        [subtitle]="subtitle()"
      >
        <button type="button" class="btn btn-ghost btn-sm" (click)="goBack()">
          <app-icon name="chevron-left" [size]="16" />
          <span>Volver</span>
        </button>
        <button
          type="button"
          class="btn btn-outline btn-sm"
          [disabled]="loading() || !!exporting()"
          (click)="exportExcel()"
          title="Exportar Excel"
        >
          <app-icon name="download" [size]="16" />
          <span>Excel</span>
        </button>
        <button
          type="button"
          class="btn btn-outline btn-sm"
          [disabled]="loading() || !!exporting()"
          (click)="exportPdf()"
          title="Exportar PDF"
        >
          <app-icon name="printer" [size]="16" />
          <span>PDF</span>
        </button>
        <button
          type="button"
          class="btn btn-ghost btn-sm"
          [disabled]="loading()"
          (click)="reload()"
        >
          <app-icon name="bar-chart" [size]="16" />
          <span>Actualizar</span>
        </button>
      </app-page-header>

      @if (gradebook(); as gb) {
        <section class="acta-header mb-3" aria-label="Datos del registro">
          <div class="acta-context">
            <span class="acta-context-item">
              <span class="acta-context-label">Salón</span>
              {{ salonLabel() }}
            </span>
            <span class="acta-sep" aria-hidden="true">·</span>
            <span class="acta-context-item">
              <span class="acta-context-label">Curso</span>
              {{ gb.courseName }}
            </span>
            <span class="acta-sep" aria-hidden="true">·</span>
            <span class="acta-context-item">
              <span class="acta-context-label">Periodo</span>
              {{ periodLabel() }}
            </span>
            <span class="acta-sep" aria-hidden="true">·</span>
            <span class="acta-context-item">
              <span class="acta-context-label">Profesor</span>
              {{ gb.teacherFullName || '—' }}
            </span>
            @if (gb.templateName) {
              <span class="acta-template-badge" [title]="gb.templateName">{{
                gb.templateName
              }}</span>
            }
          </div>
          <div class="acta-toolbar">
            <div
              class="fill-dir-toggle"
              role="group"
              [attr.aria-label]="fillDirectionLabel()"
              [title]="fillDirectionLabel()"
            >
              <button
                type="button"
                class="fill-dir-option"
                [class.fill-dir-active]="fillDirection() === 'right'"
                (click)="setFillDirection('right')"
                aria-label="Avance horizontal (izquierda a derecha)"
              >
                <app-icon name="arrow-right" [size]="14" />
              </button>
              <button
                type="button"
                class="fill-dir-option"
                [class.fill-dir-active]="fillDirection() === 'down'"
                (click)="setFillDirection('down')"
                aria-label="Avance vertical (arriba a abajo)"
              >
                <app-icon name="arrow-down" [size]="14" />
              </button>
            </div>
            <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                class="checkbox"
                [checked]="includeWithdrawn()"
                (change)="onToggleWithdrawn($event)"
              />
              <span>Mostrar Ret.</span>
            </label>
            <label class="inline-flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                class="checkbox"
                [checked]="includeTransferred()"
                (change)="onToggleTransferred($event)"
              />
              <span>Mostrar Trasl.</span>
            </label>
            <span class="acta-stat">{{ gb.students.length }} est.</span>
            <span class="acta-stat">{{ gb.evaluations.length }} reg.</span>
            <span
              class="acta-stat"
              [class.acta-stat-ok]="totalWeight() === 100"
              [class.acta-stat-warn]="totalWeight() !== 100 && totalWeight() > 0"
            >
              Σ {{ totalWeight() | number: '1.0-0' }}
            </span>
          </div>
        </section>
      }

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando registro de notas…" />
        </div>
      } @else if (errorBanner()) {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <p class="flex-1 text-sm">{{ errorBanner() }}</p>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
            Reintentar
          </button>
        </div>
      }

      @if (saveError(); as se) {
        <div class="alert alert-danger mb-3">
          <app-icon name="alert-circle" [size]="18" />
          <p class="flex-1 text-sm">{{ se }}</p>
          <button type="button" class="btn btn-ghost btn-sm" (click)="saveError.set(null)">
            Cerrar
          </button>
        </div>
      }

      @if (!loading() && gradebook(); as gb) {
        @if (gb.students.length === 0 && gb.evaluations.length === 0) {
          <app-empty-state
            icon="bar-chart"
            title="Aún no hay nada que mostrar"
            description="Esta asignación no tiene estudiantes inscritos ni registros."
          />
        } @else if (gb.students.length === 0) {
          <app-empty-state
            icon="users"
            title="Sin estudiantes inscritos"
            description="La sección no tiene matriculados con los filtros actuales."
          />
        } @else if (gb.evaluations.length === 0 && !gb.hasCategoryLayout) {
          <app-empty-state
            icon="target"
            title="Sin registros"
            description="Crea registros desde la pantalla de la asignación para empezar a llenar el libro."
          >
            <button type="button" class="btn btn-primary btn-sm" (click)="goToEvaluations()">
              <app-icon name="plus" [size]="16" />
              <span>Ir a registros</span>
            </button>
          </app-empty-state>
        } @else {
          @if (hasEmptyCategories()) {
            <div class="empty-cats-hint mb-3">
              <app-icon name="info" [size]="14" />
              <p>
                Hay categorías sin columnas.
                <button type="button" class="link-btn" (click)="goToEvaluations()">
                  Ir a registros
                </button>
              </p>
            </div>
          }

          <section class="card hidden md:block gradebook-card">
            <div class="gradebook-scroll" tabindex="0">
              <table class="gradebook-table">
                <thead>
                  <tr>
                    <th class="sticky-left sticky-top student-col" rowspan="2">Estudiante</th>
                    <th class="sticky-left sticky-top avg-col" rowspan="2" title="Promedio ponderado">
                      Prom.
                    </th>
                    @if (gb.hasCategoryLayout) {
                      @for (group of gb.categoryGroups; track groupKey(group)) {
                        <th
                          class="sticky-top kind-group-header"
                          [attr.colspan]="group.colspan"
                          [ngClass]="categoryBandClass(group.colorToken)"
                        >
                          {{ group.label }}
                        </th>
                      }
                    } @else {
                      @for (group of gb.kindGroups; track group.kind) {
                        <th
                          class="sticky-top kind-group-header"
                          [attr.colspan]="group.evaluations.length"
                          [ngClass]="kindBand(group.kind)"
                        >
                          {{ kindLabel(group.kind) }}
                        </th>
                      }
                    }
                  </tr>
                  <tr>
                    @if (gb.hasCategoryLayout) {
                      @for (group of gb.categoryGroups; track groupKey(group)) {
                        @if (group.evaluations.length === 0) {
                          <th
                            class="sticky-top eval-col eval-col-compact"
                            [ngClass]="categoryBandClass(group.colorToken)"
                          >
                            <button
                              type="button"
                              class="eval-header empty-cat-cta"
                              (click)="goToEvaluations()"
                              title="Crear un registro en esta categoría"
                            >
                              <app-icon name="plus" [size]="12" />
                            </button>
                          </th>
                        } @else {
                          @for (e of group.evaluations; track e.publicUuid) {
                            <th
                              class="sticky-top eval-col"
                              [class.eval-col-compact]="isCompactEval(e, group)"
                              [ngClass]="categoryBandClass(group.colorToken)"
                              [title]="evaluationTitle(e)"
                            >
                              <button
                                type="button"
                                class="eval-header"
                                (click)="goToEvaluation(e.publicUuid)"
                              >
                                <span class="eval-name">{{ e.name }}</span>
                                <span
                                  class="status-dot"
                                  [ngClass]="statusDotClass(e.status)"
                                  [attr.aria-label]="statusLabel(e.status)"
                                ></span>
                              </button>
                            </th>
                          }
                          @if (group.showCategoryAverage) {
                            <th
                              class="sticky-top eval-col eval-col-compact text-center"
                              [ngClass]="categoryBandClass(group.colorToken)"
                              title="Promedio de categoría"
                            >
                              Prom.
                            </th>
                          }
                        }
                      }
                    } @else {
                      @for (group of gb.kindGroups; track group.kind) {
                        @for (e of group.evaluations; track e.publicUuid) {
                          <th
                            class="sticky-top eval-col"
                            [class.eval-col-compact]="isCompactEval(e, null, group.evaluations.length)"
                            [ngClass]="kindBand(group.kind)"
                            [title]="evaluationTitle(e)"
                          >
                            <button
                              type="button"
                              class="eval-header"
                              (click)="goToEvaluation(e.publicUuid)"
                            >
                              <span class="eval-name">{{ e.name }}</span>
                              <span
                                class="status-dot"
                                [ngClass]="statusDotClass(e.status)"
                                [attr.aria-label]="statusLabel(e.status)"
                              ></span>
                            </button>
                          </th>
                        }
                      }
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (s of gb.students; track s.publicUuid; let i = $index) {
                    <tr [class.row-withdrawn]="isInactiveEnrollment(s)">
                      <th
                        class="sticky-left student-col text-left"
                        [attr.title]="s.fullName"
                      >
                        <p class="student-name" [attr.title]="s.fullName">
                          <span class="student-idx">{{ i + 1 }}.</span>
                          {{ s.fullName }}
                          @if (enrollmentBadge(s); as badge) {
                            <span class="badge badge-neutral ml-1 text-[10px]">{{ badge }}</span>
                          }
                        </p>
                      </th>
                      <td class="sticky-left avg-col">
                        @if (s.weightedAverage !== null) {
                          <span
                            class="avg-value"
                            [class.text-success-700]="s.weightedAverage >= 14"
                            [class.text-danger-700]="s.weightedAverage < 11"
                          >
                            {{ s.weightedAverage | number: '1.0-2' }}
                          </span>
                        } @else {
                          <span class="text-content-muted">—</span>
                        }
                      </td>
                      @if (gb.hasCategoryLayout) {
                        @for (group of gb.categoryGroups; track groupKey(group)) {
                          @if (group.evaluations.length === 0) {
                            <td
                              class="cell cell-empty text-center"
                              [ngClass]="categoryBandClass(group.colorToken)"
                            >
                              <span class="text-content-muted">—</span>
                            </td>
                          } @else {
                            @for (e of group.evaluations; track e.publicUuid) {
                              <td
                                class="cell"
                                [class.eval-col-compact]="isCompactEval(e, group)"
                                [ngClass]="categoryBandClass(group.colorToken)"
                                [class.cell-empty]="!hasCell(s, e)"
                                [class.cell-warning]="
                                  !hasCell(s, e) && e.status === statusPublished
                                "
                                [class.cell-final]="hasScore(s, e) && e.status === statusClosed"
                                [title]="cellTitle(s, e)"
                              >
                                @if (canInlineEdit(e)) {
                                  <input
                                    type="number"
                                    class="score-input"
                                    min="0"
                                    max="20"
                                    step="0.01"
                                    [attr.data-cell-key]="cellKeyOf(s, e)"
                                    [disabled]="savingCell() === cellKeyOf(s, e)"
                                    [ngModel]="scoreInputValue(s, e)"
                                    (ngModelChange)="onScoreDraft(s, e, $event)"
                                    (input)="onScoreInput(s, e, $event)"
                                    (blur)="onScoreBlur(s, e)"
                                    (keydown)="onScoreKeydown($event, s, e)"
                                    (wheel)="onScoreWheel($event)"
                                    (click)="$event.stopPropagation()"
                                  />
                                } @else {
                                  <button
                                    type="button"
                                    class="cell-btn"
                                    (click)="goToEvaluation(e.publicUuid)"
                                  >
                                    @if (cellScore(s, e); as score) {
                                      <span class="font-mono tabular-nums">
                                        {{ score | number: '1.0-2' }}
                                      </span>
                                    } @else {
                                      @if (cellLiteral(s, e); as literal) {
                                        <span class="badge badge-neutral font-mono">{{ literal }}</span>
                                      } @else {
                                        <span class="text-content-muted">—</span>
                                      }
                                    }
                                  </button>
                                }
                              </td>
                            }
                            @if (group.showCategoryAverage && group.category) {
                              <td
                                class="cell eval-col-compact text-center font-mono tabular-nums"
                                [ngClass]="categoryBandClass(group.colorToken)"
                              >
                                @if (categoryAvg(s, group.category.publicUuid); as avg) {
                                  {{ avg | number: '1.0-2' }}
                                } @else {
                                  <span class="text-content-muted">—</span>
                                }
                              </td>
                            }
                          }
                        }
                      } @else {
                        @for (group of gb.kindGroups; track group.kind) {
                          @for (e of group.evaluations; track e.publicUuid) {
                            <td
                              class="cell"
                              [class.eval-col-compact]="isCompactEval(e, null, group.evaluations.length)"
                              [ngClass]="kindBand(group.kind)"
                              [class.cell-empty]="!hasCell(s, e)"
                              [class.cell-warning]="
                                !hasCell(s, e) && e.status === statusPublished
                              "
                              [class.cell-final]="hasScore(s, e) && e.status === statusClosed"
                              [title]="cellTitle(s, e)"
                            >
                              @if (canInlineEdit(e)) {
                                <input
                                  type="number"
                                  class="score-input"
                                  min="0"
                                  max="20"
                                  step="0.01"
                                  [attr.data-cell-key]="cellKeyOf(s, e)"
                                  [disabled]="savingCell() === cellKeyOf(s, e)"
                                  [ngModel]="scoreInputValue(s, e)"
                                  (ngModelChange)="onScoreDraft(s, e, $event)"
                                  (input)="onScoreInput(s, e, $event)"
                                  (blur)="onScoreBlur(s, e)"
                                  (keydown)="onScoreKeydown($event, s, e)"
                                  (wheel)="onScoreWheel($event)"
                                  (click)="$event.stopPropagation()"
                                />
                              } @else {
                                <button
                                  type="button"
                                  class="cell-btn"
                                  (click)="goToEvaluation(e.publicUuid)"
                                >
                                  @if (cellScore(s, e); as score) {
                                    <span class="font-mono tabular-nums">
                                      {{ score | number: '1.0-2' }}
                                    </span>
                                  } @else {
                                    @if (cellLiteral(s, e); as literal) {
                                      <span class="badge badge-neutral font-mono">{{ literal }}</span>
                                    } @else {
                                      <span class="text-content-muted">—</span>
                                    }
                                  }
                                </button>
                              }
                            </td>
                          }
                        }
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <section class="grid gap-3 md:hidden">
            @for (s of gb.students; track s.publicUuid; let i = $index) {
              <article class="card" [class.opacity-60]="isInactiveEnrollment(s)">
                <header class="card-header flex items-center justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium" [attr.title]="s.fullName">
                      <span class="mr-1 font-mono text-xs text-content-muted"
                        >{{ i + 1 }}.</span
                      >{{ s.fullName }}
                      @if (enrollmentBadge(s); as badge) {
                        <span class="badge badge-neutral ml-1 text-[10px]">{{ badge }}</span>
                      }
                    </p>
                    <p class="text-xs text-content-muted">
                      Prom.:
                      @if (s.weightedAverage !== null) {
                        <strong class="tabular-nums">
                          {{ s.weightedAverage | number: '1.0-2' }}
                        </strong>
                      } @else {
                        —
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs"
                    (click)="toggleExpand(s.publicUuid)"
                  >
                    <app-icon
                      [name]="expanded().has(s.publicUuid) ? 'chevron-up' : 'chevron-down'"
                      [size]="16"
                    />
                  </button>
                </header>
                @if (expanded().has(s.publicUuid)) {
                  <div class="card-body grid gap-4">
                    @if (gb.hasCategoryLayout) {
                      @for (group of gb.categoryGroups; track groupKey(group)) {
                        <div>
                          <p
                            class="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted"
                          >
                            {{ group.label }}
                          </p>
                          @if (group.evaluations.length === 0) {
                            <button
                              type="button"
                              class="btn btn-ghost btn-sm w-full justify-start text-content-muted"
                              (click)="goToEvaluations()"
                            >
                              <app-icon name="plus" [size]="14" />
                              Sin columnas · Añadir registro
                            </button>
                          } @else {
                            <div class="grid gap-1">
                              @for (e of group.evaluations; track e.publicUuid) {
                                <div
                                  class="flex items-center justify-between gap-3 rounded-md px-3 py-2"
                                >
                                  <p class="truncate text-sm font-medium">{{ e.name }}</p>
                                  @if (canInlineEdit(e)) {
                                    <input
                                      type="number"
                                      class="score-input score-input-mobile"
                                      min="0"
                                      max="20"
                                      step="0.01"
                                      [attr.data-cell-key]="cellKeyOf(s, e)"
                                      [disabled]="savingCell() === cellKeyOf(s, e)"
                                      [ngModel]="scoreInputValue(s, e)"
                                      (ngModelChange)="onScoreDraft(s, e, $event)"
                                      (input)="onScoreInput(s, e, $event)"
                                      (blur)="onScoreBlur(s, e)"
                                      (keydown)="onScoreKeydown($event, s, e)"
                                      (wheel)="onScoreWheel($event)"
                                    />
                                  } @else {
                                    <button type="button" (click)="goToEvaluation(e.publicUuid)">
                                      @if (cellScore(s, e); as score) {
                                        <span class="font-mono text-sm tabular-nums">
                                          {{ score | number: '1.0-2' }}
                                        </span>
                                      } @else {
                                        <span class="text-sm text-content-muted">—</span>
                                      }
                                    </button>
                                  }
                                </div>
                              }
                            </div>
                          }
                        </div>
                      }
                    } @else {
                      @for (group of gb.kindGroups; track group.kind) {
                        <div>
                          <p
                            class="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted"
                          >
                            {{ kindLabel(group.kind) }}
                          </p>
                          <div class="grid gap-1">
                            @for (e of group.evaluations; track e.publicUuid) {
                              <div
                                class="flex items-center justify-between gap-3 rounded-md px-3 py-2"
                              >
                                <p class="truncate text-sm font-medium">{{ e.name }}</p>
                                @if (canInlineEdit(e)) {
                                  <input
                                    type="number"
                                    class="score-input score-input-mobile"
                                    min="0"
                                    max="20"
                                    step="0.01"
                                    [attr.data-cell-key]="cellKeyOf(s, e)"
                                    [disabled]="savingCell() === cellKeyOf(s, e)"
                                    [ngModel]="scoreInputValue(s, e)"
                                    (ngModelChange)="onScoreDraft(s, e, $event)"
                                    (input)="onScoreInput(s, e, $event)"
                                    (blur)="onScoreBlur(s, e)"
                                    (keydown)="onScoreKeydown($event, s, e)"
                                    (wheel)="onScoreWheel($event)"
                                  />
                                } @else {
                                  <button type="button" (click)="goToEvaluation(e.publicUuid)">
                                    @if (cellScore(s, e); as score) {
                                      <span class="font-mono text-sm tabular-nums">
                                        {{ score | number: '1.0-2' }}
                                      </span>
                                    } @else {
                                      <span class="text-sm text-content-muted">—</span>
                                    }
                                  </button>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      }
                    }
                  </div>
                }
              </article>
            }
          </section>
        }
      }
    </app-page-container>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* ---- Acta chrome ---- */
      .acta-header {
        border: 1px solid var(--color-border-subtle, #e5e7eb);
        border-radius: 0.5rem;
        padding: 0.625rem 1rem;
        background: var(--color-surface-subtle, #f9fafb);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .acta-context {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem 0.5rem;
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-content, #111827);
      }
      .acta-context-label {
        font-size: 0.65rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-content-muted, #6b7280);
        margin-right: 0.25rem;
      }
      .acta-sep {
        color: var(--color-content-muted, #9ca3af);
        font-weight: 400;
      }
      .acta-template-badge {
        margin-left: 0.25rem;
        max-width: 14rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.6875rem;
        font-weight: 500;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        background: white;
        border: 1px solid var(--color-border-subtle, #e5e7eb);
        color: var(--color-content-muted, #4b5563);
      }
      .acta-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem 1rem;
        color: var(--color-content-muted, #6b7280);
      }
      .acta-stat {
        font-size: 0.75rem;
        font-variant-numeric: tabular-nums;
        padding: 0.125rem 0.4rem;
        border-radius: 0.25rem;
        background: white;
        border: 1px solid var(--color-border-subtle, #e5e7eb);
      }
      .acta-stat-ok {
        background: rgba(34, 197, 94, 0.1);
        border-color: transparent;
        color: var(--color-success-700, #15803d);
      }
      .acta-stat-warn {
        background: rgba(251, 191, 36, 0.12);
        border-color: transparent;
        color: var(--color-warning-700, #b45309);
      }

      .empty-cats-hint {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
        font-size: 0.8125rem;
        color: var(--color-content-muted, #4b5563);
        background: rgba(59, 130, 246, 0.06);
        border: 1px solid rgba(59, 130, 246, 0.18);
        border-radius: 0.375rem;
      }
      .empty-cats-hint p {
        margin: 0;
      }
      .link-btn {
        background: none;
        border: 0;
        padding: 0;
        color: var(--color-primary-600, #2563eb);
        font-weight: 600;
        cursor: pointer;
        text-decoration: underline;
      }

      /* ---- Matrix ----
       * Scroll interno (X+Y) en un panel con altura de viewport:
       * - thead sticky funciona (categorías siempre visibles)
       * - scrollbar horizontal queda al borde inferior del panel
         (no hay que bajar hasta el final del acta)
       */
      .gradebook-card {
        /* Evita overflow:hidden en el ancestro: rompe position:sticky. */
        overflow: visible;
      }
      .gradebook-scroll {
        max-height: calc(100dvh - 12.5rem);
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-gutter: stable;
        border-radius: inherit;
        /* Barras siempre visibles en navegadores que lo soporten */
        scrollbar-width: thin;
      }
      .gradebook-table {
        width: max-content;
        min-width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 0.8125rem;
        --gb-cat-row-h: 1.75rem;
      }
      .gradebook-table th,
      .gradebook-table td {
        border-bottom: 1px solid var(--color-border-subtle, #e5e7eb);
        border-right: 1px solid var(--color-border-subtle, #e5e7eb);
        padding: 0.35rem 0.25rem;
        background-clip: padding-box;
      }
      .gradebook-table tbody tr:hover > th:not(.sticky-left),
      .gradebook-table tbody tr:hover > td:not(.sticky-left) {
        filter: brightness(0.985);
      }
      .kind-group-header {
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 0.65rem !important;
        font-weight: 700;
        padding: 0.4rem 0.35rem !important;
        position: sticky;
        top: 0;
        z-index: 22;
        box-shadow: 0 1px 0 rgb(var(--color-border-subtle, 229 231 235) / 1);
      }

      .sticky-left {
        position: sticky;
      }
      .sticky-top {
        position: sticky;
        top: 0;
      }
      /* Segunda fila del thead (nombres de registros) debajo de categorías */
      .gradebook-table thead tr:nth-child(2) > th.sticky-top {
        top: var(--gb-cat-row-h);
        z-index: 21;
        box-shadow: 0 2px 4px -2px rgba(0, 0, 0, 0.12);
      }

      /* Tokens del tema son "R G B" → hay que envolverlos en rgb(... / 1).
       * Si se usa var() crudo, el background es inválido y queda transparente. */
      .student-col {
        left: 0;
        width: 220px;
        min-width: 220px;
        max-width: 220px;
        text-align: left;
        padding-left: 0.75rem !important;
        padding-right: 0.75rem !important;
        background-color: rgb(var(--color-surface, 255 255 255) / 1) !important;
        z-index: 30;
      }
      thead .student-col {
        z-index: 40;
        background-color: rgb(var(--color-surface-subtle, 248 250 252) / 1) !important;
      }
      .avg-col {
        left: 220px;
        width: 72px;
        min-width: 72px;
        max-width: 72px;
        text-align: center;
        background-color: rgb(var(--color-surface-muted, 241 245 249) / 1) !important;
        z-index: 29;
        box-shadow: 6px 0 10px -4px rgba(0, 0, 0, 0.18);
      }
      thead .avg-col {
        z-index: 39;
        background-color: rgb(var(--color-surface-muted, 241 245 249) / 1) !important;
      }
      .avg-value {
        font-family: ui-monospace, monospace;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
      }
      .student-name {
        margin: 0;
        font-weight: 600;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .student-idx {
        margin-right: 0.35rem;
        font-family: ui-monospace, monospace;
        font-size: 0.7rem;
        font-weight: 500;
        color: var(--color-content-muted, #6b7280);
      }

      .eval-col {
        min-width: 96px;
        max-width: 120px;
        z-index: 20;
      }
      .eval-col-compact {
        min-width: 56px !important;
        width: 64px !important;
        max-width: 64px !important;
      }
      thead .eval-col {
        background-color: rgb(var(--color-surface-subtle, 248 250 252) / 1);
      }

      .eval-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.2rem;
        width: 100%;
        min-height: 2.25rem;
        text-align: center;
        cursor: pointer;
        background: transparent;
        border: 0;
        padding: 0.15rem;
      }
      .eval-header:hover .eval-name {
        text-decoration: underline;
      }
      .eval-name {
        display: block;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 600;
        font-size: 0.75rem;
        line-height: 1.1;
      }
      .eval-col-compact .eval-name {
        font-size: 0.7rem;
      }
      .status-dot {
        display: inline-block;
        width: 6px;
        height: 6px;
        border-radius: 9999px;
        flex-shrink: 0;
      }
      .status-dot-draft {
        background: #9ca3af;
      }
      .status-dot-published {
        background: #2563eb;
      }
      .status-dot-closed {
        background: #15803d;
      }
      .empty-cat-cta {
        min-height: 2.25rem;
        color: var(--color-primary-600, #2563eb);
      }

      .cell {
        text-align: center;
        vertical-align: middle;
      }
      .cell-btn {
        display: block;
        width: 100%;
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 0.15rem;
      }
      .cell-empty {
        color: var(--color-content-muted, #6b7280);
      }
      .cell-warning {
        box-shadow: inset 0 0 0 9999px rgba(251, 191, 36, 0.08);
      }
      .cell-final {
        box-shadow: inset 0 0 0 9999px rgba(34, 197, 94, 0.08);
        font-weight: 600;
      }
      .row-withdrawn {
        opacity: 0.55;
      }
      .score-input {
        width: 100%;
        max-width: 3.25rem;
        text-align: center;
        font-family: ui-monospace, monospace;
        font-size: 0.8125rem;
        border: 1px solid var(--color-border-subtle, #e5e7eb);
        border-radius: 0.3rem;
        padding: 0.2rem 0.15rem;
        background: white;
        -moz-appearance: textfield;
        appearance: textfield;
      }
      .score-input::-webkit-outer-spin-button,
      .score-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .score-input:focus {
        outline: 2px solid var(--color-primary-400, #60a5fa);
        outline-offset: 1px;
      }
      .score-input-mobile {
        max-width: 5rem;
      }
      .fill-dir-toggle {
        display: inline-flex;
        align-items: stretch;
        border: 1px solid var(--color-border-subtle, #e5e7eb);
        border-radius: 0.375rem;
        background: white;
        overflow: hidden;
      }
      .fill-dir-option {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.75rem;
        height: 1.5rem;
        padding: 0;
        border: 0;
        background: transparent;
        color: var(--color-content-muted, #6b7280);
        cursor: pointer;
        transition:
          background 0.12s ease,
          color 0.12s ease;
      }
      .fill-dir-option + .fill-dir-option {
        border-left: 1px solid var(--color-border-subtle, #e5e7eb);
      }
      .fill-dir-option:hover:not(.fill-dir-active) {
        background: #f1f5f9;
        color: var(--color-content, #111827);
      }
      .fill-dir-option.fill-dir-active {
        background: rgba(37, 99, 235, 0.1);
        color: var(--color-primary-700, #1d4ed8);
      }
      .fill-dir-option:focus-visible {
        outline: 2px solid var(--color-primary-400, #60a5fa);
        outline-offset: -1px;
        z-index: 1;
      }
      .kind-band-exam {
        background: rgba(254, 243, 199, 0.55) !important;
      }
      .kind-band-quiz {
        background: rgba(219, 234, 254, 0.55) !important;
      }
      .kind-band-task {
        background: rgba(220, 252, 231, 0.45) !important;
      }
      .kind-band-rubric {
        background: rgba(237, 233, 254, 0.5) !important;
      }
      .kind-band-competency {
        background: rgba(255, 237, 213, 0.5) !important;
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
        background: rgba(241, 245, 249, 0.85) !important;
      }
      .cat-band-violet {
        background: rgba(237, 233, 254, 0.5) !important;
      }
      /* Sticky student/avg must stay opaque even under category bands */
      .gradebook-table .student-col.cat-band-amber,
      .gradebook-table .student-col.cat-band-green,
      .gradebook-table .student-col.cat-band-blue,
      .gradebook-table .student-col.cat-band-slate,
      .gradebook-table .student-col.cat-band-violet,
      .gradebook-table .avg-col.cat-band-amber,
      .gradebook-table .avg-col.cat-band-green,
      .gradebook-table .avg-col.cat-band-blue,
      .gradebook-table .avg-col.cat-band-slate,
      .gradebook-table .avg-col.cat-band-violet {
        background-color: rgb(var(--color-surface, 255 255 255) / 1) !important;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.5rem;
        border-radius: 0.375rem;
        font-size: 0.75rem;
        line-height: 1.25rem;
      }
      .badge-neutral {
        background: var(--color-surface-subtle, #f3f4f6);
        color: var(--color-content, #111827);
      }
    `,
  ],
})
export class GradeBookPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(GradeBookStore);
  private readonly gradeRecordsApi = inject(GradeRecordsApiService);

  protected readonly categoryBandClass = categoryBandClass;

  protected readonly gradebook = this.store.gradebook;
  protected readonly loading = this.store.loading;
  protected readonly errorBanner = this.store.error;
  protected readonly totalWeight = this.store.totalWeight;
  protected readonly includeWithdrawn = this.store.includeWithdrawn;
  protected readonly includeTransferred = this.store.includeTransferred;
  protected readonly exporting = this.store.exporting;
  protected readonly savingCell = this.store.savingCell;

  protected readonly statusPublished = EvaluationStatus.PUBLISHED;
  protected readonly statusClosed = EvaluationStatus.CLOSED;

  protected readonly expanded = signal<Set<string>>(new Set());
  protected readonly saveError = signal<string | null>(null);
  private readonly scoreDrafts = signal<Record<string, string>>({});
  /** Dirección de avance al llenar notas: horizontal (→) o vertical (↓). */
  protected readonly fillDirection = signal<'right' | 'down'>('right');
  /** Celda a enfocar tras guardar (avance automático). */
  private pendingFocusKey: string | null = null;

  protected readonly title = computed(() => {
    const gb = this.gradebook();
    if (!gb) return 'Registro de notas';
    return `${gb.courseName} — ${formatSalonLabel(gb.sectionName, gb.gradeName)}`;
  });

  /** Categorías de plantilla sin ninguna evaluación (columnas) todavía. */
  protected readonly hasEmptyCategories = computed(() => {
    const gb = this.gradebook();
    if (!gb?.hasCategoryLayout) return false;
    return gb.categoryGroups.some((g) => g.category != null && g.evaluations.length === 0);
  });
  protected readonly subtitle = computed(() => {
    const gb = this.gradebook();
    if (!gb) return '';
    const period = this.periodLabel();
    return period ? `Promedio ponderado · ${period}` : 'Promedio ponderado calculado en vivo';
  });
  protected readonly salonLabel = computed(() => {
    const gb = this.gradebook();
    if (!gb) return '—';
    return formatSalonLabel(gb.sectionName, gb.gradeName);
  });
  protected readonly periodLabel = computed(() => {
    const gb = this.gradebook();
    if (!gb) return '';
    if (gb.periodName) return gb.periodName;
    if (!gb.periodType || !gb.periodOrdinal) return '';
    const typeLabel =
      gb.periodType === 'BIMESTRE'
        ? 'Bimestre'
        : gb.periodType === 'TRIMESTRE'
          ? 'Trimestre'
          : 'Anual';
    return gb.periodType === 'ANUAL' ? typeLabel : `${gb.periodOrdinal}° ${typeLabel.toLowerCase()}`;
  });

  private routeSub?: Subscription;
  private currentAssignmentUuid: string | null = null;

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    this.routeSub = this.route.paramMap.subscribe(async (params) => {
      const uuid = params.get('assignmentUuid');
      if (!uuid) {
        await this.router.navigate([ROUTES.DASHBOARD.ROOT]);
        return;
      }
      this.currentAssignmentUuid = uuid;
      await this.store.load(uuid);
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.store.clear();
  }

  protected groupKey(group: GradeBookCategoryGroup): string {
    return group.category?.publicUuid ?? `uncat:${group.label}`;
  }

  /**
   * Columnas densas tipo planilla: nombre corto (S1…Sn) o grupo con ≥5 evals.
   */
  protected isCompactEval(
    e: GradeBookEvaluation,
    group: GradeBookCategoryGroup | null = null,
    kindGroupSize?: number,
  ): boolean {
    if (/^S\d+$/i.test(e.name.trim())) return true;
    if (e.name.trim().length <= 4) return true;
    const size = group?.evaluations.length ?? kindGroupSize ?? 0;
    return size >= 5;
  }

  protected statusLabel(status: EvaluationStatus): string {
    return EVALUATION_STATUS_LABELS[status] ?? status;
  }

  protected statusDotClass(status: EvaluationStatus): string {
    switch (status) {
      case EvaluationStatus.PUBLISHED:
        return 'status-dot-published';
      case EvaluationStatus.CLOSED:
        return 'status-dot-closed';
      default:
        return 'status-dot-draft';
    }
  }

  protected kindBand(kind: EvaluationKind): string {
    return KIND_GROUP_BAND_CLASS[kind];
  }

  protected kindLabel(k: EvaluationKind): string {
    return EVALUATION_KIND_LABELS[k];
  }

  protected canInlineEdit(e: GradeBookEvaluation): boolean {
    return e.scale === EvaluationScale.SCORE_0_20 && areGradesEditable(e.status);
  }

  protected cellKeyOf(s: GradeBookStudent, e: GradeBookEvaluation): string {
    return cellKey(s.publicUuid, e.publicUuid);
  }

  protected hasCell(s: GradeBookStudent, e: GradeBookEvaluation): boolean {
    return this.gradebook()?.cellIndex.has(cellKey(s.publicUuid, e.publicUuid)) ?? false;
  }

  protected hasScore(s: GradeBookStudent, e: GradeBookEvaluation): boolean {
    return this.cellScore(s, e) !== null;
  }

  protected cellScore(s: GradeBookStudent, e: GradeBookEvaluation): number | null {
    return this.gradebook()?.cellIndex.get(cellKey(s.publicUuid, e.publicUuid))?.score ?? null;
  }

  protected cellLiteral(s: GradeBookStudent, e: GradeBookEvaluation): string | null {
    return this.gradebook()?.cellIndex.get(cellKey(s.publicUuid, e.publicUuid))?.literal ?? null;
  }

  protected categoryAvg(s: GradeBookStudent, categoryUuid: string): number | null {
    return s.categoryAverages.get(categoryUuid) ?? null;
  }

  protected scoreInputValue(s: GradeBookStudent, e: GradeBookEvaluation): string {
    const key = cellKey(s.publicUuid, e.publicUuid);
    const draft = this.scoreDrafts()[key];
    if (draft !== undefined) return draft;
    const score = this.cellScore(s, e);
    return score === null ? '' : String(score);
  }

  protected onScoreDraft(s: GradeBookStudent, e: GradeBookEvaluation, value: string): void {
    const key = cellKey(s.publicUuid, e.publicUuid);
    this.scoreDrafts.update((d) => ({ ...d, [key]: value }));
  }

  protected onScoreInput(s: GradeBookStudent, e: GradeBookEvaluation, ev: Event): void {
    const raw = String((ev.target as HTMLInputElement).value ?? '').trim();
    this.onScoreDraft(s, e, raw);
    if (!/^\d{2}$/.test(raw)) return;
    this.queueAdvance(s, e);
    (ev.target as HTMLInputElement).blur();
  }

  protected onScoreKeydown(ev: KeyboardEvent, s: GradeBookStudent, e: GradeBookEvaluation): void {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    this.queueAdvance(s, e);
    (ev.target as HTMLInputElement).blur();
  }

  /** Evita que la rueda del mouse cambie el valor del input type=number. */
  protected onScoreWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const el = ev.currentTarget as HTMLInputElement;
    const scroller = el.closest('.gradebook-scroll') as HTMLElement | null;
    if (scroller) {
      scroller.scrollTop += ev.deltaY;
      scroller.scrollLeft += ev.deltaX;
    }
  }

  protected setFillDirection(dir: 'right' | 'down'): void {
    this.fillDirection.set(dir);
  }

  protected fillDirectionLabel(): string {
    return this.fillDirection() === 'right'
      ? 'Avance al llenar: izquierda → derecha'
      : 'Avance al llenar: arriba → abajo';
  }

  private queueAdvance(s: GradeBookStudent, e: GradeBookEvaluation): void {
    const next = this.findNextEditableCell(s, e);
    this.pendingFocusKey = next ? cellKey(next.s.publicUuid, next.e.publicUuid) : null;
  }

  private editableColumns(): GradeBookEvaluation[] {
    const gb = this.gradebook();
    if (!gb) return [];
    if (gb.hasCategoryLayout) {
      return gb.categoryGroups.flatMap((g) => g.evaluations.filter((ev) => this.canInlineEdit(ev)));
    }
    return gb.kindGroups.flatMap((g) => g.evaluations.filter((ev) => this.canInlineEdit(ev)));
  }

  private findNextEditableCell(
    s: GradeBookStudent,
    e: GradeBookEvaluation,
  ): { s: GradeBookStudent; e: GradeBookEvaluation } | null {
    const gb = this.gradebook();
    if (!gb) return null;
    const students = gb.students;
    const cols = this.editableColumns();
    const ri = students.findIndex((x) => x.publicUuid === s.publicUuid);
    const ci = cols.findIndex((x) => x.publicUuid === e.publicUuid);
    if (ri < 0 || ci < 0 || cols.length === 0) return null;

    if (this.fillDirection() === 'right') {
      let nci = ci + 1;
      let nri = ri;
      if (nci >= cols.length) {
        nci = 0;
        nri += 1;
      }
      if (nri >= students.length) return null;
      return { s: students[nri], e: cols[nci] };
    }

    let nri = ri + 1;
    let nci = ci;
    if (nri >= students.length) {
      nri = 0;
      nci += 1;
    }
    if (nci >= cols.length) return null;
    return { s: students[nri], e: cols[nci] };
  }

  private focusPendingCell(): void {
    const key = this.pendingFocusKey;
    if (!key) return;
    const tryFocus = (attempt: number): void => {
      const el = document.querySelector(
        `input.score-input[data-cell-key="${key}"]`,
      ) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
        this.pendingFocusKey = null;
        return;
      }
      if (attempt < 3) {
        requestAnimationFrame(() => tryFocus(attempt + 1));
      }
    };
    requestAnimationFrame(() => tryFocus(0));
  }

  protected async onScoreBlur(s: GradeBookStudent, e: GradeBookEvaluation): Promise<void> {
    const key = cellKey(s.publicUuid, e.publicUuid);
    const draft = this.scoreDrafts()[key];
    if (draft === undefined) {
      this.focusPendingCell();
      return;
    }

    const trimmed = String(draft).trim();
    const current = this.cellScore(s, e);
    if (trimmed === '') {
      this.scoreDrafts.update((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      this.focusPendingCell();
      return;
    }

    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0 || num > 20) {
      this.saveError.set('La nota debe ser un número entre 0 y 20.');
      this.pendingFocusKey = null;
      return;
    }
    if (current !== null && Math.abs(current - num) < 0.001) {
      this.scoreDrafts.update((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      this.focusPendingCell();
      return;
    }

    this.store.setSavingCell(key);
    this.saveError.set(null);
    try {
      await firstValueFrom(
        this.gradeRecordsApi.upsertGrade(e.publicUuid, {
          studentPublicUuid: s.publicUuid,
          score: num,
        }),
      );
      this.scoreDrafts.update((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      });
      this.store.patchCellScore(s.publicUuid, e.publicUuid, num);
      if (this.currentAssignmentUuid) {
        await this.store.refreshQuiet(this.currentAssignmentUuid);
      }
    } catch (err) {
      this.saveError.set(this.toErrorMessage(err));
      this.pendingFocusKey = null;
    } finally {
      this.store.setSavingCell(null);
      this.focusPendingCell();
    }
  }

  protected cellTitle(s: GradeBookStudent, e: GradeBookEvaluation): string {
    const has = this.hasCell(s, e);
    const base = has ? `${s.fullName} · ${e.name}` : `${s.fullName} · ${e.name} (sin nota)`;
    return this.canInlineEdit(e) ? `${base} — editar` : base;
  }

  protected evaluationTitle(e: GradeBookEvaluation): string {
    return [
      e.name,
      this.statusLabel(e.status),
      EVALUATION_KIND_LABELS[e.kind],
      EVALUATION_SCALE_LABELS[e.scale],
      `peso ${e.weight}`,
      this.formatDate(e.scheduledDate),
    ].join(' · ');
  }

  protected enrollmentBadge(s: GradeBookStudent): string | null {
    if (s.enrollmentStatus === 'ACTIVE') return null;
    return ENROLLMENT_STATUS_LABELS[s.enrollmentStatus] ?? s.enrollmentStatus;
  }

  protected isInactiveEnrollment(s: GradeBookStudent): boolean {
    return s.enrollmentStatus === 'WITHDRAWN' || s.enrollmentStatus === 'TRANSFERRED';
  }

  protected formatDate(d: Date): string {
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
  }

  protected async onToggleWithdrawn(ev: Event): Promise<void> {
    if (!this.currentAssignmentUuid) return;
    const checked = (ev.target as HTMLInputElement).checked;
    await this.store.setIncludeWithdrawn(checked, this.currentAssignmentUuid);
  }

  protected async onToggleTransferred(ev: Event): Promise<void> {
    if (!this.currentAssignmentUuid) return;
    const checked = (ev.target as HTMLInputElement).checked;
    await this.store.setIncludeTransferred(checked, this.currentAssignmentUuid);
  }

  protected goBack(): void {
    this.goToEvaluations();
  }

  protected goToEvaluation(publicUuid: string): void {
    void this.router.navigate([ROUTES.EVALUATIONS.grades(publicUuid)]);
  }

  protected goToEvaluations(): void {
    if (!this.currentAssignmentUuid) return;
    void this.router.navigate([ROUTES.EVALUATIONS.byAssignment(this.currentAssignmentUuid)]);
  }

  protected async reload(): Promise<void> {
    if (!this.currentAssignmentUuid) return;
    await this.store.load(this.currentAssignmentUuid);
  }

  protected async exportExcel(): Promise<void> {
    if (!this.currentAssignmentUuid) return;
    await this.store.exportXlsx(this.currentAssignmentUuid);
  }

  protected async exportPdf(): Promise<void> {
    if (!this.currentAssignmentUuid) return;
    await this.store.exportPdf(this.currentAssignmentUuid);
  }

  protected toggleExpand(studentUuid: string): void {
    const set = new Set(this.expanded());
    if (set.has(studentUuid)) set.delete(studentUuid);
    else set.add(studentUuid);
    this.expanded.set(set);
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

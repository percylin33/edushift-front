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
import { EvaluationFormModalComponent } from '@features/evaluations/components';
import {
  EVALUATION_KIND_LABELS,
  EVALUATION_SCALE_LABELS,
  EVALUATION_STATUS_LABELS,
  EvaluationKind,
  EvaluationScale,
  EvaluationStatus,
} from '@features/evaluations/models';
import { GradeRecordsApiService } from '@features/grade-records/services';
import { CompetencyResultsModalComponent } from '../../components/competency-results-modal.component';
import {
  ALLOWED_LITERALS_BY_SCALE,
  areGradesEditable,
} from '@features/grade-records/models';
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
    EvaluationFormModalComponent,
    IconComponent,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
    CompetencyResultsModalComponent,
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
          class="btn btn-primary btn-sm"
          [disabled]="loading()"
          (click)="openCreateForm()"
          title="Nueva columna"
        >
          <app-icon name="plus" [size]="16" />
          <span>Nueva columna</span>
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
          class="btn btn-outline btn-sm"
          [disabled]="loading() || !gradebook()?.evaluations?.length || !gradebook()?.students?.length"
          (click)="competencyResultsOpen.set(true)"
          title="Registrar niveles, criterios y evidencias por competencia"
        >
          <app-icon name="target" [size]="16" />
          <span>Evidencias</span>
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
        <section class="acta-header mb-3 flex flex-col gap-2 rounded-lg border border-[rgb(var(--color-border-subtle,241_245_249)/1)] bg-[var(--gb-subtle)] px-4 py-2.5" aria-label="Datos del registro">
          <div class="acta-context flex flex-wrap items-center gap-x-2 gap-y-[0.35rem] text-[0.8125rem] font-semibold text-[color:var(--gb-text)]">
            <span class="acta-context-item">
              <span class="acta-context-label text-[0.65rem] uppercase tracking-[0.04em] text-[color:var(--gb-hint)]">Salón</span>
              {{ salonLabel() }}
            </span>
            <span class="acta-sep font-normal text-[color:rgb(var(--color-content-muted,156_163_175))]" aria-hidden="true">·</span>
            <span class="acta-context-item">
              <span class="acta-context-label text-[0.65rem] uppercase tracking-[0.04em] text-[color:var(--gb-hint)]">Curso</span>
              {{ gb.courseName }}
            </span>
            <span class="acta-sep font-normal text-[color:rgb(var(--color-content-muted,156_163_175))]" aria-hidden="true">·</span>
            <span class="acta-context-item">
              <span class="acta-context-label text-[0.65rem] uppercase tracking-[0.04em] text-[color:var(--gb-hint)]">Periodo</span>
              {{ periodLabel() }}
            </span>
            <span class="acta-sep font-normal text-[color:rgb(var(--color-content-muted,156_163_175))]" aria-hidden="true">·</span>
            <span class="acta-context-item">
              <span class="acta-context-label text-[0.65rem] uppercase tracking-[0.04em] text-[color:var(--gb-hint)]">Profesor</span>
              {{ gb.teacherFullName || '—' }}
            </span>
            @if (gb.templateName) {
              <span class="acta-template-badge ml-1 max-w-56 overflow-hidden text-ellipsis whitespace-nowrap rounded-full border border-[var(--gb-border)] bg-[var(--gb-muted)] px-2 py-0.5 text-[0.6875rem] font-medium text-[color:rgb(var(--color-content-muted,75_85_99))]" [title]="gb.templateName">{{
                gb.templateName
              }}</span>
            }
          </div>
          <div class="acta-toolbar flex flex-wrap items-center gap-x-4 gap-y-3 text-[color:var(--gb-hint)]">
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
            @if (hasEditableLiterals()) {
              <div
                class="fill-dir-toggle"
                role="group"
                aria-label="Modo de ingreso de literales"
                title="Lista (desplegable) o Teclado (escribir AD, A, B, C)"
              >
                <button
                  type="button"
                  class="fill-dir-option literal-mode-option"
                  [class.fill-dir-active]="literalEntryMode() === 'select'"
                  (click)="setLiteralEntryMode('select')"
                >
                  Lista
                </button>
                <button
                  type="button"
                  class="fill-dir-option literal-mode-option"
                  [class.fill-dir-active]="literalEntryMode() === 'input'"
                  (click)="setLiteralEntryMode('input')"
                >
                  Teclado
                </button>
              </div>
            }
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
            <span class="acta-stat rounded border border-[var(--gb-border)] bg-[var(--gb-muted)] px-[0.4rem] py-0.5 text-xs tabular-nums text-[color:var(--gb-text)]">{{ gb.students.length }} est.</span>
            <span class="acta-stat rounded border border-[var(--gb-border)] bg-[var(--gb-muted)] px-[0.4rem] py-0.5 text-xs tabular-nums text-[color:var(--gb-text)]">{{ gb.evaluations.length }} reg.</span>
            <span
              class="acta-stat rounded border border-[var(--gb-border)] bg-[var(--gb-muted)] px-[0.4rem] py-0.5 text-xs tabular-nums text-[color:var(--gb-text)]"
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
            title="Sin columnas"
            description="Agrega la primera columna para empezar a llenar el registro."
          >
            <button type="button" class="btn btn-primary btn-sm" (click)="openCreateForm()">
              <app-icon name="plus" [size]="16" />
              <span>Nueva columna</span>
            </button>
          </app-empty-state>
        } @else {
          @if (hasEmptyCategories()) {
            <div class="empty-cats-hint mb-3">
              <app-icon name="info" [size]="14" />
              <p>
                Hay categorías sin columnas.
                <button type="button" class="link-btn" (click)="openCreateForm()">
                  Nueva columna
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
                          [attr.title]="
                            doesNotContribute(group)
                              ? 'No cuenta en el promedio del curso'
                              : null
                          "
                        >
                          {{ group.label }}
                          @if (doesNotContribute(group)) {
                            <span class="no-aporta-badge">no aporta</span>
                          }
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
                            @if (canAddColumn(group)) {
                              <button
                                type="button"
                                class="eval-header empty-cat-cta"
                                (click)="openCreateForm(group.category?.publicUuid ?? null)"
                                title="Agregar una columna en esta categoría"
                              >
                                <app-icon name="plus" [size]="12" />
                              </button>
                            } @else {
                              <span
                                class="inline-flex text-content-muted"
                                title="Esta categoría la completa el colegio."
                              >
                                <app-icon name="lock" [size]="12" />
                              </span>
                            }
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
                        @if (s.literalAverage) {
                          <span class="avg-value" [ngClass]="literalTone(s.literalAverage)">
                            {{ s.literalAverage }}
                          </span>
                        } @else if (s.weightedAverage !== null) {
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
                                } @else if (canEditLiteral(e)) {
                                  @if (literalEntryMode() === 'select') {
                                    <select
                                      class="select score-input"
                                      [attr.data-cell-key]="cellKeyOf(s, e)"
                                      [disabled]="savingCell() === cellKeyOf(s, e)"
                                      [ngModel]="cellLiteral(s, e) ?? ''"
                                      (ngModelChange)="onLiteralChange(s, e, $event)"
                                      (click)="$event.stopPropagation()"
                                    >
                                      <option value="">—</option>
                                      <option value="AD">AD</option>
                                      <option value="A">A</option>
                                      <option value="B">B</option>
                                      <option value="C">C</option>
                                    </select>
                                  } @else {
                                    <input
                                      type="text"
                                      class="score-input"
                                      maxlength="2"
                                      autocomplete="off"
                                      spellcheck="false"
                                      aria-label="Literal AD, A, B o C"
                                      [attr.data-cell-key]="cellKeyOf(s, e)"
                                      [disabled]="savingCell() === cellKeyOf(s, e)"
                                      [ngModel]="literalInputValue(s, e)"
                                      (ngModelChange)="onLiteralDraft(s, e, $event)"
                                      (blur)="onLiteralBlur(s, e)"
                                      (keydown)="onLiteralKeydown($event, s, e)"
                                      (click)="$event.stopPropagation()"
                                    />
                                  }
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
                                @if (categoryLiteral(s, group.category.publicUuid); as letter) {
                                  <span [ngClass]="literalTone(letter)">{{ letter }}</span>
                                } @else {
                                  @if (categoryAvg(s, group.category.publicUuid); as avg) {
                                    {{ avg | number: '1.0-2' }}
                                  } @else {
                                    <span class="text-content-muted">—</span>
                                  }
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
                              } @else if (canEditLiteral(e)) {
                                @if (literalEntryMode() === 'select') {
                                  <select
                                    class="select score-input"
                                    [attr.data-cell-key]="cellKeyOf(s, e)"
                                    [disabled]="savingCell() === cellKeyOf(s, e)"
                                    [ngModel]="cellLiteral(s, e) ?? ''"
                                    (ngModelChange)="onLiteralChange(s, e, $event)"
                                    (click)="$event.stopPropagation()"
                                  >
                                    <option value="">—</option>
                                    <option value="AD">AD</option>
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                  </select>
                                } @else {
                                  <input
                                    type="text"
                                    class="score-input"
                                    maxlength="2"
                                    autocomplete="off"
                                    spellcheck="false"
                                    aria-label="Literal AD, A, B o C"
                                    [attr.data-cell-key]="cellKeyOf(s, e)"
                                    [disabled]="savingCell() === cellKeyOf(s, e)"
                                    [ngModel]="literalInputValue(s, e)"
                                    (ngModelChange)="onLiteralDraft(s, e, $event)"
                                    (blur)="onLiteralBlur(s, e)"
                                    (click)="$event.stopPropagation()"
                                  />
                                }
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
                      @if (s.literalAverage) {
                        <strong [ngClass]="literalTone(s.literalAverage)">{{ s.literalAverage }}</strong>
                      } @else if (s.weightedAverage !== null) {
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
                            [attr.title]="
                              doesNotContribute(group)
                                ? 'No cuenta en el promedio del curso'
                                : null
                            "
                          >
                            {{ group.label }}
                            @if (doesNotContribute(group)) {
                              <span class="no-aporta-badge">no aporta</span>
                            }
                          </p>
                          @if (group.evaluations.length === 0 && canAddColumn(group)) {
                            <button
                              type="button"
                              class="btn btn-ghost btn-sm w-full justify-start text-content-muted"
                              (click)="openCreateForm(group.category?.publicUuid ?? null)"
                            >
                              <app-icon name="plus" [size]="14" />
                              Sin columnas · Añadir columna
                            </button>
                          } @else if (group.evaluations.length === 0) {
                            <p class="px-3 py-2 text-xs text-content-muted">
                              Esta categoría la completa el colegio.
                            </p>
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
                                  } @else if (canEditLiteral(e)) {
                                    @if (literalEntryMode() === 'select') {
                                      <select
                                        class="select score-input score-input-mobile"
                                        [disabled]="savingCell() === cellKeyOf(s, e)"
                                        [ngModel]="cellLiteral(s, e) ?? ''"
                                        (ngModelChange)="onLiteralChange(s, e, $event)"
                                      >
                                        <option value="">—</option>
                                        <option value="AD">AD</option>
                                        <option value="A">A</option>
                                        <option value="B">B</option>
                                        <option value="C">C</option>
                                      </select>
                                    } @else {
                                      <input
                                        type="text"
                                        class="score-input score-input-mobile"
                                        maxlength="2"
                                        autocomplete="off"
                                        spellcheck="false"
                                        aria-label="Literal AD, A, B o C"
                                        [disabled]="savingCell() === cellKeyOf(s, e)"
                                        [ngModel]="literalInputValue(s, e)"
                                        (ngModelChange)="onLiteralDraft(s, e, $event)"
                                        (blur)="onLiteralBlur(s, e)"
                                        (keydown)="onLiteralKeydown($event, s, e)"
                                      />
                                    }
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
                                } @else if (canEditLiteral(e)) {
                                  @if (literalEntryMode() === 'select') {
                                    <select
                                      class="select score-input score-input-mobile"
                                      [disabled]="savingCell() === cellKeyOf(s, e)"
                                      [ngModel]="cellLiteral(s, e) ?? ''"
                                      (ngModelChange)="onLiteralChange(s, e, $event)"
                                    >
                                      <option value="">—</option>
                                      <option value="AD">AD</option>
                                      <option value="A">A</option>
                                      <option value="B">B</option>
                                      <option value="C">C</option>
                                    </select>
                                  } @else {
                                    <input
                                      type="text"
                                      class="score-input score-input-mobile"
                                      maxlength="2"
                                      autocomplete="off"
                                      spellcheck="false"
                                      aria-label="Literal AD, A, B o C"
                                      [disabled]="savingCell() === cellKeyOf(s, e)"
                                      [ngModel]="literalInputValue(s, e)"
                                      (ngModelChange)="onLiteralDraft(s, e, $event)"
                                      (blur)="onLiteralBlur(s, e)"
                                    />
                                  }
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

    @if (showCreateForm()) {
      <app-evaluation-form-modal
        [assignmentUuid]="currentAssignmentUuid"
        [categories]="formCategories()"
        [initialCategoryPublicUuid]="createCategoryId()"
        [asColumn]="true"
        [sheetScale]="gradebook()?.gradingScale ?? null"
        (closed)="closeCreateForm()"
        (saved)="onRegisterCreated()"
      />
    }
    @if (competencyResultsOpen() && gradebook(); as gb) {
      <app-competency-results-modal
        [courseUuid]="gb.coursePublicUuid"
        [students]="gb.students"
        [evaluations]="gb.evaluations"
        (closed)="competencyResultsOpen.set(false)"
      />
    }
  `,
  styles: [
    `
      :host {
        display: block;
        --gb-band-text: inherit;
        --gb-slate: rgba(241, 245, 249, 0.85);
        --gb-exam: rgba(254, 243, 199, 0.55);
        --gb-quiz: rgba(219, 234, 254, 0.55);
        --gb-task: rgba(220, 252, 231, 0.45);
        --gb-rubric: rgba(237, 233, 254, 0.5);
        --gb-competency: rgba(255, 237, 213, 0.5);
        --gb-muted: rgb(var(--color-surface-muted, 241 245 249) / 1);
        --gb-text: rgb(var(--color-content, 15 23 42));
        --gb-border: rgb(var(--color-border, 226 232 240) / 1);
        --gb-hint: rgb(var(--color-content-muted, 107 114 128));
        --gb-subtle: rgb(var(--color-surface-subtle, 248 250 252) / 1);
      }
      :host-context(.dark) {
        --gb-band-text: rgb(var(--color-content, 241 245 249));
        --gb-slate: rgba(51, 65, 85, 0.78);
        --gb-exam: rgba(146, 64, 14, 0.38);
        --gb-quiz: rgba(30, 64, 175, 0.36);
        --gb-task: rgba(20, 83, 45, 0.4);
        --gb-rubric: rgba(91, 33, 182, 0.34);
        --gb-competency: rgba(154, 52, 18, 0.36);
      }


      /* ---- Acta chrome ---- */







      .acta-stat-ok {
        background: rgba(34, 197, 94, 0.1);
        border-color: transparent;
        color: var(--color-success-700, #15803d);
      }
      .acta-stat-warn {
        background: rgba(251, 191, 36, 0.12);
        border-color: transparent;
        color: #b45309;
      }
      :host-context(.dark) .acta-stat-ok {
        color: rgb(var(--color-success, 34 197 94));
      }
      :host-context(.dark) .acta-stat-warn {
        color: rgb(var(--color-warning, 251 191 36));
      }

      .empty-cats-hint {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
        font-size: 0.8125rem;
        color: rgb(var(--color-content-muted, 75 85 99));
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
        color: rgb(var(--color-primary-600, 37 99 235));
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
        border-bottom: 1px solid rgb(var(--color-border-subtle, 241 245 249) / 1);
        border-right: 1px solid rgb(var(--color-border-subtle, 241 245 249) / 1);
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
        background-color: var(--gb-subtle) !important;
      }
      .avg-col {
        left: 220px;
        min-width: 72px;
        max-width: 72px;
        text-align: center;
        background-color: var(--gb-muted) !important;
        z-index: 29;
        box-shadow: 6px 0 10px -4px rgba(0, 0, 0, 0.18);
      }
      thead .avg-col {
        z-index: 39;
        background-color: var(--gb-muted) !important;
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
        color: var(--gb-hint);
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
        background-color: var(--gb-subtle);
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
        color: rgb(var(--color-primary-600, 37 99 235));
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
        color: var(--gb-hint);
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
        border: 1px solid var(--gb-border);
        border-radius: 0.3rem;
        padding: 0.2rem 0.15rem;
        background: rgb(var(--color-surface-raised, 255 255 255) / 1);
        color: var(--gb-text);
        caret-color: var(--gb-text);
        -moz-appearance: textfield;
        appearance: textfield;
      }
      .score-input::-webkit-outer-spin-button,
      .score-input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      .score-input:focus {
        outline: 2px solid rgb(var(--color-primary-400, 96 165 250));
        outline-offset: 1px;
      }
      .score-input:disabled {
        opacity: 1;
        color: rgb(var(--color-content-muted, 100 116 139));
        background: var(--gb-muted);
        cursor: not-allowed;
      }
      .score-input-mobile {
        max-width: 5rem;
      }
      .fill-dir-toggle {
        display: inline-flex;
        align-items: stretch;
        border: 1px solid var(--gb-border);
        border-radius: 0.375rem;
        background: rgb(var(--color-surface-raised, 255 255 255) / 1);
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
        color: rgb(var(--color-content-muted, 71 85 105));
        cursor: pointer;
        transition:
          background 0.12s ease,
          color 0.12s ease;
      }
      .fill-dir-option + .fill-dir-option {
        border-left: 1px solid var(--gb-border);
      }
      .fill-dir-option:hover:not(.fill-dir-active) {
        background: var(--gb-muted);
        color: var(--gb-text);
      }
      .fill-dir-option.fill-dir-active {
        background: var(--gb-muted);
        color: var(--gb-text);
        box-shadow: inset 0 -2px 0 rgb(var(--color-primary-600, 37 99 235));
      }
      :host-context(.dark) .fill-dir-option.fill-dir-active {
        background: #334155;
        color: #f8fafc;
        box-shadow: inset 0 -2px 0 #22d3ee;
      }
      .fill-dir-option:disabled {
        color: rgb(var(--color-content-muted, 100 116 139));
        background: var(--gb-muted);
        cursor: not-allowed;
      }
      .fill-dir-option:focus-visible {
        outline: 2px solid rgb(var(--color-primary-400, 96 165 250));
        outline-offset: -1px;
        z-index: 1;
      }
      .literal-mode-option {
        width: auto;
        min-width: 3.25rem;
        padding: 0 0.45rem;
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .no-aporta-badge {
        display: inline-block;
        margin-left: 0.35rem;
        font-size: 0.625rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: lowercase;
        color: var(--gb-hint);
        opacity: 0.9;
        white-space: nowrap;
      }
      .kind-band-exam, .cat-band-amber {
        background: var(--gb-exam) !important;
        color: var(--gb-band-text);
      }
      .kind-band-quiz, .cat-band-blue {
        background: var(--gb-quiz) !important;
        color: var(--gb-band-text);
      }
      .kind-band-task, .cat-band-green {
        background: var(--gb-task) !important;
        color: var(--gb-band-text);
      }
      .kind-band-rubric, .cat-band-violet {
        background: var(--gb-rubric) !important;
        color: var(--gb-band-text);
      }
      .kind-band-competency {
        background: var(--gb-competency) !important;
        color: var(--gb-band-text);
      }









      .cat-band-slate {
        background: var(--gb-slate) !important;
        color: var(--gb-band-text);
      }

      /* Sticky student/avg must stay opaque even under category bands */
      .gradebook-table
        :is(.student-col, .avg-col):is(
          .cat-band-amber,
          .cat-band-green,
          .cat-band-blue,
          .cat-band-slate,
          .cat-band-violet
        ) {
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
        background: var(--gb-subtle);
        color: var(--gb-text);
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
  protected readonly competencyResultsOpen = signal(false);
  protected readonly saveError = signal<string | null>(null);
  private readonly scoreDrafts = signal<Record<string, string>>({});
  private readonly literalDrafts = signal<Record<string, string>>({});
  /** Celdas con upsert literal en vuelo (evita 409 por doble POST). */
  private readonly literalSavingKeys = new Set<string>();
  /** Dirección de avance al llenar notas: horizontal (→) o vertical (↓). */
  protected readonly fillDirection = signal<'right' | 'down'>('right');
  /** Lista (select) o Teclado (input) para literales CNEB. */
  protected readonly literalEntryMode = signal<'select' | 'input'>(
    GradeBookPageComponent.readLiteralEntryMode(),
  );
  /** Celda a enfocar tras guardar (avance automático). */
  private pendingFocusKey: string | null = null;

  private static readonly LITERAL_ENTRY_MODE_KEY = 'edushift.gradebook.literalEntryMode';
  private static readonly CNEB_LITERALS = ALLOWED_LITERALS_BY_SCALE[EvaluationScale.LITERAL_CNEB];

  private static readLiteralEntryMode(): 'select' | 'input' {
    try {
      const stored = localStorage.getItem(GradeBookPageComponent.LITERAL_ENTRY_MODE_KEY);
      return stored === 'input' ? 'input' : 'select';
    } catch {
      return 'select';
    }
  }

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
  protected currentAssignmentUuid: string | null = null;
  protected readonly showCreateForm = signal(false);
  protected readonly createCategoryId = signal<string | null>(null);
  protected readonly formCategories = computed(() =>
    (this.gradebook()?.categories ?? [])
      .filter((category) => category.allowsTeacherColumns)
      .map((category) => ({
        publicUuid: category.publicUuid,
        name: category.name,
        allowsTeacherColumns: category.allowsTeacherColumns,
      })),
  );

  protected readonly hasEditableLiterals = computed(() => {
    const gb = this.gradebook();
    if (!gb) return false;
    return gb.evaluations.some((e) => this.canEditLiteral(e));
  });

  protected canAddColumn(group: GradeBookCategoryGroup): boolean {
    return group.category?.allowsTeacherColumns !== false;
  }

  protected doesNotContribute(group: GradeBookCategoryGroup): boolean {
    return !!group.category && !group.category.contributesToAverage;
  }

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

  protected canEditLiteral(e: GradeBookEvaluation): boolean {
    return e.scale === EvaluationScale.LITERAL_CNEB && areGradesEditable(e.status);
  }

  protected literalTone(letter: string): string {
    if (letter === 'AD' || letter === 'A') return 'text-success-700';
    if (letter === 'C') return 'text-danger-700';
    return '';
  }

  protected categoryLiteral(s: GradeBookStudent, categoryUuid: string): string | null {
    return s.categoryLiteralAverages.get(categoryUuid) ?? null;
  }

  protected async onLiteralChange(
    s: GradeBookStudent,
    e: GradeBookEvaluation,
    value: string,
  ): Promise<void> {
    const next = value.trim().toUpperCase();
    const current = this.cellLiteral(s, e) ?? '';
    if (next === current || next === '') return;
    if (!GradeBookPageComponent.CNEB_LITERALS.includes(next)) return;
    const key = cellKey(s.publicUuid, e.publicUuid);
    if (this.literalSavingKeys.has(key)) return;
    this.literalSavingKeys.add(key);
    this.store.setSavingCell(key);
    this.saveError.set(null);
    this.queueAdvance(s, e);
    try {
      await firstValueFrom(
        this.gradeRecordsApi.upsertGrade(e.publicUuid, {
          studentPublicUuid: s.publicUuid,
          literal: next,
        }),
      );
      this.store.patchCellLiteral(s.publicUuid, e.publicUuid, next);
      this.literalDrafts.update((d) => {
        const copy = { ...d };
        delete copy[key];
        return copy;
      });
      if (this.currentAssignmentUuid) {
        await this.store.refreshQuiet(this.currentAssignmentUuid);
      }
    } catch (err) {
      this.saveError.set(this.toErrorMessage(err));
      this.pendingFocusKey = null;
    } finally {
      this.literalSavingKeys.delete(key);
      this.store.setSavingCell(null);
      this.focusPendingCell();
    }
  }

  protected literalInputValue(s: GradeBookStudent, e: GradeBookEvaluation): string {
    const key = cellKey(s.publicUuid, e.publicUuid);
    const draft = this.literalDrafts()[key];
    if (draft !== undefined) return draft;
    return this.cellLiteral(s, e) ?? '';
  }

  protected onLiteralDraft(s: GradeBookStudent, e: GradeBookEvaluation, value: string): void {
    const key = cellKey(s.publicUuid, e.publicUuid);
    const normalized = this.normalizeLiteralDraft(value);
    this.literalDrafts.update((d) => ({ ...d, [key]: normalized }));
    if (normalized && GradeBookPageComponent.CNEB_LITERALS.includes(normalized)) {
      this.queueAdvance(s, e);
    }
  }

  protected onLiteralKeydown(ev: KeyboardEvent, s: GradeBookStudent, e: GradeBookEvaluation): void {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    this.queueAdvance(s, e);
    (ev.target as HTMLInputElement).blur();
  }

  protected onLiteralBlur(s: GradeBookStudent, e: GradeBookEvaluation): void {
    const key = cellKey(s.publicUuid, e.publicUuid);
    const draft = this.literalDrafts()[key];
    const current = this.cellLiteral(s, e) ?? '';
    if (draft === undefined) {
      this.focusPendingCell();
      return;
    }
    if (draft === '') {
      this.literalDrafts.update((d) => {
        const copy = { ...d };
        delete copy[key];
        return copy;
      });
      this.focusPendingCell();
      return;
    }
    if (GradeBookPageComponent.CNEB_LITERALS.includes(draft)) {
      void this.onLiteralChange(s, e, draft);
      return;
    }
    this.literalDrafts.update((d) => ({ ...d, [key]: current }));
  }

  /** Filtra a prefijos válidos de AD/A/B/C en mayúsculas. */
  private normalizeLiteralDraft(raw: string): string {
    const up = raw.toUpperCase().replace(/[^A-D]/g, '');
    if (up === '' || up === 'A' || up === 'AD' || up === 'B' || up === 'C') return up;
    if (up.startsWith('AD')) return 'AD';
    if (up.startsWith('A')) return 'A';
    if (up.startsWith('B')) return 'B';
    if (up.startsWith('C')) return 'C';
    return '';
  }

  protected setLiteralEntryMode(mode: 'select' | 'input'): void {
    this.literalEntryMode.set(mode);
    this.literalDrafts.set({});
    try {
      localStorage.setItem(GradeBookPageComponent.LITERAL_ENTRY_MODE_KEY, mode);
    } catch {
      /* ignore quota / private mode */
    }
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
    const isEditable = (ev: GradeBookEvaluation): boolean =>
      this.canInlineEdit(ev) || this.canEditLiteral(ev);
    if (gb.hasCategoryLayout) {
      return gb.categoryGroups.flatMap((g) => g.evaluations.filter(isEditable));
    }
    return gb.kindGroups.flatMap((g) => g.evaluations.filter(isEditable));
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

  protected openCreateForm(categoryPublicUuid: string | null = null): void {
    if (!this.currentAssignmentUuid) return;
    this.createCategoryId.set(categoryPublicUuid);
    this.showCreateForm.set(true);
  }

  protected closeCreateForm(): void {
    this.showCreateForm.set(false);
    this.createCategoryId.set(null);
  }

  protected async onRegisterCreated(): Promise<void> {
    this.closeCreateForm();
    if (!this.currentAssignmentUuid) return;
    await this.store.refreshQuiet(this.currentAssignmentUuid);
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

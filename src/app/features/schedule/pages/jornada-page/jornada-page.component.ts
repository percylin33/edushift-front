import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
  ConfirmDialogService,
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import {
  AcademicLevel,
  AcademicYearRow,
  AcademicYearStatus,
  DAY_BLOCK_TYPE_LABELS,
  DAYS_OF_WEEK,
  DayBlockType,
  DayTemplate,
  RecessPolicy,
  ScheduleSourceDocument,
  ScheduleWarningItem,
  SectionRow,
  formatDayTemplateShift,
  formatScheduleParseStatus,
  formatScheduleWarning,
  formatScheduleWarningSeverity,
  formatTime,
} from '@features/academic/models';
import { DayPlanTimelineComponent } from '../../components/day-plan-timeline/day-plan-timeline.component';
import { ScheduleApiService } from '../../services/schedule-api.service';
import {
  DayPlanHardInterval,
  DayPlanPreviewItem,
  MAX_DAY_PLAN_RECESSES,
  addMinutesToTime,
  computeDayPlanPreview,
  computeSmartDayPlanLayout,
  defaultsForLevel,
  inferBreakDurationMinutes,
  recessLabelForIndex,
} from '../../utils/day-plan.util';

const SPECIAL_BLOCK_TYPES = new Set<DayBlockType>(['ASSEMBLY', 'GUIDANCE', 'SPECIALIST_RESERVED']);

const ACTIVITY_TYPES: DayBlockType[] = ['ASSEMBLY', 'GUIDANCE', 'SPECIALIST_RESERVED'];

interface DayPlanRecessDraft {
  startTime: string;
  endTime: string;
  minutes: number;
}

interface DayPlanDraft {
  dayStart: string;
  dayEnd: string;
  periodMinutes: number;
  recesses: DayPlanRecessDraft[];
  lunch: { enabled: boolean; startTime: string; endTime: string; minutes: number };
  activities: {
    blockType: Extract<DayBlockType, 'ASSEMBLY' | 'GUIDANCE' | 'SPECIALIST_RESERVED'>;
    label: string;
    dayOfWeek: number | null;
    startTime: string;
    endTime: string;
  }[];
}

/**
 * Admin page: define school day structure (recess, lunch, periods) per level.
 */
@Component({
  selector: 'app-jornada-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    EmptyStateComponent,
    SpinnerComponent,
    DayPlanTimelineComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Horarios"
        title="Jornada y recreos"
        subtitle="Define cómo se organiza un día escolar: horarios, recreos y periodos de clase."
      >
        <a [routerLink]="ROUTES.SCHEDULE.WORKLOAD" class="btn btn-outline btn-sm">
          <app-icon name="users" [size]="14" />
          <span>Carga docente</span>
        </a>
        <a [routerLink]="ROUTES.SCHEDULE.ROOT" class="btn btn-ghost btn-sm">
          <span>Volver</span>
        </a>
      </app-page-header>

      @if (bootLoading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando…" />
        </div>
      } @else {
        <section class="card mb-6" aria-labelledby="jornada-settings">
          <header class="card-header">
            <h2 id="jornada-settings" class="card-title text-base">Configuración del año</h2>
          </header>
          <div class="card-body grid gap-4 sm:grid-cols-12">
            <div class="sm:col-span-6">
              <label class="label" for="jornada-year">Año académico</label>
              <select
                id="jornada-year"
                class="select"
                [ngModel]="selectedYearUuid()"
                (ngModelChange)="onYearChange($event)"
              >
                <option value="">Seleccionar año…</option>
                @for (y of years(); track y.publicUuid) {
                  <option [value]="y.publicUuid">{{ y.name }}</option>
                }
              </select>
            </div>
            <div class="sm:col-span-6">
              <label class="label" for="jornada-policy">Preferencia de recreos</label>
              <select
                id="jornada-policy"
                class="select"
                [ngModel]="recessPolicy()"
                (ngModelChange)="onPolicyChange($event)"
                [disabled]="savingSettings()"
              >
                @for (opt of policyOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
              <p class="mt-1 text-xs text-content-muted">
                Esta preferencia se guarda para todo el colegio. Ajusta las horas de recreo dentro
                de cada jornada.
              </p>
            </div>
          </div>
          @if (settingsMessage()) {
            <p class="px-5 pb-4 text-xs text-content-muted">{{ settingsMessage() }}</p>
          }
        </section>

        @if (pageError()) {
          <div role="alert" class="card mb-6 border-l-4 border-l-danger bg-danger/5">
            <div class="card-body text-sm text-danger">{{ pageError() }}</div>
          </div>
        }

        <section class="mb-8" aria-labelledby="jornada-templates">
          <header class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="jornada-templates" class="text-lg font-semibold text-content">
                Jornadas del año
              </h2>
              <p class="text-sm text-content-muted">
                Revisa qué niveles tienen jornada y ajusta cada día escolar.
              </p>
            </div>
            @if (templates().length > 0) {
              <div class="flex flex-wrap gap-2">
                @if (years().length > 1) {
                  <button
                    type="button"
                    class="btn btn-outline btn-sm"
                    [disabled]="!selectedYearUuid() || cloning() || hasAnyUnsavedPlans()"
                    (click)="showCloneForm.set(!showCloneForm())"
                  >
                    Copiar otro año
                  </button>
                }
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  [disabled]="!selectedYearUuid()"
                  (click)="showCreateTemplate.set(!showCreateTemplate())"
                >
                  <app-icon name="plus" [size]="14" /> Nueva jornada
                </button>
              </div>
            }
          </header>

          @if (showCloneForm()) {
            <div class="card mb-4">
              <div class="card-body flex flex-col gap-3 sm:flex-row sm:items-end">
                <label class="field flex-1">
                  <span class="label">Copiar jornadas desde</span>
                  <select class="select" [(ngModel)]="cloneSourceYearUuid">
                    <option value="">Seleccionar año anterior…</option>
                    @for (year of years(); track year.publicUuid) {
                      @if (year.publicUuid !== selectedYearUuid()) {
                        <option [value]="year.publicUuid">{{ year.name }}</option>
                      }
                    }
                  </select>
                </label>
                <button
                  type="button"
                  class="btn btn-primary"
                  [disabled]="!cloneSourceYearUuid || cloning() || hasAnyUnsavedPlans()"
                  (click)="cloneSchedule()"
                >
                  @if (cloning()) {
                    <app-spinner [size]="14" />
                  }
                  Copiar jornadas
                </button>
              </div>
              @if (hasAnyUnsavedPlans()) {
                <p class="px-5 pb-4 text-xs text-amber-700">
                  Guarda o descarta los cambios pendientes antes de copiar otro año.
                </p>
              }
            </div>
          }

          @if (showCreateTemplate()) {
            <div class="card mb-4">
              <div class="card-body grid gap-3 sm:grid-cols-12">
                <div class="sm:col-span-3">
                  <label class="label" for="tpl-level">Nivel</label>
                  <select
                    id="tpl-level"
                    class="select"
                    [ngModel]="newTemplate.levelUuid"
                    (ngModelChange)="newTemplate.levelUuid = $event; newTemplate.gradeUuid = ''"
                  >
                    <option value="">Seleccionar…</option>
                    @for (lv of levels(); track lv.publicUuid) {
                      <option [value]="lv.publicUuid">{{ lv.code }} — {{ lv.name }}</option>
                    }
                  </select>
                </div>
                <div class="sm:col-span-3">
                  <label class="label" for="tpl-grade">Aplicar a</label>
                  <select id="tpl-grade" class="select" [(ngModel)]="newTemplate.gradeUuid">
                    <option value="">Todo el nivel</option>
                    @for (grade of selectedLevelGrades(); track grade.publicUuid) {
                      <option [value]="grade.publicUuid">{{ grade.name }}</option>
                    }
                  </select>
                </div>
                <div class="sm:col-span-4">
                  <label class="label" for="tpl-name">Nombre</label>
                  <input
                    id="tpl-name"
                    class="input"
                    [(ngModel)]="newTemplate.name"
                    placeholder="Ej. Jornada de Primaria"
                  />
                </div>
                <div class="flex items-end sm:col-span-2">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="
                      creatingTemplate() ||
                      !newTemplate.levelUuid ||
                      !newTemplate.name.trim() ||
                      templateScopeTaken()
                    "
                    (click)="createTemplate()"
                  >
                    Crear jornada
                  </button>
                </div>
                @if (templateScopeTaken()) {
                  <p class="text-xs text-amber-700 sm:col-span-12">
                    Ya existe una jornada para ese alcance. Elige un grado para crear una excepción.
                  </p>
                }
              </div>
            </div>
          }

          @if (templatesLoading()) {
            <div class="flex justify-center py-10">
              <app-spinner [size]="20" label="Cargando plantillas…" />
            </div>
          } @else if (!selectedYearUuid()) {
            <app-empty-state
              icon="calendar"
              title="Seleccioná un año"
              description="Elegí el año académico para ver o editar las jornadas."
            />
          } @else if (templates().length === 0) {
            <div class="card">
              <div class="card-body space-y-4">
                <app-empty-state
                  icon="calendar"
                  title="Aún no hay jornadas para este año"
                  description="Empieza con horarios sugeridos, copia la estructura de otro año o crea una jornada con una base sugerida."
                />
                <div class="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="seeding()"
                    (click)="seedDefaults()"
                  >
                    Usar jornadas sugeridas
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline"
                    [disabled]="years().length <= 1 || cloning() || hasAnyUnsavedPlans()"
                    (click)="showCloneForm.set(true)"
                  >
                    Copiar de otro año
                  </button>
                  @if (years().length <= 1) {
                    <p class="text-xs text-content-muted sm:col-span-3">
                      Para copiar, debe existir otro año académico.
                    </p>
                  }
                  <button
                    type="button"
                    class="btn btn-outline"
                    (click)="showCreateTemplate.set(true)"
                  >
                    Crear jornada
                  </button>
                </div>
              </div>
            </div>
          } @else {
            @if (!editingTemplateUuid()) {
              <div class="grid gap-3 md:grid-cols-2">
                @for (tpl of templates(); track tpl.publicUuid) {
                  <article class="card">
                    <div
                      class="card-body flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="font-semibold text-content">{{ tpl.name }}</h3>
                          <span
                            class="rounded-full px-2 py-0.5 text-xs"
                            [class.bg-surface-muted]="isTemplateConfigured(tpl)"
                            [class.text-success]="isTemplateConfigured(tpl)"
                            [class.bg-amber-100]="!isTemplateConfigured(tpl)"
                            [class.text-amber-800]="!isTemplateConfigured(tpl)"
                          >
                            {{ isTemplateConfigured(tpl) ? 'Configurada' : 'Revisar jornada' }}
                          </span>
                        </div>
                        <p class="mt-1 text-sm text-content-muted">
                          {{ tpl.levelCode }}{{ tpl.gradeName ? ' · ' + tpl.gradeName : '' }}
                          {{ tpl.shift ? ' · ' + shiftLabel(tpl.shift) : '' }}
                          @if (tpl.shift) {
                            · turno sin vinculación automática
                          } @else {
                            · {{ sectionCountForTemplate(tpl) }} secciones
                          }
                        </p>
                        <p class="mt-2 text-sm text-content-muted">
                          @if (tpl.dayStart && tpl.dayEnd) {
                            {{ formatTime(tpl.dayStart) }}–{{ formatTime(tpl.dayEnd) }} · clases de
                            {{ tpl.periodMinutes ?? '—' }} min
                          } @else {
                            Completa entrada, salida y duración de clase
                          }
                          · {{ recessCount(tpl) }} recreo(s)
                          @if (hasLunch(tpl)) {
                            · incluye almuerzo
                          }
                        </p>
                        @if (tpl.shift) {
                          <p class="mt-2 text-xs text-amber-700">
                            Esta jornada tiene turno, pero las secciones aún no registran turno para
                            vincularla automáticamente.
                          </p>
                        }
                      </div>
                      <button
                        type="button"
                        class="btn btn-outline btn-sm shrink-0"
                        (click)="selectTemplate(tpl.publicUuid)"
                      >
                        Configurar jornada
                        <app-icon name="arrow-right" [size]="14" />
                      </button>
                    </div>
                  </article>
                }
              </div>
              <section class="card mt-5">
                <div
                  class="card-body flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 class="font-semibold text-content">¿Listo para asignar cursos?</h3>
                    <p class="text-sm text-content-muted">
                      Puedes continuar aunque aún falten jornadas por configurar.
                    </p>
                  </div>
                  <a [routerLink]="ROUTES.SCHEDULE.ROOT" class="btn btn-primary">
                    Ir a horarios por sección
                    <app-icon name="arrow-right" [size]="16" />
                  </a>
                </div>
              </section>
            } @else {
              <button type="button" class="btn btn-ghost btn-sm mb-3" (click)="backToTemplates()">
                <app-icon name="arrow-left" [size]="14" />
                Volver a jornadas
              </button>
            }

            @if (editingTemplateUuid()) {
              @if (activeTemplate(); as tpl) {
                <article class="card">
                  <header class="card-header flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 class="card-title text-base">{{ tpl.name }}</h3>
                      <p class="text-xs text-content-muted">
                        {{ tpl.levelCode }}{{ tpl.gradeName ? ' · ' + tpl.gradeName : '' }}
                        {{ tpl.shift ? ' · ' + shiftLabel(tpl.shift) : '' }}
                        @if (tpl.shift) {
                          · sin secciones vinculadas automáticamente
                        } @else {
                          · {{ sectionCountForTemplate(tpl) }} secciones alcanzadas
                        }
                      </p>
                    </div>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm text-danger"
                      (click)="deleteTemplate(tpl)"
                    >
                      Eliminar plantilla
                    </button>
                  </header>

                  <div class="card-body space-y-5">
                    <!-- Timeline hero -->
                    <div>
                      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h4 class="text-sm font-semibold text-content">Vista de la jornada</h4>
                        <label class="flex items-center gap-2 text-sm">
                          <span class="text-content-muted">Ver día</span>
                          <select
                            class="select select-sm w-auto"
                            [ngModel]="previewDay()"
                            (ngModelChange)="previewDay.set($event); touchPlan(tpl.publicUuid)"
                          >
                            @for (day of weekDays; track day.value) {
                              <option [ngValue]="day.value">{{ day.label }}</option>
                            }
                          </select>
                        </label>
                      </div>
                      <app-day-plan-timeline
                        [preview]="planPreview(tpl.publicUuid)"
                        [dayStart]="dayPlanDrafts[tpl.publicUuid].dayStart"
                        [dayEnd]="dayPlanDrafts[tpl.publicUuid].dayEnd"
                      />
                    </div>

                    <!-- Essential controls -->
                    <div class="rounded-lg border border-border-subtle bg-surface-subtle/40 p-4">
                      <header class="mb-3">
                        <h4 class="text-sm font-semibold text-content">Día escolar</h4>
                        <p class="text-xs text-content-muted">
                          Podés editar la hora de cada recreo. Si preferís, usá «Acomodar
                          automáticamente» según entrada, salida y duración.
                        </p>
                      </header>

                      <div class="grid gap-3 sm:grid-cols-12">
                        <div class="sm:col-span-2">
                          <label class="label text-xs">Entrada</label>
                          <input
                            class="input input-sm"
                            type="time"
                            [(ngModel)]="dayPlanDrafts[tpl.publicUuid].dayStart"
                            (ngModelChange)="touchPlan(tpl.publicUuid)"
                          />
                        </div>
                        <div class="sm:col-span-2">
                          <label class="label text-xs">Salida</label>
                          <input
                            class="input input-sm"
                            type="time"
                            [(ngModel)]="dayPlanDrafts[tpl.publicUuid].dayEnd"
                            (ngModelChange)="touchPlan(tpl.publicUuid)"
                          />
                        </div>
                        <div class="sm:col-span-2">
                          <label class="label text-xs">Duración del periodo (min)</label>
                          <input
                            class="input input-sm"
                            type="number"
                            min="15"
                            max="120"
                            [(ngModel)]="dayPlanDrafts[tpl.publicUuid].periodMinutes"
                            (ngModelChange)="touchPlan(tpl.publicUuid)"
                          />
                        </div>
                        <div class="flex items-end sm:col-span-6">
                          <button
                            type="button"
                            class="btn btn-outline btn-sm"
                            (click)="autoArrangeDayPlan(tpl.publicUuid)"
                          >
                            Proponer horarios de recreo
                          </button>
                        </div>
                      </div>

                      <div class="mt-4 space-y-2">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <h5
                            class="text-xs font-semibold uppercase tracking-wide text-content-muted"
                          >
                            Recreos
                          </h5>
                          <button
                            type="button"
                            class="btn btn-ghost btn-sm"
                            [disabled]="
                              dayPlanDrafts[tpl.publicUuid].recesses.length >= maxRecesses
                            "
                            (click)="addRecess(tpl.publicUuid)"
                          >
                            + Agregar recreo
                          </button>
                        </div>
                        @for (
                          recess of dayPlanDrafts[tpl.publicUuid].recesses;
                          track $index;
                          let i = $index
                        ) {
                          <div
                            class="grid gap-2 rounded-lg border border-border-subtle bg-surface-subtle/40 p-3 sm:grid-cols-12"
                          >
                            <div class="flex items-center sm:col-span-2">
                              <span class="text-sm font-semibold text-content">{{
                                recessName(i, dayPlanDrafts[tpl.publicUuid].recesses.length)
                              }}</span>
                            </div>
                            <div class="sm:col-span-2">
                              <label class="label text-xs">Inicio</label>
                              <input
                                class="input input-sm"
                                type="time"
                                [(ngModel)]="recess.startTime"
                                (ngModelChange)="onRecessStartChange(tpl.publicUuid, i)"
                              />
                            </div>
                            <div class="sm:col-span-2">
                              <label class="label text-xs">Fin</label>
                              <input
                                class="input input-sm"
                                type="time"
                                [(ngModel)]="recess.endTime"
                                (ngModelChange)="onRecessEndChange(tpl.publicUuid, i)"
                              />
                            </div>
                            <div class="sm:col-span-2">
                              <label class="label text-xs">Duración (min)</label>
                              <input
                                class="input input-sm"
                                type="number"
                                min="10"
                                max="60"
                                [(ngModel)]="recess.minutes"
                                (ngModelChange)="onRecessMinutesChange(tpl.publicUuid, i)"
                              />
                            </div>
                            <div class="flex items-end justify-end sm:col-span-4">
                              <button
                                type="button"
                                class="btn btn-ghost btn-sm text-danger"
                                [disabled]="dayPlanDrafts[tpl.publicUuid].recesses.length <= 1"
                                (click)="removeRecess(tpl.publicUuid, i)"
                              >
                                Quitar
                              </button>
                            </div>
                          </div>
                        }
                      </div>
                    </div>

                    <section class="rounded-lg border border-border-subtle p-4">
                      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 class="text-sm font-semibold text-content">Almuerzo</h4>
                          <p class="text-xs text-content-muted">
                            Se aplica todos los días de la semana.
                          </p>
                        </div>
                        <label class="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            class="checkbox"
                            [(ngModel)]="dayPlanDrafts[tpl.publicUuid].lunch.enabled"
                            (ngModelChange)="touchPlan(tpl.publicUuid)"
                          />
                          Incluir almuerzo
                        </label>
                      </div>
                      @if (dayPlanDrafts[tpl.publicUuid].lunch.enabled) {
                        <div class="grid gap-3 sm:grid-cols-3">
                          <label class="field">
                            <span class="label text-xs">Inicio</span>
                            <input
                              class="input input-sm"
                              type="time"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].lunch.startTime"
                              (ngModelChange)="onLunchStartChange(tpl.publicUuid)"
                            />
                          </label>
                          <label class="field">
                            <span class="label text-xs">Fin</span>
                            <input
                              class="input input-sm"
                              type="time"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].lunch.endTime"
                              (ngModelChange)="onLunchEndChange(tpl.publicUuid)"
                            />
                          </label>
                          <label class="field">
                            <span class="label text-xs">Duración (min)</span>
                            <input
                              class="input input-sm"
                              type="number"
                              min="15"
                              max="120"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].lunch.minutes"
                              (ngModelChange)="onLunchMinutesChange(tpl.publicUuid)"
                            />
                          </label>
                        </div>
                      }
                    </section>

                    <section class="rounded-lg border border-border-subtle p-4">
                      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h4 class="text-sm font-semibold text-content">
                            Actividades adicionales
                          </h4>
                          <p class="text-xs text-content-muted">
                            Asamblea, tutoría o tiempo reservado. Puedes elegir un día o toda la
                            semana.
                          </p>
                        </div>
                        <button
                          type="button"
                          class="btn btn-outline btn-sm"
                          (click)="toggleSpecialBlock(tpl.publicUuid)"
                        >
                          <app-icon name="plus" [size]="14" /> Agregar actividad
                        </button>
                      </div>
                      @if (dayPlanDrafts[tpl.publicUuid].activities.length > 0) {
                        <ul class="space-y-2">
                          @for (
                            activity of dayPlanDrafts[tpl.publicUuid].activities;
                            track $index;
                            let i = $index
                          ) {
                            <li
                              class="grid gap-2 rounded-lg bg-surface-subtle/50 p-3 sm:grid-cols-12"
                            >
                              <label class="sm:col-span-3">
                                <span class="label text-xs">Actividad</span>
                                <select
                                  class="select select-sm"
                                  [(ngModel)]="activity.blockType"
                                  (ngModelChange)="onActivityTypeChange(tpl.publicUuid, i)"
                                >
                                  @for (type of activityTypes; track type) {
                                    <option [value]="type">{{ blockTypeLabel(type) }}</option>
                                  }
                                </select>
                              </label>
                              <label class="sm:col-span-2">
                                <span class="label text-xs">Nombre</span>
                                <input
                                  class="input input-sm"
                                  [(ngModel)]="activity.label"
                                  (ngModelChange)="touchPlan(tpl.publicUuid)"
                                />
                              </label>
                              <label class="sm:col-span-2">
                                <span class="label text-xs">Día</span>
                                <select
                                  class="select select-sm"
                                  [(ngModel)]="activity.dayOfWeek"
                                  (ngModelChange)="touchPlan(tpl.publicUuid)"
                                >
                                  <option [ngValue]="null">Todos (lun–vie)</option>
                                  @for (d of weekDays; track d.value) {
                                    <option [ngValue]="d.value">{{ d.label }}</option>
                                  }
                                </select>
                              </label>
                              <label class="sm:col-span-2">
                                <span class="label text-xs">Inicio</span>
                                <input
                                  class="input input-sm"
                                  type="time"
                                  [(ngModel)]="activity.startTime"
                                  (ngModelChange)="touchPlan(tpl.publicUuid)"
                                />
                              </label>
                              <label class="sm:col-span-2">
                                <span class="label text-xs">Fin</span>
                                <input
                                  class="input input-sm"
                                  type="time"
                                  [(ngModel)]="activity.endTime"
                                  (ngModelChange)="touchPlan(tpl.publicUuid)"
                                />
                              </label>
                              <div class="flex items-end sm:col-span-1">
                                <button
                                  type="button"
                                  class="btn btn-ghost btn-sm text-danger"
                                  aria-label="Quitar actividad"
                                  (click)="removeActivity(tpl.publicUuid, i)"
                                >
                                  Quitar
                                </button>
                              </div>
                            </li>
                          }
                        </ul>
                      } @else {
                        <p class="text-sm text-content-muted">
                          No hay actividades adicionales en esta jornada.
                        </p>
                      }
                      @if (showSpecialBlock()[tpl.publicUuid]) {
                        <div class="mt-3 grid gap-2 rounded bg-surface-subtle p-3 sm:grid-cols-12">
                          <label class="sm:col-span-3">
                            <span class="label text-xs">Actividad</span>
                            <select
                              class="select select-sm"
                              [(ngModel)]="blockDrafts[tpl.publicUuid].blockType"
                              (ngModelChange)="onBlockTypeChange(tpl.publicUuid)"
                            >
                              @for (type of activityTypes; track type) {
                                <option [value]="type">{{ blockTypeLabel(type) }}</option>
                              }
                            </select>
                          </label>
                          <label class="sm:col-span-2">
                            <span class="label text-xs">Nombre</span>
                            <input
                              class="input input-sm"
                              [(ngModel)]="blockDrafts[tpl.publicUuid].label"
                            />
                          </label>
                          <label class="sm:col-span-2">
                            <span class="label text-xs">Día</span>
                            <select
                              class="select select-sm"
                              [(ngModel)]="blockDrafts[tpl.publicUuid].dayOfWeek"
                            >
                              <option [ngValue]="null">Todos (lun–vie)</option>
                              @for (d of weekDays; track d.value) {
                                <option [ngValue]="d.value">{{ d.label }}</option>
                              }
                            </select>
                          </label>
                          <label class="sm:col-span-2">
                            <span class="label text-xs">Inicio</span>
                            <input
                              class="input input-sm"
                              type="time"
                              [(ngModel)]="blockDrafts[tpl.publicUuid].startTime"
                            />
                          </label>
                          <label class="sm:col-span-2">
                            <span class="label text-xs">Fin</span>
                            <input
                              class="input input-sm"
                              type="time"
                              [(ngModel)]="blockDrafts[tpl.publicUuid].endTime"
                            />
                          </label>
                          <div class="flex items-end sm:col-span-1">
                            <button
                              type="button"
                              class="btn btn-primary btn-sm"
                              (click)="addBlock(tpl.publicUuid)"
                            >
                              Añadir
                            </button>
                          </div>
                        </div>
                      }
                    </section>

                    <div
                      class="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface-raised/95 p-3 shadow-lg backdrop-blur"
                    >
                      <p
                        class="text-sm"
                        [class.text-amber-700]="hasUnsavedPlan(tpl.publicUuid)"
                        [class.text-content-muted]="!hasUnsavedPlan(tpl.publicUuid)"
                      >
                        {{
                          hasUnsavedPlan(tpl.publicUuid)
                            ? 'Tienes cambios sin guardar'
                            : 'Todos los cambios están guardados'
                        }}
                      </p>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          class="btn btn-ghost"
                          [disabled]="
                            !hasUnsavedPlan(tpl.publicUuid) || applyingPlan()[tpl.publicUuid]
                          "
                          (click)="discardPlan(tpl)"
                        >
                          Descartar cambios
                        </button>
                        <button
                          type="button"
                          class="btn btn-primary"
                          [disabled]="
                            !hasUnsavedPlan(tpl.publicUuid) ||
                            !!planValidationMessage(tpl.publicUuid) ||
                            applyingPlan()[tpl.publicUuid]
                          "
                          (click)="applyDayPlan(tpl)"
                        >
                          @if (applyingPlan()[tpl.publicUuid]) {
                            <app-spinner [size]="14" />
                          }
                          Guardar jornada
                        </button>
                      </div>
                    </div>
                    @if (planValidationMessage(tpl.publicUuid); as validationMessage) {
                      <p role="alert" class="text-sm text-danger">{{ validationMessage }}</p>
                    }
                  </div>
                </article>
              }
            }
          }
        </section>

        @if (warnings().length > 0) {
          <section class="card mb-6" aria-labelledby="schedule-warnings">
            <header class="card-header flex items-center justify-between gap-3">
              <div>
                <h2 id="schedule-warnings" class="card-title text-base">Revisión de horarios</h2>
                <p class="text-sm text-content-muted">
                  Hay {{ warnings().length }} aspecto(s) para revisar al asignar cursos.
                </p>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                [disabled]="warningsLoading()"
                (click)="loadWarnings()"
              >
                Actualizar
              </button>
            </header>
            <ul class="divide-y divide-border-subtle px-5">
              @for (
                w of warnings();
                track (w.sectionUuid ?? '') +
                  '|' +
                  (w.gradeUuid ?? '') +
                  '|' +
                  (w.teacherUuid ?? '') +
                  '|' +
                  w.code +
                  '|' +
                  $index
              ) {
                <li class="py-3 text-sm">
                  <span class="font-medium text-content">{{ warningLabel(w) }}</span>
                  @if (w.message && warningLabel(w) !== w.message) {
                    <span class="text-content-muted"> — {{ w.message }}</span>
                  }
                  <span class="mt-0.5 block text-xs text-content-muted"
                    >{{ warningSeverityLabel(w.severity) }} · {{ w.code }}</span
                  >
                </li>
              }
            </ul>
          </section>
        }

        <!-- Advanced (collapsed) -->
        <section class="card mb-6">
          <button
            type="button"
            class="card-header flex w-full items-center justify-between text-left"
            (click)="showAdvanced.set(!showAdvanced())"
            [attr.aria-expanded]="showAdvanced()"
          >
            <h2 class="card-title text-base">Opciones avanzadas</h2>
            <app-icon [name]="showAdvanced() ? 'chevron-up' : 'chevron-down'" [size]="18" />
          </button>

          @if (showAdvanced()) {
            <div class="card-body space-y-6 border-t border-border-subtle pt-4">
              <!-- Import -->
              <div>
                <h3 class="mb-2 text-sm font-semibold text-content">
                  Adjuntar horario de referencia
                </h3>
                <p class="mb-3 text-sm text-content-muted">
                  Guarda un archivo como referencia. Todavía no crea horarios automáticamente.
                  <a
                    class="font-medium text-primary underline"
                    href="/docs/qa/TEMPLATES/horario-import-template.md"
                    target="_blank"
                    rel="noopener"
                  >
                    Ver plantilla de importación
                  </a>
                </p>
                <div class="flex flex-wrap items-center gap-3">
                  <input
                    type="file"
                    class="text-sm"
                    accept=".csv,.xlsx,.xls,.pdf,image/*"
                    (change)="onFileSelected($event)"
                    [disabled]="!selectedYearUuid() || uploading()"
                  />
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="!selectedFile() || !selectedYearUuid() || uploading()"
                    (click)="uploadBootstrap()"
                  >
                    Subir archivo
                  </button>
                </div>
                @if (bootstrapDocs().length > 0) {
                  <ul
                    class="mt-3 divide-y divide-border-subtle rounded border border-border-subtle text-sm"
                  >
                    @for (doc of bootstrapDocs(); track doc.publicUuid) {
                      <li class="flex justify-between gap-2 px-3 py-2">
                        <span>{{ doc.originalFilename }}</span>
                        <span class="text-content-muted">{{
                          parseStatusLabel(doc.parseStatus)
                        }}</span>
                      </li>
                    }
                  </ul>
                }
              </div>
            </div>
          }
        </section>
      }
    </app-page-container>
  `,
})
export class JornadaPageComponent implements OnInit {
  private readonly scheduleApi = inject(ScheduleApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly ROUTES = ROUTES;
  protected readonly formatTime = formatTime;
  protected readonly weekDays = DAYS_OF_WEEK.filter((d) => d.value <= 5);
  protected readonly maxRecesses = MAX_DAY_PLAN_RECESSES;
  protected readonly policyOptions: { value: RecessPolicy; label: string }[] = [
    { value: 'SHARED', label: 'Todos los niveles a la misma hora' },
    { value: 'STAGGERED', label: 'Horarios distintos por nivel' },
  ];

  protected readonly bootLoading = signal(true);
  protected readonly templatesLoading = signal(false);
  protected readonly warningsLoading = signal(false);
  protected readonly savingSettings = signal(false);
  protected readonly seeding = signal(false);
  protected readonly creatingTemplate = signal(false);
  protected readonly uploading = signal(false);
  protected readonly cloning = signal(false);
  protected readonly pageError = signal<string | null>(null);
  protected readonly settingsMessage = signal<string | null>(null);
  protected readonly showAdvanced = signal(false);
  protected readonly showSpecialBlock = signal<Record<string, boolean>>({});
  protected readonly editingTemplateUuid = signal('');
  protected readonly activeTemplateUuid = signal('');

  protected readonly years = signal<AcademicYearRow[]>([]);
  protected readonly levels = signal<AcademicLevel[]>([]);
  protected readonly sections = signal<SectionRow[]>([]);
  protected readonly selectedYearUuid = signal('');
  protected readonly recessPolicy = signal<RecessPolicy>('STAGGERED');
  protected readonly templates = signal<DayTemplate[]>([]);
  protected readonly warnings = signal<ScheduleWarningItem[]>([]);
  protected readonly bootstrapDocs = signal<ScheduleSourceDocument[]>([]);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly showCreateTemplate = signal(false);
  protected readonly showCloneForm = signal(false);
  protected readonly activityTypes = ACTIVITY_TYPES;
  protected readonly previewDay = signal<number>(1);

  protected newTemplate = { levelUuid: '', gradeUuid: '', name: '' };
  protected cloneSourceYearUuid = '';

  protected blockDrafts: Record<
    string,
    {
      blockType: DayBlockType;
      label: string;
      dayOfWeek: number | null;
      startTime: string;
      endTime: string;
    }
  > = {};

  protected dayPlanDrafts: Record<string, DayPlanDraft> = {};
  protected savedPlanSnapshots: Record<string, string> = {};

  protected readonly applyingPlan = signal<Record<string, boolean>>({});
  protected readonly planVersion = signal(0);

  protected readonly activeTemplate = computed(
    () => this.templates().find((t) => t.publicUuid === this.activeTemplateUuid()) ?? null,
  );

  async ngOnInit(): Promise<void> {
    this.bootLoading.set(true);
    try {
      const [years, levels, settings] = await Promise.all([
        firstValueFrom(this.academicApi.listYears()),
        firstValueFrom(this.academicApi.listLevels()),
        firstValueFrom(this.scheduleApi.getSettings()),
      ]);
      this.years.set(years ?? []);
      this.levels.set(levels ?? []);
      this.recessPolicy.set(settings?.recessPolicy ?? 'STAGGERED');
      const active = years?.find((y) => y.status === AcademicYearStatus.Active) ?? years?.[0];
      if (active) {
        this.selectedYearUuid.set(active.publicUuid);
        await this.reloadYearData();
      }
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo cargar la jornada.'));
    } finally {
      this.bootLoading.set(false);
    }
  }

  protected shiftLabel(shift: string | null): string {
    return formatDayTemplateShift(shift);
  }

  protected warningLabel(w: ScheduleWarningItem): string {
    return formatScheduleWarning(w);
  }

  protected warningSeverityLabel(severity: string): string {
    return formatScheduleWarningSeverity(severity);
  }

  protected parseStatusLabel(status: string): string {
    return formatScheduleParseStatus(status);
  }

  protected selectTemplate(uuid: string): void {
    this.activeTemplateUuid.set(uuid);
    this.editingTemplateUuid.set(uuid);
  }

  protected backToTemplates(): void {
    this.editingTemplateUuid.set('');
  }

  protected toggleSpecialBlock(templateUuid: string): void {
    this.showSpecialBlock.update((m) => ({
      ...m,
      [templateUuid]: !m[templateUuid],
    }));
  }

  protected blockTypeLabel(t: DayBlockType | string): string {
    return DAY_BLOCK_TYPE_LABELS[t as DayBlockType] ?? t;
  }

  protected sectionCountForTemplate(template: DayTemplate): number {
    if (template.shift) return 0;
    return this.sections().filter(
      (section) =>
        section.levelPublicUuid === template.levelUuid &&
        (!template.gradeUuid || section.gradePublicUuid === template.gradeUuid),
    ).length;
  }

  protected isTemplateConfigured(template: DayTemplate): boolean {
    return !!template.dayStart && !!template.dayEnd && !!template.periodMinutes;
  }

  protected recessCount(template: DayTemplate): number {
    return (template.blocks ?? []).filter((block) => block.blockType === 'RECESS').length;
  }

  protected hasLunch(template: DayTemplate): boolean {
    return (template.blocks ?? []).some((block) => block.blockType === 'LUNCH');
  }

  protected selectedLevelGrades() {
    return (
      this.levels().find((level) => level.publicUuid === this.newTemplate.levelUuid)?.grades ?? []
    );
  }

  protected templateScopeTaken(): boolean {
    if (!this.newTemplate.levelUuid) return false;
    const gradeUuid = this.newTemplate.gradeUuid || null;
    return this.templates().some(
      (template) =>
        template.levelUuid === this.newTemplate.levelUuid &&
        template.gradeUuid === gradeUuid &&
        !template.shift,
    );
  }

  protected hasUnsavedPlan(templateUuid: string): boolean {
    void this.planVersion();
    const draft = this.dayPlanDrafts[templateUuid];
    return !!draft && this.savedPlanSnapshots[templateUuid] !== this.planSnapshot(draft);
  }

  protected planValidationMessage(templateUuid: string): string | null {
    const draft = this.dayPlanDrafts[templateUuid];
    if (!draft) return null;
    if (
      !draft.dayStart ||
      !draft.dayEnd ||
      this.minutes(draft.dayEnd) <= this.minutes(draft.dayStart)
    ) {
      return 'La salida debe ser posterior a la entrada.';
    }
    const periodMinutes = Number(draft.periodMinutes);
    if (!Number.isFinite(periodMinutes) || periodMinutes < 15 || periodMinutes > 120) {
      return 'La duración de clase debe estar entre 15 y 120 minutos.';
    }
    const intervals: { day: number | null; start: number; end: number }[] = [];
    const addInterval = (startTime: string, endTime: string, day: number | null): boolean => {
      if (!startTime || !endTime) return false;
      const start = this.minutes(startTime);
      const end = this.minutes(endTime);
      if (
        end <= start ||
        start < this.minutes(draft.dayStart) ||
        end > this.minutes(draft.dayEnd)
      ) {
        return false;
      }
      intervals.push({ day, start, end });
      return true;
    };
    for (const recess of draft.recesses) {
      if (!addInterval(recess.startTime, recess.endTime, null)) {
        return 'Cada recreo debe quedar dentro de la jornada y tener una hora de fin posterior.';
      }
    }
    if (draft.lunch.enabled && !addInterval(draft.lunch.startTime, draft.lunch.endTime, null)) {
      return 'El almuerzo debe quedar dentro de la jornada y tener una hora de fin posterior.';
    }
    for (const activity of draft.activities) {
      if (
        !activity.label.trim() ||
        !addInterval(activity.startTime, activity.endTime, activity.dayOfWeek)
      ) {
        return 'Completa cada actividad con nombre y horario dentro de la jornada.';
      }
    }
    for (let i = 0; i < intervals.length; i++) {
      for (let j = i + 1; j < intervals.length; j++) {
        const current = intervals[i];
        const other = intervals[j];
        const sameDay = current.day == null || other.day == null || current.day === other.day;
        if (sameDay && current.start < other.end && other.start < current.end) {
          return 'Hay dos descansos o actividades que se superponen. Ajusta sus horas para continuar.';
        }
      }
    }
    return null;
  }

  private minutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  protected async onYearChange(uuid: string): Promise<void> {
    if (this.hasAnyUnsavedPlans()) {
      const discard = await this.confirmDialog.open({
        title: 'Cambios sin guardar',
        message: 'Si cambias de año, se descartarán las modificaciones pendientes de las jornadas.',
        confirmLabel: 'Descartar y cambiar',
        variant: 'danger',
      });
      if (!discard) return;
    }
    this.dayPlanDrafts = {};
    this.savedPlanSnapshots = {};
    this.cloneSourceYearUuid = '';
    this.selectedYearUuid.set(uuid);
    this.activeTemplateUuid.set('');
    this.editingTemplateUuid.set('');
    await this.reloadYearData();
  }

  protected hasAnyUnsavedPlans(): boolean {
    return Object.keys(this.dayPlanDrafts).some((uuid) => this.hasUnsavedPlan(uuid));
  }

  protected async onPolicyChange(policy: RecessPolicy): Promise<void> {
    this.savingSettings.set(true);
    this.settingsMessage.set(null);
    try {
      const updated = await firstValueFrom(
        this.scheduleApi.updateSettings({ recessPolicy: policy }),
      );
      this.recessPolicy.set(updated.recessPolicy);
      this.settingsMessage.set('Política de recreos actualizada.');
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo guardar la política.'));
    } finally {
      this.savingSettings.set(false);
    }
  }

  protected async seedDefaults(): Promise<void> {
    const yearUuid = this.selectedYearUuid();
    if (!yearUuid) return;
    this.seeding.set(true);
    this.pageError.set(null);
    try {
      const seeded = await firstValueFrom(this.scheduleApi.seedDefaultTemplates(yearUuid));
      this.applyTemplates(seeded);
      this.settingsMessage.set(`Se crearon ${seeded.length} plantilla(s) sugerida(s).`);
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudieron crear los recreos sugeridos.'));
    } finally {
      this.seeding.set(false);
    }
  }

  protected async createTemplate(): Promise<void> {
    const yearUuid = this.selectedYearUuid();
    if (
      !yearUuid ||
      !this.newTemplate.levelUuid ||
      !this.newTemplate.name.trim() ||
      this.templateScopeTaken()
    ) {
      this.pageError.set(
        'Completa nivel, alcance y nombre. Si ya existe una jornada para todo el nivel, elige un grado para crear una excepción.',
      );
      return;
    }
    this.creatingTemplate.set(true);
    try {
      const created = await firstValueFrom(
        this.scheduleApi.createDayTemplate({
          yearUuid,
          levelUuid: this.newTemplate.levelUuid,
          gradeUuid: this.newTemplate.gradeUuid || null,
          name: this.newTemplate.name.trim(),
          shift: null,
        }),
      );
      this.newTemplate = { levelUuid: '', gradeUuid: '', name: '' };
      this.showCreateTemplate.set(false);
      await this.reloadTemplates();
      this.selectTemplate(created.publicUuid);
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo crear la plantilla.'));
    } finally {
      this.creatingTemplate.set(false);
    }
  }

  protected async deleteTemplate(tpl: DayTemplate): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar plantilla',
      message: `¿Eliminar la jornada «${tpl.name}»? Esta acción no se puede deshacer.${this.hasUnsavedPlan(tpl.publicUuid) ? ' También se descartarán los cambios pendientes.' : ''}`,
      confirmLabel: 'Eliminar',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    try {
      await firstValueFrom(this.scheduleApi.deleteDayTemplate(tpl.publicUuid));
      if (this.activeTemplateUuid() === tpl.publicUuid) {
        this.activeTemplateUuid.set('');
      }
      if (this.editingTemplateUuid() === tpl.publicUuid) this.editingTemplateUuid.set('');
      delete this.dayPlanDrafts[tpl.publicUuid];
      delete this.savedPlanSnapshots[tpl.publicUuid];
      await this.reloadTemplates();
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo eliminar la plantilla.'));
    }
  }

  protected async addBlock(templateUuid: string): Promise<void> {
    const draft = this.blockDrafts[templateUuid];
    if (!draft?.label?.trim() || !draft.startTime || !draft.endTime) {
      this.pageError.set('Completá etiqueta, inicio y fin del bloque.');
      return;
    }
    if (!ACTIVITY_TYPES.includes(draft.blockType)) {
      this.pageError.set('Elige una actividad distinta de recreo o almuerzo.');
      return;
    }
    this.dayPlanDrafts[templateUuid].activities.push({
      blockType: draft.blockType as Extract<
        DayBlockType,
        'ASSEMBLY' | 'GUIDANCE' | 'SPECIALIST_RESERVED'
      >,
      label: draft.label.trim(),
      dayOfWeek: draft.dayOfWeek,
      startTime: draft.startTime,
      endTime: draft.endTime,
    });
    this.ensureBlockDraft(templateUuid);
    this.showSpecialBlock.update((m) => ({ ...m, [templateUuid]: false }));
    this.touchPlan(templateUuid);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  protected async uploadBootstrap(): Promise<void> {
    const yearUuid = this.selectedYearUuid();
    const file = this.selectedFile();
    if (!yearUuid || !file) return;
    this.uploading.set(true);
    try {
      await firstValueFrom(this.scheduleApi.uploadBootstrap(yearUuid, file));
      this.selectedFile.set(null);
      await this.reloadBootstrap();
      this.settingsMessage.set('Archivo subido correctamente.');
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo subir el archivo.'));
    } finally {
      this.uploading.set(false);
    }
  }

  protected async cloneSchedule(): Promise<void> {
    const target = this.selectedYearUuid();
    if (!target || !this.cloneSourceYearUuid) return;
    if (this.hasAnyUnsavedPlans()) {
      this.pageError.set('Guarda o descarta los cambios pendientes antes de copiar otro año.');
      return;
    }
    this.cloning.set(true);
    try {
      const cloned = await firstValueFrom(
        this.scheduleApi.cloneSchedule(target, {
          sourceYearUuid: this.cloneSourceYearUuid,
          includeTimeSlots: false,
        }),
      );
      this.applyTemplates(cloned);
      this.showCloneForm.set(false);
      this.cloneSourceYearUuid = '';
      this.settingsMessage.set(`Se clonaron ${cloned.length} plantilla(s).`);
      await this.loadWarnings();
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo clonar el horario.'));
    } finally {
      this.cloning.set(false);
    }
  }

  protected async loadWarnings(): Promise<void> {
    const yearUuid = this.selectedYearUuid();
    if (!yearUuid) return;
    this.warningsLoading.set(true);
    try {
      const list = await firstValueFrom(this.scheduleApi.listValidationWarnings(yearUuid));
      this.warnings.set(list ?? []);
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudieron cargar las advertencias.'));
    } finally {
      this.warningsLoading.set(false);
    }
  }

  private async reloadYearData(): Promise<void> {
    if (!this.selectedYearUuid()) {
      this.templates.set([]);
      this.warnings.set([]);
      this.bootstrapDocs.set([]);
      this.sections.set([]);
      return;
    }
    await Promise.all([
      this.reloadTemplates(),
      this.reloadBootstrap(),
      this.loadWarnings(),
      this.reloadSections(),
    ]);
  }

  private async reloadSections(): Promise<void> {
    const yearUuid = this.selectedYearUuid();
    if (!yearUuid) {
      this.sections.set([]);
      return;
    }
    try {
      this.sections.set(
        await firstValueFrom(this.academicApi.listSections({ academicYearPublicUuid: yearUuid })),
      );
    } catch {
      this.sections.set([]);
    }
  }

  private async reloadTemplates(): Promise<void> {
    const yearUuid = this.selectedYearUuid();
    if (!yearUuid) return;
    this.templatesLoading.set(true);
    try {
      const list = await firstValueFrom(this.scheduleApi.listDayTemplates(yearUuid));
      this.applyTemplates(list);
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudieron cargar las plantillas.'));
    } finally {
      this.templatesLoading.set(false);
    }
  }

  private async reloadBootstrap(): Promise<void> {
    const yearUuid = this.selectedYearUuid();
    if (!yearUuid) return;
    try {
      const docs = await firstValueFrom(this.scheduleApi.listBootstrapDocuments(yearUuid));
      this.bootstrapDocs.set(docs ?? []);
    } catch {
      this.bootstrapDocs.set([]);
    }
  }

  private applyTemplates(list: DayTemplate[]): void {
    this.templates.set(list ?? []);
    for (const tpl of list ?? []) {
      if (!this.blockDrafts[tpl.publicUuid]) {
        this.ensureBlockDraft(tpl.publicUuid);
      }
      this.ensureDayPlanDraft(tpl);
    }
    const current = this.activeTemplateUuid();
    const stillExists = list?.some((t) => t.publicUuid === current);
    if (!stillExists && list?.length) {
      this.activeTemplateUuid.set(list[0].publicUuid);
    } else if (!list?.length) {
      this.activeTemplateUuid.set('');
      this.editingTemplateUuid.set('');
    }
    this.planVersion.update((v) => v + 1);
  }

  protected touchPlan(_templateUuid: string): void {
    this.planVersion.update((v) => v + 1);
  }

  protected recessName(index: number, total: number): string {
    return recessLabelForIndex(index, total);
  }

  protected planPreview(templateUuid: string): DayPlanPreviewItem[] {
    void this.planVersion();
    const draft = this.dayPlanDrafts[templateUuid];
    if (!draft) return [];
    return computeDayPlanPreview(
      draft.dayStart,
      draft.dayEnd,
      Number(draft.periodMinutes) || 45,
      this.hardIntervalsForTemplate(templateUuid, this.previewDay()),
    );
  }

  private hardIntervalsForTemplate(templateUuid: string, dayOfWeek: number): DayPlanHardInterval[] {
    const draft = this.dayPlanDrafts[templateUuid];
    const hard: DayPlanHardInterval[] = (draft?.recesses ?? [])
      .filter((r) => r.startTime && r.endTime)
      .map((r, i, arr) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        label: recessLabelForIndex(i, arr.length),
        kind: 'recess' as const,
      }));

    if (draft?.lunch.enabled && draft.lunch.startTime && draft.lunch.endTime) {
      hard.push({
        startTime: draft.lunch.startTime,
        endTime: draft.lunch.endTime,
        label: 'Almuerzo',
        kind: 'lunch',
      });
    }
    for (const activity of draft?.activities ?? []) {
      if (activity.dayOfWeek != null && activity.dayOfWeek !== dayOfWeek) continue;
      hard.push({
        startTime: activity.startTime,
        endTime: activity.endTime,
        label: activity.label,
        kind: 'other',
      });
    }
    return hard;
  }

  protected autoArrangeDayPlan(templateUuid: string): void {
    const draft = this.dayPlanDrafts[templateUuid];
    if (!draft) return;
    const layout = computeSmartDayPlanLayout({
      dayStart: draft.dayStart,
      dayEnd: draft.dayEnd,
      periodMinutes: Number(draft.periodMinutes) || 45,
      recessMinutes: draft.recesses.map((r) => Number(r.minutes) || 15),
      includeLunch: draft.lunch.enabled,
      lunchMinutes: Number(draft.lunch.minutes) || 45,
    });
    draft.recesses = layout.recesses.map((slot, i) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      minutes:
        draft.recesses[i]?.minutes || inferBreakDurationMinutes(slot.startTime, slot.endTime, 15),
    }));
    if (layout.lunch) {
      draft.lunch.startTime = layout.lunch.startTime;
      draft.lunch.endTime = layout.lunch.endTime;
      draft.lunch.minutes = inferBreakDurationMinutes(
        layout.lunch.startTime,
        layout.lunch.endTime,
        draft.lunch.minutes || 45,
      );
    }
    if (draft.recesses.length === 0) {
      draft.recesses = [{ startTime: '', endTime: '', minutes: 30 }];
    }
    this.touchPlan(templateUuid);
  }

  protected addRecess(templateUuid: string): void {
    const draft = this.dayPlanDrafts[templateUuid];
    if (!draft || draft.recesses.length >= MAX_DAY_PLAN_RECESSES) return;
    const last = draft.recesses[draft.recesses.length - 1];
    const start = last?.endTime
      ? addMinutesToTime(last.endTime, Number(draft.periodMinutes) || 45)
      : draft.dayStart || '10:00';
    const minutes = 15;
    draft.recesses.push({
      startTime: start,
      endTime: addMinutesToTime(start, minutes),
      minutes,
    });
    this.touchPlan(templateUuid);
  }

  protected removeRecess(templateUuid: string, index: number): void {
    const draft = this.dayPlanDrafts[templateUuid];
    if (!draft || draft.recesses.length <= 1) return;
    draft.recesses.splice(index, 1);
    this.touchPlan(templateUuid);
  }

  protected onRecessStartChange(templateUuid: string, index: number): void {
    const recess = this.dayPlanDrafts[templateUuid]?.recesses[index];
    if (!recess?.startTime) return;
    recess.endTime = addMinutesToTime(recess.startTime, Number(recess.minutes) || 15);
    this.touchPlan(templateUuid);
  }

  protected onRecessEndChange(templateUuid: string, index: number): void {
    const recess = this.dayPlanDrafts[templateUuid]?.recesses[index];
    if (!recess?.startTime || !recess.endTime) return;
    recess.minutes = inferBreakDurationMinutes(
      recess.startTime,
      recess.endTime,
      Number(recess.minutes) || 15,
    );
    this.touchPlan(templateUuid);
  }

  protected onRecessMinutesChange(templateUuid: string, index: number): void {
    const recess = this.dayPlanDrafts[templateUuid]?.recesses[index];
    if (!recess?.startTime) return;
    recess.endTime = addMinutesToTime(recess.startTime, Number(recess.minutes) || 15);
    this.touchPlan(templateUuid);
  }

  protected onLunchStartChange(templateUuid: string): void {
    const lunch = this.dayPlanDrafts[templateUuid]?.lunch;
    if (!lunch?.startTime) return;
    lunch.endTime = addMinutesToTime(lunch.startTime, Number(lunch.minutes) || 45);
    this.touchPlan(templateUuid);
  }

  protected onLunchEndChange(templateUuid: string): void {
    const lunch = this.dayPlanDrafts[templateUuid]?.lunch;
    if (!lunch?.startTime || !lunch.endTime) return;
    lunch.minutes = inferBreakDurationMinutes(
      lunch.startTime,
      lunch.endTime,
      Number(lunch.minutes) || 45,
    );
    this.touchPlan(templateUuid);
  }

  protected onLunchMinutesChange(templateUuid: string): void {
    this.onLunchStartChange(templateUuid);
  }

  protected onActivityTypeChange(templateUuid: string, index: number): void {
    const activity = this.dayPlanDrafts[templateUuid]?.activities[index];
    if (!activity) return;
    const labels: Record<string, string> = {
      ASSEMBLY: 'Asamblea',
      GUIDANCE: 'Tutoría',
      SPECIALIST_RESERVED: 'Especialista',
    };
    activity.label = labels[activity.blockType];
    this.touchPlan(templateUuid);
  }

  protected removeActivity(templateUuid: string, index: number): void {
    this.dayPlanDrafts[templateUuid]?.activities.splice(index, 1);
    this.touchPlan(templateUuid);
  }

  protected onBlockTypeChange(templateUuid: string): void {
    const draft = this.blockDrafts[templateUuid];
    if (!draft) return;
    const labels: Partial<Record<DayBlockType, string>> = {
      ASSEMBLY: 'Asamblea',
      GUIDANCE: 'Tutoría',
      SPECIALIST_RESERVED: 'Especialista',
    };
    draft.label = labels[draft.blockType] ?? draft.label;
  }

  protected async applyDayPlan(tpl: DayTemplate): Promise<void> {
    const draft = this.dayPlanDrafts[tpl.publicUuid];
    if (!draft) return;

    this.applyingPlan.update((m) => ({ ...m, [tpl.publicUuid]: true }));
    this.pageError.set(null);
    try {
      const recesses = draft.recesses
        .filter((r) => r.startTime && r.endTime)
        .map((r, i, arr) => ({
          startTime: this.normalizeTime(r.startTime),
          endTime: this.normalizeTime(r.endTime),
          label: recessLabelForIndex(i, arr.length),
        }));
      const lunch = draft.lunch.enabled
        ? {
            startTime: this.normalizeTime(draft.lunch.startTime),
            endTime: this.normalizeTime(draft.lunch.endTime),
            label: 'Almuerzo',
          }
        : null;
      const saved = await firstValueFrom(
        this.scheduleApi.applyDayPlan(tpl.publicUuid, {
          dayStart: this.normalizeTime(draft.dayStart),
          dayEnd: this.normalizeTime(draft.dayEnd),
          periodMinutes: Number(draft.periodMinutes) || 45,
          recesses,
          lunch,
          activities: draft.activities.map((activity) => ({
            blockType: activity.blockType,
            dayOfWeek: activity.dayOfWeek,
            startTime: this.normalizeTime(activity.startTime),
            endTime: this.normalizeTime(activity.endTime),
            label: activity.label.trim(),
          })),
        }),
      );
      this.settingsMessage.set(`Día escolar guardado para «${tpl.name}».`);
      this.templates.update((templates) =>
        templates.map((template) => (template.publicUuid === saved.publicUuid ? saved : template)),
      );
      delete this.dayPlanDrafts[tpl.publicUuid];
      delete this.savedPlanSnapshots[tpl.publicUuid];
      this.ensureDayPlanDraft(saved);
      this.planVersion.update((version) => version + 1);
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo guardar el día escolar.'));
    } finally {
      this.applyingPlan.update((m) => ({ ...m, [tpl.publicUuid]: false }));
    }
  }

  private ensureDayPlanDraft(tpl: DayTemplate): void {
    if (this.dayPlanDrafts[tpl.publicUuid]) return;
    const defaults = defaultsForLevel(tpl.levelCode);
    const recessBlocks = tpl.blocks
      .filter((b) => b.blockType === 'RECESS')
      .slice()
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const recesses: DayPlanRecessDraft[] =
      recessBlocks.length > 0
        ? recessBlocks.map((b, i) => ({
            startTime: this.toInputTime(b.startTime),
            endTime: this.toInputTime(b.endTime),
            minutes: inferBreakDurationMinutes(
              b.startTime,
              b.endTime,
              defaults.recessMinutes[i] ?? defaults.recessMinutes[0] ?? 15,
            ),
          }))
        : defaults.recessMinutes.map((minutes) => ({
            startTime: '',
            endTime: '',
            minutes,
          }));

    const lunchBlock = tpl.blocks.find((block) => block.blockType === 'LUNCH');
    this.dayPlanDrafts[tpl.publicUuid] = {
      dayStart: this.toInputTime(tpl.dayStart) || defaults.dayStart,
      dayEnd: this.toInputTime(tpl.dayEnd) || defaults.dayEnd,
      periodMinutes: tpl.periodMinutes ?? defaults.periodMinutes,
      recesses,
      lunch: {
        enabled: !!lunchBlock,
        startTime: lunchBlock ? this.toInputTime(lunchBlock.startTime) : '12:00',
        endTime: lunchBlock ? this.toInputTime(lunchBlock.endTime) : '12:45',
        minutes: lunchBlock
          ? inferBreakDurationMinutes(lunchBlock.startTime, lunchBlock.endTime, 45)
          : 45,
      },
      activities: tpl.blocks
        .filter((block) => SPECIAL_BLOCK_TYPES.has(block.blockType))
        .map((block) => ({
          blockType: block.blockType as Extract<
            DayBlockType,
            'ASSEMBLY' | 'GUIDANCE' | 'SPECIALIST_RESERVED'
          >,
          label: block.label,
          dayOfWeek: block.dayOfWeek,
          startTime: this.toInputTime(block.startTime),
          endTime: this.toInputTime(block.endTime),
        })),
    };

    const needsArrange = recesses.some((r) => !r.startTime || !r.endTime);
    if (needsArrange) {
      this.autoArrangeDayPlan(tpl.publicUuid);
    } else {
      this.touchPlan(tpl.publicUuid);
    }
    this.savedPlanSnapshots[tpl.publicUuid] = this.planSnapshot(this.dayPlanDrafts[tpl.publicUuid]);
  }

  protected discardPlan(template: DayTemplate): void {
    delete this.dayPlanDrafts[template.publicUuid];
    delete this.savedPlanSnapshots[template.publicUuid];
    this.ensureDayPlanDraft(template);
    this.planVersion.update((version) => version + 1);
  }

  private planSnapshot(draft: DayPlanDraft): string {
    return JSON.stringify({
      dayStart: draft.dayStart,
      dayEnd: draft.dayEnd,
      periodMinutes: Number(draft.periodMinutes),
      recesses: draft.recesses.map((recess) => ({
        startTime: recess.startTime,
        endTime: recess.endTime,
        minutes: Number(recess.minutes),
      })),
      lunch: { ...draft.lunch, minutes: Number(draft.lunch.minutes) },
      activities: draft.activities.map((activity) => ({ ...activity })),
    });
  }

  private toInputTime(value: string | null | undefined): string {
    if (!value) return '';
    const parts = value.split(':');
    return `${parts[0]?.padStart(2, '0') ?? '08'}:${parts[1]?.padStart(2, '0') ?? '00'}`;
  }

  private ensureBlockDraft(templateUuid: string): void {
    this.blockDrafts[templateUuid] = {
      blockType: 'ASSEMBLY',
      label: 'Asamblea',
      dayOfWeek: null,
      startTime: '08:00',
      endTime: '08:30',
    };
  }

  private normalizeTime(value: string): string {
    if (!value) return value;
    return value.length === 5 ? `${value}:00` : value;
  }

  private errMsg(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message) || fallback;
    }
    return fallback;
  }
}

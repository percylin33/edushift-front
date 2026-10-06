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
  CreateDayBlockRequest,
  DAY_BLOCK_TYPE_LABELS,
  DAY_TEMPLATE_SHIFT_OPTIONS,
  DAYS_OF_WEEK,
  DayBlockItem,
  DayBlockType,
  DayTemplate,
  RECESS_POLICY_HINTS,
  RECESS_POLICY_LABELS,
  RecessPolicy,
  ScheduleSourceDocument,
  ScheduleWarningItem,
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

const BLOCK_TYPES: DayBlockType[] = [
  'LUNCH',
  'ASSEMBLY',
  'GUIDANCE',
  'SPECIALIST_RESERVED',
  'RECESS',
];

const SPECIAL_BLOCK_TYPES = new Set<DayBlockType>([
  'LUNCH',
  'ASSEMBLY',
  'GUIDANCE',
  'SPECIALIST_RESERVED',
]);

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

      <!-- Progress steps -->
      <nav aria-label="Pasos de configuración" class="mb-6">
        <ol class="grid gap-2 sm:grid-cols-3">
          @for (step of setupSteps; track step.id) {
            <li
              class="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              [ngClass]="
                step.id === 2 ? 'border-primary bg-primary/5' : 'border-border-subtle'
              "
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                [class.bg-primary]="step.id <= 2"
                [class.text-white]="step.id <= 2"
                [class.bg-surface-muted]="step.id > 2"
                [class.text-content-muted]="step.id > 2"
              >
                {{ step.id }}
              </span>
              <span class="font-medium text-content">{{ step.label }}</span>
            </li>
          }
        </ol>
      </nav>

      @if (bootLoading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando…" />
        </div>
      } @else {
        <!-- Step 1: Year + recess policy -->
        <section class="card mb-6" aria-labelledby="jornada-step1">
          <header class="card-header">
            <h2 id="jornada-step1" class="card-title text-base">Paso 1 · Año y recreos</h2>
          </header>
          <div class="card-body grid gap-4 sm:grid-cols-12">
            <div class="sm:col-span-4">
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
            <div class="sm:col-span-4">
              <label class="label" for="jornada-policy">Política de recreos</label>
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
              <p class="mt-1 text-xs text-content-muted">{{ policyHint() }}</p>
            </div>
            <div class="flex flex-col justify-end gap-1 sm:col-span-4">
              <button
                type="button"
                class="btn btn-primary btn-sm self-start"
                [disabled]="!selectedYearUuid() || seeding()"
                (click)="seedDefaults()"
              >
                @if (seeding()) {
                  <app-spinner [size]="14" />
                }
                Crear recreos sugeridos
              </button>
              <p class="text-xs text-content-muted">
                Genera plantillas por nivel con horarios de recreo habituales.
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

        <!-- Step 2: Day per level -->
        <section class="mb-8" aria-labelledby="jornada-step2">
          <header class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="jornada-step2" class="text-lg font-semibold text-content">
                Paso 2 · Día por nivel
              </h2>
              <p class="text-sm text-content-muted">
                Elegí un nivel, ajustá la jornada y guardá el día escolar.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-outline btn-sm self-start"
              [disabled]="!selectedYearUuid()"
              (click)="showCreateTemplate.set(!showCreateTemplate())"
            >
              <app-icon name="plus" [size]="14" />
              Nueva plantilla
            </button>
          </header>

          @if (showCreateTemplate()) {
            <div class="card mb-4">
              <div class="card-body grid gap-3 sm:grid-cols-12">
                <div class="sm:col-span-3">
                  <label class="label" for="tpl-level">Nivel</label>
                  <select id="tpl-level" class="select" [(ngModel)]="newTemplate.levelUuid">
                    <option value="">Seleccionar…</option>
                    @for (lv of levels(); track lv.publicUuid) {
                      <option [value]="lv.publicUuid">{{ lv.code }} — {{ lv.name }}</option>
                    }
                  </select>
                </div>
                <div class="sm:col-span-4">
                  <label class="label" for="tpl-name">Nombre</label>
                  <input id="tpl-name" class="input" [(ngModel)]="newTemplate.name" />
                </div>
                <div class="sm:col-span-2">
                  <label class="label" for="tpl-shift">Turno</label>
                  <select id="tpl-shift" class="select" [(ngModel)]="newTemplate.shift">
                    <option value="">Sin turno</option>
                    @for (opt of shiftOptions; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </div>
                <div class="flex items-end sm:col-span-3">
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    [disabled]="creatingTemplate()"
                    (click)="createTemplate()"
                  >
                    Crear
                  </button>
                </div>
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
                  title="Sin plantillas de jornada"
                  description="Empezá creando recreos sugeridos o una plantilla nueva."
                />
                <ol class="grid gap-3 sm:grid-cols-3">
                  @for (hint of onboardingHints; track hint.title) {
                    <li class="rounded-lg border border-border-subtle bg-surface-subtle/50 p-3">
                      <p class="text-sm font-medium text-content">{{ hint.title }}</p>
                      <p class="mt-1 text-xs text-content-muted">{{ hint.description }}</p>
                    </li>
                  }
                </ol>
              </div>
            </div>
          } @else {
            <!-- Template tabs -->
            <div
              class="mb-4 flex gap-1 overflow-x-auto border-b border-border-subtle pb-px"
              role="tablist"
            >
              @for (tpl of templates(); track tpl.publicUuid) {
                <button
                  type="button"
                  role="tab"
                  class="shrink-0 rounded-t-md px-3 py-2 text-sm font-medium transition"
                  [class.bg-surface-raised]="activeTemplateUuid() === tpl.publicUuid"
                  [class.text-primary]="activeTemplateUuid() === tpl.publicUuid"
                  [class.border]="activeTemplateUuid() === tpl.publicUuid"
                  [class.border-border-subtle]="activeTemplateUuid() === tpl.publicUuid"
                  [class.border-b-0]="activeTemplateUuid() === tpl.publicUuid"
                  [class.text-content-muted]="activeTemplateUuid() !== tpl.publicUuid"
                  [attr.aria-selected]="activeTemplateUuid() === tpl.publicUuid"
                  (click)="selectTemplate(tpl.publicUuid)"
                >
                  {{ tpl.name }}
                  <span class="ml-1 text-xs opacity-70">{{ tpl.levelCode }}</span>
                </button>
              }
            </div>

            @if (activeTemplate(); as tpl) {
              <article class="card">
                <header class="card-header flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 class="card-title text-base">{{ tpl.name }}</h3>
                    <p class="text-xs text-content-muted">
                      {{ tpl.levelCode
                      }}{{ tpl.gradeName ? ' · ' + tpl.gradeName : '' }}
                      {{ tpl.shift ? ' · ' + shiftLabel(tpl.shift) : '' }}
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
                    <h4 class="mb-2 text-sm font-semibold text-content">Vista del día</h4>
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
                      <div class="sm:col-span-6 flex items-end">
                        <button
                          type="button"
                          class="btn btn-outline btn-sm"
                          (click)="autoArrangeDayPlan(tpl.publicUuid)"
                        >
                          Acomodar recreos automáticamente
                        </button>
                      </div>
                    </div>

                    <div class="mt-4 space-y-2">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <h5 class="text-xs font-semibold uppercase tracking-wide text-content-muted">
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
                          <div class="sm:col-span-2 flex items-center">
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
                          <div class="sm:col-span-4 flex items-end justify-end">
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

                    <div class="mt-4 flex justify-end">
                      <button
                        type="button"
                        class="btn btn-primary"
                        [disabled]="applyingPlan()[tpl.publicUuid]"
                        (click)="applyDayPlan(tpl)"
                      >
                        @if (applyingPlan()[tpl.publicUuid]) {
                          <app-spinner [size]="14" />
                        }
                        Guardar día escolar
                      </button>
                    </div>
                  </div>

                  <!-- Special blocks (almuerzo, asamblea, tutoría…) -->
                  @if (specialBlocks(tpl).length > 0) {
                    <div>
                      <h4 class="mb-2 text-sm font-semibold text-content">Bloques especiales</h4>
                      <p class="mb-2 text-xs text-content-muted">
                        Almuerzo, asamblea, tutoría u otros. Los recreos del día se editan arriba.
                      </p>
                      <ul class="divide-y divide-border-subtle rounded border border-border-subtle">
                        @for (b of specialBlocks(tpl); track b.publicUuid) {
                          <li
                            class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                          >
                            <span>
                              <span class="font-medium">{{ friendlyBlockLabel(b.label) }}</span>
                              <span class="text-content-muted">
                                · {{ blockTypeLabel(b.blockType) }} ·
                                {{ dayLabel(b.dayOfWeek) }} ·
                                {{ formatTime(b.startTime) }}–{{ formatTime(b.endTime) }}
                              </span>
                            </span>
                            <button
                              type="button"
                              class="btn btn-ghost btn-sm text-danger"
                              (click)="deleteBlock(b.publicUuid)"
                            >
                              Quitar
                            </button>
                          </li>
                        }
                      </ul>
                    </div>
                  }

                  <!-- Special block (collapsed, inside advanced OR inline toggle) -->
                  <div>
                    <button
                      type="button"
                      class="text-sm font-medium text-primary hover:underline"
                      (click)="toggleSpecialBlock(tpl.publicUuid)"
                    >
                      ¿Necesitás un bloque especial (almuerzo, asamblea, tutoría)?
                      <app-icon
                        [name]="showSpecialBlock()[tpl.publicUuid] ? 'chevron-up' : 'chevron-down'"
                        [size]="14"
                        class="inline"
                      />
                    </button>
                    @if (showSpecialBlock()[tpl.publicUuid]) {
                      <div class="mt-3 grid gap-2 rounded bg-surface-subtle p-3 sm:grid-cols-12">
                        <div class="sm:col-span-2">
                          <label class="label text-xs">Tipo</label>
                          <select
                            class="select select-sm"
                            [(ngModel)]="blockDrafts[tpl.publicUuid].blockType"
                            (ngModelChange)="onBlockTypeChange(tpl.publicUuid)"
                          >
                            @for (t of blockTypes; track t) {
                              <option [value]="t">{{ blockTypeLabel(t) }}</option>
                            }
                          </select>
                        </div>
                        <div class="sm:col-span-2">
                          <label class="label text-xs">Etiqueta</label>
                          <input
                            class="input input-sm"
                            [(ngModel)]="blockDrafts[tpl.publicUuid].label"
                          />
                        </div>
                        <div class="sm:col-span-2">
                          <label class="label text-xs">Día</label>
                          <select
                            class="select select-sm"
                            [(ngModel)]="blockDrafts[tpl.publicUuid].dayOfWeek"
                          >
                            <option [ngValue]="null">Todos (lun–vie)</option>
                            @for (d of weekDays; track d.value) {
                              <option [ngValue]="d.value">{{ d.label }}</option>
                            }
                          </select>
                        </div>
                        <div class="sm:col-span-2">
                          <label class="label text-xs">Inicio</label>
                          <input
                            class="input input-sm"
                            type="time"
                            [(ngModel)]="blockDrafts[tpl.publicUuid].startTime"
                          />
                        </div>
                        <div class="sm:col-span-2">
                          <label class="label text-xs">Fin</label>
                          <input
                            class="input input-sm"
                            type="time"
                            [(ngModel)]="blockDrafts[tpl.publicUuid].endTime"
                          />
                        </div>
                        <div class="flex items-end sm:col-span-2">
                          <button
                            type="button"
                            class="btn btn-outline btn-sm w-full"
                            (click)="addBlock(tpl.publicUuid)"
                          >
                            Agregar bloque
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              </article>
            }
          }
        </section>

        <!-- Step 3: Continue -->
        <section
          class="card mb-6 transition-shadow"
          aria-labelledby="jornada-step3"
          [class.ring-2]="highlightContinue()"
          [class.ring-primary]="highlightContinue()"
        >
          <div class="card-body flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="jornada-step3" class="text-base font-semibold text-content">
                Paso 3 · Asignar cursos
              </h2>
              <p class="text-sm text-content-muted">
                Ya definiste la jornada. El siguiente paso es asignar materias en cada periodo.
              </p>
            </div>
            <a [routerLink]="ROUTES.SCHEDULE.ROOT" class="btn btn-primary">
              <app-icon name="arrow-right" [size]="16" />
              Ir a asignar cursos por sección
            </a>
          </div>
        </section>

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
                  Importar horario desde archivo
                </h3>
                <p class="mb-3 text-sm text-content-muted">
                  Subí un CSV, Excel, PDF o imagen del horario del año anterior.
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

              <!-- Clone -->
              <div>
                <h3 class="mb-2 text-sm font-semibold text-content">
                  Clonar horario desde otro año
                </h3>
                <div class="grid gap-3 sm:grid-cols-12">
                  <div class="sm:col-span-5">
                    <label class="label" for="clone-source">Año origen</label>
                    <select id="clone-source" class="select" [(ngModel)]="cloneSourceYearUuid">
                      <option value="">Seleccionar…</option>
                      @for (y of years(); track y.publicUuid) {
                        @if (y.publicUuid !== selectedYearUuid()) {
                          <option [value]="y.publicUuid">{{ y.name }}</option>
                        }
                      }
                    </select>
                  </div>
                  <div class="flex items-end gap-3 sm:col-span-4">
                    <label class="flex items-center gap-2 text-sm">
                      <input type="checkbox" [(ngModel)]="cloneIncludeTimeSlots" />
                      Incluir clases ya asignadas
                    </label>
                  </div>
                  <div class="flex items-end sm:col-span-3">
                    <button
                      type="button"
                      class="btn btn-outline btn-sm w-full"
                      [disabled]="!selectedYearUuid() || !cloneSourceYearUuid || cloning()"
                      (click)="cloneSchedule()"
                    >
                      Clonar
                    </button>
                  </div>
                </div>
              </div>

              <!-- Warnings -->
              <div>
                <header class="mb-2 flex items-center justify-between">
                  <h3 class="text-sm font-semibold text-content">Advertencias de validación</h3>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    [disabled]="!selectedYearUuid() || warningsLoading()"
                    (click)="loadWarnings()"
                  >
                    Actualizar
                  </button>
                </header>
                @if (warningsLoading()) {
                  <app-spinner [size]="18" label="Cargando advertencias…" />
                } @else if (warnings().length === 0) {
                  <p class="text-sm text-content-muted">Sin advertencias para este año.</p>
                } @else {
                  <ul class="space-y-2">
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
                      <li
                        class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200"
                      >
                        <span class="font-medium">{{
                          warningLabel(w)
                        }}</span>
                        @if (w.message && warningLabel(w) !== w.message) {
                          <span class="text-amber-800/80"> — {{ w.message }}</span>
                        }
                        <span class="mt-0.5 block text-[10px] uppercase opacity-60">
                          {{ warningSeverityLabel(w.severity) }} · {{ w.code }}
                        </span>
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
  protected readonly blockTypes = BLOCK_TYPES;
  protected readonly shiftOptions = DAY_TEMPLATE_SHIFT_OPTIONS;
  protected readonly maxRecesses = MAX_DAY_PLAN_RECESSES;
  protected readonly policyOptions: { value: RecessPolicy; label: string }[] = [
    { value: 'SHARED', label: RECESS_POLICY_LABELS.SHARED },
    { value: 'STAGGERED', label: RECESS_POLICY_LABELS.STAGGERED },
  ];

  protected readonly setupSteps = [
    { id: 1, label: 'Año y recreos' },
    { id: 2, label: 'Día por nivel' },
    { id: 3, label: 'Ir a horarios' },
  ];

  protected readonly onboardingHints = [
    {
      title: '1. Crear recreos sugeridos',
      description: 'Genera plantillas por nivel con horarios habituales.',
    },
    {
      title: '2. Ajustar el día por nivel',
      description: 'Revisá la línea de tiempo y guardá el día escolar.',
    },
    {
      title: '3. Ir a horarios de sección',
      description: 'Asigná materias en cada periodo vacío.',
    },
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
  protected readonly highlightContinue = signal(false);
  protected readonly activeTemplateUuid = signal('');

  protected readonly years = signal<AcademicYearRow[]>([]);
  protected readonly levels = signal<AcademicLevel[]>([]);
  protected readonly selectedYearUuid = signal('');
  protected readonly recessPolicy = signal<RecessPolicy>('STAGGERED');
  protected readonly templates = signal<DayTemplate[]>([]);
  protected readonly warnings = signal<ScheduleWarningItem[]>([]);
  protected readonly bootstrapDocs = signal<ScheduleSourceDocument[]>([]);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly showCreateTemplate = signal(false);

  protected newTemplate = { levelUuid: '', name: '', shift: '' };
  protected cloneSourceYearUuid = '';
  protected cloneIncludeTimeSlots = false;

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

  protected readonly applyingPlan = signal<Record<string, boolean>>({});
  protected readonly planVersion = signal(0);

  protected readonly policyHint = computed(
    () => RECESS_POLICY_HINTS[this.recessPolicy()] ?? '',
  );

  protected readonly activeTemplate = computed(() =>
    this.templates().find((t) => t.publicUuid === this.activeTemplateUuid()) ?? null,
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

  protected friendlyBlockLabel(label: string): string {
    if (/^lonchera$/i.test(label.trim())) return 'Almuerzo';
    return label;
  }

  /** Recreo/almuerzo se editan en el formulario; aquí solo asamblea/tutoría/etc. */
  protected specialBlocks(tpl: DayTemplate): DayBlockItem[] {
    return (tpl.blocks ?? []).filter((b) => SPECIAL_BLOCK_TYPES.has(b.blockType));
  }

  protected dayLabel(day: number | null): string {
    if (day == null) return 'Todos (lun–vie)';
    return DAYS_OF_WEEK.find((d) => d.value === day)?.label ?? String(day);
  }

  protected async onYearChange(uuid: string): Promise<void> {
    this.selectedYearUuid.set(uuid);
    this.activeTemplateUuid.set('');
    await this.reloadYearData();
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
    if (!yearUuid || !this.newTemplate.levelUuid || !this.newTemplate.name.trim()) {
      this.pageError.set('Completá nivel y nombre para crear la plantilla.');
      return;
    }
    this.creatingTemplate.set(true);
    try {
      await firstValueFrom(
        this.scheduleApi.createDayTemplate({
          yearUuid,
          levelUuid: this.newTemplate.levelUuid,
          name: this.newTemplate.name.trim(),
          shift: this.newTemplate.shift?.trim() || null,
        }),
      );
      this.newTemplate = { levelUuid: '', name: '', shift: '' };
      this.showCreateTemplate.set(false);
      await this.reloadTemplates();
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo crear la plantilla.'));
    } finally {
      this.creatingTemplate.set(false);
    }
  }

  protected async deleteTemplate(tpl: DayTemplate): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Eliminar plantilla',
      message: `¿Eliminar la plantilla «${tpl.name}»? Esta acción no se puede deshacer.`,
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
    const body: CreateDayBlockRequest = {
      blockType: draft.blockType,
      label: draft.label.trim(),
      startTime: this.normalizeTime(draft.startTime),
      endTime: this.normalizeTime(draft.endTime),
      dayOfWeek: draft.dayOfWeek,
    };
    try {
      await firstValueFrom(this.scheduleApi.addBlock(templateUuid, body));
      this.ensureBlockDraft(templateUuid);
      await this.reloadTemplates();
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo agregar el bloque.'));
    }
  }

  protected async deleteBlock(blockUuid: string): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Quitar bloque',
      message: '¿Quitar este bloque del día escolar?',
      confirmLabel: 'Quitar',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await firstValueFrom(this.scheduleApi.deleteBlock(blockUuid));
      await this.reloadTemplates();
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo eliminar el bloque.'));
    }
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
    this.cloning.set(true);
    try {
      const cloned = await firstValueFrom(
        this.scheduleApi.cloneSchedule(target, {
          sourceYearUuid: this.cloneSourceYearUuid,
          includeTimeSlots: this.cloneIncludeTimeSlots,
        }),
      );
      this.applyTemplates(cloned);
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
      return;
    }
    await Promise.all([this.reloadTemplates(), this.reloadBootstrap(), this.loadWarnings()]);
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
      this.hardIntervalsForTemplate(templateUuid),
    );
  }

  private hardIntervalsForTemplate(templateUuid: string): DayPlanHardInterval[] {
    const draft = this.dayPlanDrafts[templateUuid];
    const hard: DayPlanHardInterval[] = (draft?.recesses ?? [])
      .filter((r) => r.startTime && r.endTime)
      .map((r, i, arr) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        label: recessLabelForIndex(i, arr.length),
        kind: 'recess' as const,
      }));

    const tpl = this.templates().find((t) => t.publicUuid === templateUuid);
    for (const b of tpl?.blocks ?? []) {
      if (b.blockType === 'RECESS') continue;
      hard.push({
        startTime: this.toInputTime(b.startTime),
        endTime: this.toInputTime(b.endTime),
        label: this.friendlyBlockLabel(b.label),
        kind: b.blockType === 'LUNCH' ? 'lunch' : 'other',
      });
    }
    return hard;
  }

  protected autoArrangeDayPlan(templateUuid: string): void {
    const draft = this.dayPlanDrafts[templateUuid];
    if (!draft) return;
    const tpl = this.templates().find((t) => t.publicUuid === templateUuid);
    const lunchBlock = tpl?.blocks.find((b) => b.blockType === 'LUNCH');
    const layout = computeSmartDayPlanLayout({
      dayStart: draft.dayStart,
      dayEnd: draft.dayEnd,
      periodMinutes: Number(draft.periodMinutes) || 45,
      recessMinutes: draft.recesses.map((r) => Number(r.minutes) || 15),
      includeLunch: !!lunchBlock,
      lunchMinutes: lunchBlock
        ? inferBreakDurationMinutes(lunchBlock.startTime, lunchBlock.endTime, 45)
        : 45,
    });
    draft.recesses = layout.recesses.map((slot, i) => ({
      startTime: slot.startTime,
      endTime: slot.endTime,
      minutes:
        draft.recesses[i]?.minutes ||
        inferBreakDurationMinutes(slot.startTime, slot.endTime, 15),
    }));
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

  protected onBlockTypeChange(templateUuid: string): void {
    const draft = this.blockDrafts[templateUuid];
    if (!draft) return;
    const labels: Partial<Record<DayBlockType, string>> = {
      RECESS: 'Recreo',
      LUNCH: 'Almuerzo',
      ASSEMBLY: 'Asamblea',
      GUIDANCE: 'Tutoría',
      SPECIALIST_RESERVED: 'Especialista',
    };
    draft.label = labels[draft.blockType] ?? draft.label;
    if (draft.blockType === 'LUNCH') {
      draft.startTime = draft.startTime || '12:00';
      draft.endTime = draft.endTime || '12:45';
    }
  }

  protected async applyDayPlan(tpl: DayTemplate): Promise<void> {
    const draft = this.dayPlanDrafts[tpl.publicUuid];
    if (!draft) return;
    const ok = await this.confirmDialog.open({
      title: 'Guardar día escolar',
      message: `¿Guardar el día escolar de «${tpl.name}»? Se actualizarán recreos y almuerzo; otros bloques especiales se conservan.`,
      confirmLabel: 'Guardar',
      variant: 'default',
      icon: 'save',
    });
    if (!ok) return;

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
      const existingLunch = tpl.blocks.find((b) => b.blockType === 'LUNCH');
      const lunch = existingLunch
        ? {
            startTime: this.normalizeTime(this.toInputTime(existingLunch.startTime)),
            endTime: this.normalizeTime(this.toInputTime(existingLunch.endTime)),
            label: existingLunch.label?.trim() || 'Almuerzo',
          }
        : null;
      await firstValueFrom(
        this.scheduleApi.applyDayPlan(tpl.publicUuid, {
          dayStart: this.normalizeTime(draft.dayStart),
          dayEnd: this.normalizeTime(draft.dayEnd),
          periodMinutes: Number(draft.periodMinutes) || 45,
          recesses,
          lunch,
        }),
      );
      this.settingsMessage.set(`Día escolar guardado para «${tpl.name}».`);
      this.highlightContinue.set(true);
      await this.reloadTemplates();
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo guardar el día escolar.'));
    } finally {
      this.applyingPlan.update((m) => ({ ...m, [tpl.publicUuid]: false }));
    }
  }

  private ensureDayPlanDraft(tpl: DayTemplate): void {
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

    this.dayPlanDrafts[tpl.publicUuid] = {
      dayStart: this.toInputTime(tpl.dayStart) || defaults.dayStart,
      dayEnd: this.toInputTime(tpl.dayEnd) || defaults.dayEnd,
      periodMinutes: tpl.periodMinutes ?? defaults.periodMinutes,
      recesses,
    };

    const needsArrange = recesses.some((r) => !r.startTime || !r.endTime);
    if (needsArrange) {
      this.autoArrangeDayPlan(tpl.publicUuid);
    } else {
      this.touchPlan(tpl.publicUuid);
    }
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

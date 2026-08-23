import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import {
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
  DAYS_OF_WEEK,
  DayBlockType,
  DayTemplate,
  RECESS_POLICY_LABELS,
  RecessPolicy,
  ScheduleSourceDocument,
  ScheduleWarningItem,
  formatTime,
} from '@features/academic/models';
import { ScheduleApiService } from '../../services/schedule-api.service';
import {
  DayPlanHardInterval,
  DayPlanPreviewItem,
  computeDayPlanPreview,
  defaultsForLevel,
} from '../../utils/day-plan.util';

const BLOCK_TYPES: DayBlockType[] = [
  'RECESS',
  'LUNCH',
  'ASSEMBLY',
  'GUIDANCE',
  'SPECIALIST_RESERVED',
];

/**
 * Admin page: jornada / recreos / day templates / bootstrap / clone / warnings.
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
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Horarios"
        title="Jornada y recreos"
        subtitle="Plantillas de día, política de recreos, bootstrap y validaciones."
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
        <!-- Year + recess policy -->
        <section class="card mb-6">
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
            </div>
            <div class="flex flex-wrap items-end gap-2 sm:col-span-4">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="!selectedYearUuid() || seeding()"
                (click)="seedDefaults()"
              >
                Sembrar recreos por defecto
              </button>
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

        <!-- Templates -->
        <section class="mb-8">
          <header class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 class="text-lg font-semibold text-content">Plantillas de día</h2>
              <p class="text-sm text-content-muted">
                Bloques no lectivos (recreo, almuerzo, asamblea) por nivel.
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
                  <input
                    id="tpl-shift"
                    class="input"
                    placeholder="MORNING"
                    [(ngModel)]="newTemplate.shift"
                  />
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
              description="Elegí el año académico para ver o editar las plantillas de jornada."
            />
          } @else if (templates().length === 0) {
            <app-empty-state
              icon="calendar"
              title="Sin plantillas"
              description="Creá una plantilla o usá «Sembrar recreos por defecto»."
            />
          } @else {
            <div class="space-y-4">
              @for (tpl of templates(); track tpl.publicUuid) {
                <article class="card">
                  <header
                    class="card-header flex flex-wrap items-center justify-between gap-2"
                  >
                    <div>
                      <h3 class="card-title text-base">
                        {{ tpl.name }}
                        <span class="ml-2 text-xs font-normal text-content-muted">
                          {{ tpl.levelCode
                          }}{{ tpl.gradeName ? ' · ' + tpl.gradeName : '' }}
                          {{ tpl.shift ? ' · ' + tpl.shift : '' }}
                        </span>
                      </h3>
                    </div>
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm text-danger"
                      (click)="deleteTemplate(tpl)"
                    >
                      Eliminar
                    </button>
                  </header>
                  <div class="card-body space-y-3">
                    <!-- Day plan wizard (ADR-SCH-12) -->
                    <div class="rounded-lg border border-border-subtle bg-surface-subtle/60 p-3">
                      <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 class="text-sm font-semibold text-content">Plan del día</h4>
                          <p class="text-xs text-content-muted">
                            Entrada, salida y hora académica. Los periodos se calculan solos; luego
                            asignás cursos en el horario de sección.
                          </p>
                        </div>
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          [disabled]="applyingPlan()[tpl.publicUuid]"
                          (click)="applyDayPlan(tpl)"
                        >
                          @if (applyingPlan()[tpl.publicUuid]) {
                            <app-spinner [size]="14" />
                          }
                          Aplicar plan
                        </button>
                      </header>
                      <div class="grid gap-2 sm:grid-cols-12">
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
                          <label class="label text-xs">Min. periodo</label>
                          <input
                            class="input input-sm"
                            type="number"
                            min="15"
                            max="120"
                            [(ngModel)]="dayPlanDrafts[tpl.publicUuid].periodMinutes"
                            (ngModelChange)="touchPlan(tpl.publicUuid)"
                          />
                        </div>
                        <div class="sm:col-span-3">
                          <label class="label text-xs">Recreo 1</label>
                          <div class="flex gap-1">
                            <input
                              class="input input-sm"
                              type="time"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].recessStart"
                              (ngModelChange)="touchPlan(tpl.publicUuid)"
                            />
                            <input
                              class="input input-sm"
                              type="time"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].recessEnd"
                              (ngModelChange)="touchPlan(tpl.publicUuid)"
                            />
                          </div>
                        </div>
                        <div class="sm:col-span-3">
                          <label class="label text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              class="checkbox checkbox-sm"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].includeLunch"
                              (ngModelChange)="touchPlan(tpl.publicUuid)"
                            />
                            Lonchera
                          </label>
                          <div class="flex gap-1">
                            <input
                              class="input input-sm"
                              type="time"
                              [disabled]="!dayPlanDrafts[tpl.publicUuid].includeLunch"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].lunchStart"
                              (ngModelChange)="touchPlan(tpl.publicUuid)"
                            />
                            <input
                              class="input input-sm"
                              type="time"
                              [disabled]="!dayPlanDrafts[tpl.publicUuid].includeLunch"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].lunchEnd"
                              (ngModelChange)="touchPlan(tpl.publicUuid)"
                            />
                          </div>
                        </div>
                        <div class="sm:col-span-4">
                          <label class="label text-xs flex items-center gap-2">
                            <input
                              type="checkbox"
                              class="checkbox checkbox-sm"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].includeSecondRecess"
                              (ngModelChange)="touchPlan(tpl.publicUuid)"
                            />
                            2.º recreo
                          </label>
                          <div class="flex gap-1">
                            <input
                              class="input input-sm"
                              type="time"
                              [disabled]="!dayPlanDrafts[tpl.publicUuid].includeSecondRecess"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].recess2Start"
                              (ngModelChange)="touchPlan(tpl.publicUuid)"
                            />
                            <input
                              class="input input-sm"
                              type="time"
                              [disabled]="!dayPlanDrafts[tpl.publicUuid].includeSecondRecess"
                              [(ngModel)]="dayPlanDrafts[tpl.publicUuid].recess2End"
                              (ngModelChange)="touchPlan(tpl.publicUuid)"
                            />
                          </div>
                        </div>
                      </div>
                      @if (planPreview(tpl.publicUuid); as preview) {
                        <ol class="mt-3 flex flex-wrap gap-1.5">
                          @for (item of preview; track item.startTime + '-' + item.endTime + '-' + item.label) {
                            <li
                              class="rounded px-2 py-1 text-[11px] font-medium"
                              [ngClass]="
                                item.kind === 'period'
                                  ? 'bg-primary/10 text-primary'
                                  : 'border border-dashed border-border-subtle text-content-muted'
                              "
                            >
                              <span>{{ item.label }}</span>
                              <span class="opacity-70">
                                {{ item.startTime }}-{{ item.endTime }}
                              </span>
                            </li>
                          }
                        </ol>
                      }
                    </div>

                    @if (tpl.blocks.length === 0) {
                      <p class="text-sm italic text-content-muted">Sin bloques todavía.</p>
                    } @else {
                      <ul class="divide-y divide-border-subtle rounded border border-border-subtle">
                        @for (b of tpl.blocks; track b.publicUuid) {
                          <li
                            class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                          >
                            <span>
                              <span class="font-medium">{{ b.label }}</span>
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
                    }

                    <!-- Add block form -->
                    <div class="grid gap-2 rounded bg-surface-subtle p-3 sm:grid-cols-12">
                      <div class="sm:col-span-2">
                        <label class="label text-xs">Tipo</label>
                        <select
                          class="select select-sm"
                          [(ngModel)]="blockDrafts[tpl.publicUuid].blockType"
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
                  </div>
                </article>
              }
            </div>
          }
        </section>

        <!-- Bootstrap -->
        <section class="card mb-6">
          <header class="card-header">
            <h2 class="card-title text-base">Bootstrap desde archivo</h2>
          </header>
          <div class="card-body space-y-3">
            <p class="text-sm text-content-muted">
              Subí un CSV/XLSX/PDF/imagen del horario del año anterior.
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
              <ul class="divide-y divide-border-subtle rounded border border-border-subtle text-sm">
                @for (doc of bootstrapDocs(); track doc.publicUuid) {
                  <li class="flex justify-between gap-2 px-3 py-2">
                    <span>{{ doc.originalFilename }}</span>
                    <span class="text-content-muted">{{ doc.parseStatus }}</span>
                  </li>
                }
              </ul>
            }
          </div>
        </section>

        <!-- Clone -->
        <section class="card mb-6">
          <header class="card-header">
            <h2 class="card-title text-base">Clonar horario desde otro año</h2>
          </header>
          <div class="card-body grid gap-3 sm:grid-cols-12">
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
                Incluir franjas (time slots)
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
        </section>

        <!-- Warnings -->
        <section class="card mb-6">
          <header class="card-header flex items-center justify-between">
            <h2 class="card-title text-base">Advertencias de validación</h2>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              [disabled]="!selectedYearUuid() || warningsLoading()"
              (click)="loadWarnings()"
            >
              Actualizar
            </button>
          </header>
          <div class="card-body">
            @if (warningsLoading()) {
              <app-spinner [size]="18" label="Cargando advertencias…" />
            } @else if (warnings().length === 0) {
              <p class="text-sm text-content-muted">Sin advertencias para este año.</p>
            } @else {
              <ul class="space-y-2">
                @for (w of warnings(); track (w.sectionUuid ?? '') + '|' + (w.gradeUuid ?? '') + '|' + (w.teacherUuid ?? '') + '|' + w.code + '|' + $index) {
                  <li
                    class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                  >
                    <span class="font-medium">[{{ w.severity }}] {{ w.code }}</span>
                    — {{ w.message }}
                  </li>
                }
              </ul>
            }
          </div>
        </section>
      }
    </app-page-container>
  `,
})
export class JornadaPageComponent implements OnInit {
  private readonly scheduleApi = inject(ScheduleApiService);
  private readonly academicApi = inject(AcademicApiService);

  protected readonly ROUTES = ROUTES;
  protected readonly formatTime = formatTime;
  protected readonly weekDays = DAYS_OF_WEEK.filter((d) => d.value <= 5);
  protected readonly blockTypes = BLOCK_TYPES;
  protected readonly policyOptions: { value: RecessPolicy; label: string }[] = [
    { value: 'SHARED', label: RECESS_POLICY_LABELS.SHARED },
    { value: 'STAGGERED', label: RECESS_POLICY_LABELS.STAGGERED },
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

  /** Per-template draft for adding a block (keyed by template uuid). */
  protected blockDrafts: Record<
    string,
    { blockType: DayBlockType; label: string; dayOfWeek: number | null; startTime: string; endTime: string }
  > = {};

  /** Per-template day-plan wizard drafts. */
  protected dayPlanDrafts: Record<
    string,
    {
      dayStart: string;
      dayEnd: string;
      periodMinutes: number;
      recessStart: string;
      recessEnd: string;
      includeSecondRecess: boolean;
      recess2Start: string;
      recess2End: string;
      includeLunch: boolean;
      lunchStart: string;
      lunchEnd: string;
    }
  > = {};

  protected readonly applyingPlan = signal<Record<string, boolean>>({});
  protected readonly planVersion = signal(0);

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

  protected blockTypeLabel(t: DayBlockType | string): string {
    return DAY_BLOCK_TYPE_LABELS[t as DayBlockType] ?? t;
  }

  protected dayLabel(day: number | null): string {
    if (day == null) return 'Todos (lun–vie)';
    return DAYS_OF_WEEK.find((d) => d.value === day)?.label ?? String(day);
  }

  protected async onYearChange(uuid: string): Promise<void> {
    this.selectedYearUuid.set(uuid);
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
      this.settingsMessage.set(`Se sembraron ${seeded.length} plantilla(s) por defecto.`);
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudieron sembrar los recreos.'));
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
    if (!confirm(`¿Eliminar la plantilla «${tpl.name}»?`)) return;
    try {
      await firstValueFrom(this.scheduleApi.deleteDayTemplate(tpl.publicUuid));
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
    this.planVersion.update((v) => v + 1);
  }

  protected touchPlan(_templateUuid: string): void {
    this.planVersion.update((v) => v + 1);
  }

  protected planPreview(templateUuid: string): DayPlanPreviewItem[] {
    void this.planVersion();
    const draft = this.dayPlanDrafts[templateUuid];
    if (!draft) return [];
    const hard: DayPlanHardInterval[] = [
      {
        startTime: draft.recessStart,
        endTime: draft.recessEnd,
        label: draft.includeSecondRecess ? 'Recreo 1' : 'Recreo',
        kind: 'recess',
      },
    ];
    if (draft.includeSecondRecess) {
      hard.push({
        startTime: draft.recess2Start,
        endTime: draft.recess2End,
        label: 'Recreo 2',
        kind: 'recess',
      });
    }
    if (draft.includeLunch) {
      hard.push({
        startTime: draft.lunchStart,
        endTime: draft.lunchEnd,
        label: 'Lonchera',
        kind: 'lunch',
      });
    }
    return computeDayPlanPreview(
      draft.dayStart,
      draft.dayEnd,
      Number(draft.periodMinutes) || 45,
      hard,
    );
  }

  protected async applyDayPlan(tpl: DayTemplate): Promise<void> {
    const draft = this.dayPlanDrafts[tpl.publicUuid];
    if (!draft) return;
    if (
      !confirm(
        `¿Aplicar el plan del día a «${tpl.name}»? Se regenerarán recreo/lonchera (otros bloques se conservan).`,
      )
    ) {
      return;
    }
    this.applyingPlan.update((m) => ({ ...m, [tpl.publicUuid]: true }));
    this.pageError.set(null);
    try {
      const recesses: { startTime: string; endTime: string; label: string }[] = [
        {
          startTime: this.normalizeTime(draft.recessStart),
          endTime: this.normalizeTime(draft.recessEnd),
          label: draft.includeSecondRecess ? 'Recreo 1' : 'Recreo',
        },
      ];
      if (draft.includeSecondRecess) {
        recesses.push({
          startTime: this.normalizeTime(draft.recess2Start),
          endTime: this.normalizeTime(draft.recess2End),
          label: 'Recreo 2',
        });
      }
      const lunch = draft.includeLunch
        ? {
            startTime: this.normalizeTime(draft.lunchStart),
            endTime: this.normalizeTime(draft.lunchEnd),
            label: 'Lonchera',
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
      this.settingsMessage.set(`Plan del día aplicado a «${tpl.name}».`);
      await this.reloadTemplates();
    } catch (err: unknown) {
      this.pageError.set(this.errMsg(err, 'No se pudo aplicar el plan del día.'));
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
    const recess1 = recessBlocks[0];
    const recess2 = recessBlocks[1];
    const lunch = tpl.blocks.find((b) => b.blockType === 'LUNCH');
    this.dayPlanDrafts[tpl.publicUuid] = {
      dayStart: this.toInputTime(tpl.dayStart) || defaults.dayStart,
      dayEnd: this.toInputTime(tpl.dayEnd) || defaults.dayEnd,
      periodMinutes: tpl.periodMinutes ?? defaults.periodMinutes,
      recessStart: this.toInputTime(recess1?.startTime) || defaults.recessStart,
      recessEnd: this.toInputTime(recess1?.endTime) || defaults.recessEnd,
      includeSecondRecess: recessBlocks.length >= 2,
      recess2Start:
        this.toInputTime(recess2?.startTime) || defaults.recess2Start || '14:00',
      recess2End: this.toInputTime(recess2?.endTime) || defaults.recess2End || '14:15',
      includeLunch: !!lunch,
      lunchStart: this.toInputTime(lunch?.startTime) || defaults.lunchStart,
      lunchEnd: this.toInputTime(lunch?.endTime) || defaults.lunchEnd,
    };
  }

  private toInputTime(value: string | null | undefined): string {
    if (!value) return '';
    const parts = value.split(':');
    return `${parts[0]?.padStart(2, '0') ?? '08'}:${parts[1]?.padStart(2, '0') ?? '00'}`;
  }

  private ensureBlockDraft(templateUuid: string): void {
    this.blockDrafts[templateUuid] = {
      blockType: 'RECESS',
      label: 'Recreo',
      dayOfWeek: null,
      startTime: '10:00',
      endTime: '10:20',
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

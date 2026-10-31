import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ScheduleGridComponent } from '@features/academic/components/schedule-grid.component';
import { NonTeachingBlockItem, ScheduleSlotItem } from '@features/academic/models';
import { resolveCourseVisual } from '@features/academic/utils/course-visual.util';
import { MeAttendanceRecord } from '../../models/me-attendance.model';
import { MeMaterialItem, MeSectionPeriod } from '../../models/me-section.model';
import { MeApiService } from '../../services/me-api.service';
import { FileUploadService } from '@core/services/file-upload.service';

type ScheduleViewMode = 'week' | 'day';
type NextClassState = 'current' | 'next' | 'scheduled';

interface LimaClock {
  readonly dayOfWeek: number;
  readonly minutes: number;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly dateLabels: Readonly<Record<number, string>>;
}

interface NextClass {
  readonly slot: ScheduleSlotItem;
  readonly state: NextClassState;
}

interface CourseLegendItem {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

const DAY_NUMBER_BY_SHORT_NAME: Readonly<Record<string, number>> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function getLimaClock(now = new Date()): LimaClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const partValue = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  const todayDay = DAY_NUMBER_BY_SHORT_NAME[partValue('weekday')] ?? 1;
  const year = Number(partValue('year'));
  const month = Number(partValue('month'));
  const day = Number(partValue('day'));
  const todayUtc = Date.UTC(year, month - 1, day);
  const mondayUtc = todayUtc - (todayDay - 1) * 24 * 60 * 60 * 1000;
  const dateLabels: Record<number, string> = {};
  const dateFormatter = new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  for (let weekday = 1; weekday <= 7; weekday += 1) {
    dateLabels[weekday] = dateFormatter.format(new Date(mondayUtc + (weekday - 1) * 86400000));
  }
  const dateKey = (offset: number): string =>
    new Date(mondayUtc + offset * 86400000).toISOString().slice(0, 10);
  return {
    dayOfWeek: todayDay,
    minutes: Number(partValue('hour')) * 60 + Number(partValue('minute')),
    weekStart: dateKey(0),
    weekEnd: dateKey(6),
    dateLabels,
  };
}

function timeInMinutes(value: string): number {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

@Component({
  selector: 'app-me-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ScheduleGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      <div class="student-schedule-screen-only flex flex-wrap items-center justify-between gap-3">
        <a
          routerLink="/me/profile"
          class="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300"
        >
          <span aria-hidden="true">←</span>
          Volver a Mi perfil
        </a>
        <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          @if (sectionContext()) {
            <span
              class="rounded-full bg-blue-100 px-3 py-1.5 font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-200"
            >
              {{ sectionContext() }}
            </span>
          }
          <span class="text-slate-400" aria-hidden="true">•</span>
          <span class="text-slate-600 dark:text-slate-300">Horario escolar</span>
        </div>
      </div>

      <header
        class="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7"
      >
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div class="max-w-2xl">
            <p
              class="text-xs font-bold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300"
            >
              Mi espacio académico
            </p>
            <h1
              class="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl"
            >
              Mi horario
            </h1>
            <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              Consulta tus clases, docentes y espacios de aprendizaje de la semana.
            </p>
          </div>
          <div class="student-schedule-screen-only flex flex-wrap items-end gap-3">
            @if (periods().length > 0) {
              <label
                class="flex min-w-52 flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                <span>Periodo escolar</span>
                <select
                  class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  [ngModel]="selectedPeriodUuid() ?? ''"
                  (ngModelChange)="onPeriodChange($event)"
                  aria-label="Periodo escolar del horario"
                >
                  @for (period of periods(); track period.publicUuid) {
                    <option [value]="period.publicUuid">
                      {{ period.name }}{{ period.current ? ' · Vigente' : '' }}
                    </option>
                  }
                </select>
              </label>
            }
            <button
              type="button"
              class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
              (click)="printSchedule()"
            >
              <span aria-hidden="true">⤓</span>
              Imprimir / PDF A4
            </button>
          </div>
        </div>

        <div
          class="student-schedule-screen-only mt-6 flex flex-col gap-3 rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div
            class="inline-flex w-fit rounded-xl bg-white p-1 shadow-sm dark:bg-slate-900"
            role="tablist"
            aria-label="Vista del horario"
          >
            <button
              type="button"
              role="tab"
              class="rounded-lg px-4 py-2 text-sm font-semibold transition"
              [class.bg-blue-700]="viewMode() === 'week'"
              [class.text-white]="viewMode() === 'week'"
              [class.text-slate-600]="viewMode() !== 'week'"
              [attr.aria-selected]="viewMode() === 'week'"
              (click)="setViewMode('week')"
            >
              Vista semanal
            </button>
            <button
              type="button"
              role="tab"
              class="rounded-lg px-4 py-2 text-sm font-semibold transition"
              [class.bg-blue-700]="viewMode() === 'day'"
              [class.text-white]="viewMode() === 'day'"
              [class.text-slate-600]="viewMode() !== 'day'"
              [attr.aria-selected]="viewMode() === 'day'"
              (click)="setViewMode('day')"
            >
              Día de hoy
            </button>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Ir al día</span>
            <div class="flex max-w-full gap-1 overflow-x-auto" aria-label="Seleccionar día">
              @for (day of weekdays; track day.value) {
                <button
                  type="button"
                  class="rounded-lg px-2.5 py-2 text-xs font-semibold transition sm:px-3"
                  [class.bg-white]="selectedDay() === day.value"
                  [class.text-blue-800]="selectedDay() === day.value"
                  [class.shadow-sm]="selectedDay() === day.value"
                  [class.text-slate-600]="selectedDay() !== day.value"
                  [attr.aria-pressed]="selectedDay() === day.value"
                  (click)="selectDay(day.value)"
                >
                  {{ day.short }}
                  <span class="hidden sm:inline">{{ dateLabels()[day.value] }}</span>
                </button>
              }
            </div>
          </div>
          @if (scheduleLoading()) {
            <span class="text-xs font-medium text-blue-700 dark:text-blue-300" role="status">
              Actualizando horario…
            </span>
          }
        </div>
      </header>

      @if (error()) {
        <div
          class="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
          role="alert"
        >
          <p>{{ error() }}</p>
          <button
            type="button"
            class="mt-2 font-semibold underline"
            (click)="loadSchedule(selectedPeriodUuid())"
          >
            Reintentar
          </button>
        </div>
      }

      @if (loading()) {
        <div
          class="mt-5 h-[26rem] animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800"
          aria-label="Cargando horario"
        ></div>
      } @else {
        <div class="mt-5 space-y-4">
          <div class="min-w-0 space-y-4">
            <article
              class="grid gap-4 rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-100 via-indigo-50 to-white p-4 dark:border-blue-900 dark:from-blue-950/80 dark:via-slate-900 dark:to-slate-900 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] sm:items-center sm:p-5"
            >
              <div>
                <p
                  class="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300"
                >
                  {{
                    nextClass()?.state === 'current'
                      ? 'En curso ahora'
                      : nextClass()
                        ? 'Próxima clase'
                        : 'Resumen del día'
                  }}
                </p>
                @if (nextClass(); as lesson) {
                  <div class="mt-2 flex items-center gap-3">
                    <span
                      class="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-blue-700 text-white shadow-sm"
                    >
                      <span class="text-[10px] font-bold uppercase">{{ selectedDayName() }}</span>
                      <span class="text-xl font-bold">{{ dateDayNumber() }}</span>
                    </span>
                    <div class="min-w-0">
                      <h2 class="truncate text-xl font-bold text-slate-950 dark:text-white">
                        {{ lesson.slot.course.name }}
                      </h2>
                      <p class="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                        {{ formatSlotTime(lesson.slot) }}
                        @if (lesson.slot.teacher; as teacher) {
                          · {{ teacher.firstName }} {{ teacher.lastName }}
                        }
                      </p>
                      @if (lesson.slot.classroom) {
                        <p class="text-xs text-slate-500 dark:text-slate-400">
                          {{ lesson.slot.classroom }}
                        </p>
                      }
                    </div>
                  </div>
                } @else {
                  <h2 class="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                    {{
                      selectedDay() === clock().dayOfWeek
                        ? 'No tienes más clases hoy'
                        : 'No hay clases programadas este día'
                    }}
                  </h2>
                  <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Puedes consultar el horario de otro día usando los accesos de arriba.
                  </p>
                }
              </div>
              <div
                class="rounded-2xl border border-white/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/70"
              >
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                >
                  {{ selectedDayName() }}
                </p>
                <p class="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                  {{ selectedDateLabel() }}
                </p>
                <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {{ daySlots().length }}
                  {{ daySlots().length === 1 ? 'clase programada' : 'clases programadas' }}
                </p>
              </div>
            </article>

            <section
              class="student-schedule-print-area rounded-3xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-4"
              aria-label="Horario semanal"
            >
              <div class="student-schedule-print-heading mb-3 hidden">
                <p class="text-xs font-bold uppercase tracking-wide">
                  Horario escolar · {{ periodName() }}
                </p>
                <h2 class="mt-1 text-2xl font-bold">{{ sectionContext() || 'Mi horario' }}</h2>
                <p class="text-sm">Semana del {{ dateLabels()[1] }} al {{ dateLabels()[7] }}</p>
              </div>
              <div
                class="student-schedule-screen-only mb-3 flex flex-wrap items-center justify-between gap-2 px-1"
              >
                <div>
                  <p
                    class="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300"
                  >
                    Horario escolar oficial
                  </p>
                  <h2 class="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                    {{ viewMode() === 'week' ? 'Semana completa' : selectedDayName() }}
                  </h2>
                </div>
                <span
                  class="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >{{ periodName() }}</span
                >
              </div>
              <app-schedule-grid
                [slots]="slots()"
                [nonTeachingBlocks]="nonTeachingBlocks()"
                [showSectionView]="true"
                [showTeacherView]="true"
                [focusDay]="viewMode() === 'day' ? selectedDay() : null"
                [dayDateLabels]="dateLabels()"
                emptyTitle="No hay clases programadas para este día"
              />
            </section>
          </div>

          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <section
              class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              aria-labelledby="materials-title"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p
                    class="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300"
                  >
                    Acompañamiento
                  </p>
                  <h2
                    id="materials-title"
                    class="mt-1 text-lg font-bold text-slate-950 dark:text-white"
                  >
                    Material para la clase
                  </h2>
                </div>
                <span class="text-xl text-blue-700 dark:text-blue-300" aria-hidden="true">▤</span>
              </div>
              @if (materialLoading()) {
                <div
                  class="mt-4 h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                  aria-label="Cargando materiales"
                ></div>
              } @else if (materials().length) {
                <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {{ materialCourseName() }} · recursos publicados
                </p>
                <ul class="mt-3 space-y-2">
                  @for (material of materials().slice(0, 4); track material.publicUuid) {
                    <li
                      class="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
                    >
                      @if (material.externalUrl; as externalUrl) {
                        <a
                          class="min-w-0 truncate text-sm font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
                          [href]="externalUrl"
                          target="_blank"
                          rel="noopener noreferrer"
                          >{{ material.title }}</a
                        >
                      } @else {
                        <span
                          class="min-w-0 truncate text-sm font-medium text-slate-800 dark:text-slate-100"
                          >{{ material.title }}</span
                        >
                      }
                      @if (material.filePublicUuid) {
                        <button
                          type="button"
                          class="shrink-0 rounded-lg p-2 text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-950"
                          [disabled]="downloadingMaterial() === material.publicUuid"
                          [attr.aria-label]="'Descargar ' + material.title"
                          (click)="downloadMaterial(material)"
                        >
                          {{ downloadingMaterial() === material.publicUuid ? '…' : '↓' }}
                        </button>
                      }
                    </li>
                  }
                </ul>
                <a
                  routerLink="/me/courses"
                  class="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
                  >Ver todos los materiales →</a
                >
              } @else {
                <p
                  class="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {{
                    nextClass()
                      ? 'Aún no hay materiales publicados para esta materia.'
                      : 'Cuando tengas una próxima clase, aquí aparecerán sus materiales publicados.'
                  }}
                </p>
              }
            </section>

            <section
              class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              aria-labelledby="attendance-title"
            >
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p
                    class="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"
                  >
                    Semana en curso
                  </p>
                  <h2
                    id="attendance-title"
                    class="mt-1 text-lg font-bold text-slate-950 dark:text-white"
                  >
                    Puntualidad y asistencia
                  </h2>
                </div>
                <span class="text-xl text-blue-700 dark:text-blue-300" aria-hidden="true">◷</span>
              </div>
              @if (attendanceLoading()) {
                <div
                  class="mt-4 h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                  aria-label="Cargando asistencia"
                ></div>
              } @else if (attendanceRecords().length) {
                <div class="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <div class="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40">
                    <p class="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                      {{ attendanceCount('PRESENT') }}
                    </p>
                    <p class="text-[11px] text-emerald-800 dark:text-emerald-300">Presentes</p>
                  </div>
                  <div class="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40">
                    <p class="text-xl font-bold text-amber-800 dark:text-amber-300">
                      {{ attendanceCount('LATE') }}
                    </p>
                    <p class="text-[11px] text-amber-800 dark:text-amber-300">Tardanzas</p>
                  </div>
                  <div class="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/40">
                    <p class="text-xl font-bold text-rose-800 dark:text-rose-300">
                      {{ attendanceCount('ABSENT') }}
                    </p>
                    <p class="text-[11px] text-rose-800 dark:text-rose-300">Faltas</p>
                  </div>
                  <div class="rounded-xl bg-sky-50 p-3 dark:bg-sky-950/40">
                    <p class="text-xl font-bold text-sky-800 dark:text-sky-300">
                      {{ attendanceCount('EXCUSED') }}
                    </p>
                    <p class="text-[11px] text-sky-800 dark:text-sky-300">Justificadas</p>
                  </div>
                </div>
                <p class="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  Resumen de los registros de esta semana. Los horarios de ingreso dependen de las
                  reglas del colegio.
                </p>
              } @else {
                <p
                  class="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  Aún no hay registros de asistencia para esta semana.
                </p>
              }
              <a
                routerLink="/me/attendance"
                class="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
                >Consultar mi asistencia →</a
              >
            </section>

            @if (courseLegend().length) {
              <section
                class="student-schedule-screen-only rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                aria-labelledby="legend-title"
              >
                <h2 id="legend-title" class="text-base font-bold text-slate-950 dark:text-white">
                  Leyenda por materias
                </h2>
                <ul class="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  @for (item of courseLegend(); track item.id) {
                    <li
                      class="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      <span
                        class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10"
                        [style.backgroundColor]="item.color"
                        aria-hidden="true"
                      ></span>
                      <span class="truncate">{{ item.name }}</span>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class MeSchedulePageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly files = inject(FileUploadService);
  private readonly destroyRef = inject(DestroyRef);
  private scheduleRequestId = 0;
  private materialRequestId = 0;
  private materialLookupKey: string | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private followToday = true;

  readonly weekdays = [
    { value: 1, short: 'Lun', name: 'Lunes' },
    { value: 2, short: 'Mar', name: 'Martes' },
    { value: 3, short: 'Mié', name: 'Miércoles' },
    { value: 4, short: 'Jue', name: 'Jueves' },
    { value: 5, short: 'Vie', name: 'Viernes' },
  ] as const;
  readonly slots = signal<ScheduleSlotItem[]>([]);
  readonly nonTeachingBlocks = signal<NonTeachingBlockItem[]>([]);
  readonly periods = signal<MeSectionPeriod[]>([]);
  readonly selectedPeriodUuid = signal<string | null>(null);
  readonly selectedDay = signal(getLimaClock().dayOfWeek);
  readonly viewMode = signal<ScheduleViewMode>('week');
  readonly clock = signal(getLimaClock());
  readonly loading = signal(true);
  readonly scheduleLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly attendanceRecords = signal<MeAttendanceRecord[]>([]);
  readonly attendanceLoading = signal(true);
  readonly materials = signal<MeMaterialItem[]>([]);
  readonly materialCourseName = signal('');
  readonly materialLoading = signal(false);
  readonly downloadingMaterial = signal<string | null>(null);

  readonly dateLabels = computed(() => this.clock().dateLabels);
  readonly daySlots = computed(() =>
    this.slots()
      .filter((slot) => slot.dayOfWeek === this.selectedDay())
      .sort((left, right) => left.startTime.localeCompare(right.startTime)),
  );
  readonly nextClass = computed<NextClass | null>(() => {
    const daySlots = this.daySlots();
    const clock = this.clock();
    if (!daySlots.length) return null;
    if (this.selectedDay() !== clock.dayOfWeek) {
      return { slot: daySlots[0], state: 'scheduled' };
    }
    const current = daySlots.find(
      (slot) =>
        timeInMinutes(slot.startTime) <= clock.minutes &&
        clock.minutes < timeInMinutes(slot.endTime),
    );
    if (current) return { slot: current, state: 'current' };
    const upcoming = daySlots.find((slot) => timeInMinutes(slot.startTime) > clock.minutes);
    return upcoming ? { slot: upcoming, state: 'next' } : null;
  });
  readonly periodName = computed(
    () =>
      this.periods().find((period) => period.publicUuid === this.selectedPeriodUuid())?.name ??
      this.slots()[0]?.period?.name ??
      'Periodo escolar',
  );
  readonly sectionContext = computed(() => {
    const section = this.slots()[0]?.section;
    if (!section) return '';
    return [section.gradeName, section.name].filter(Boolean).join(' · ');
  });
  readonly courseLegend = computed<CourseLegendItem[]>(() => {
    const uniqueCourses = new Map<string, CourseLegendItem>();
    for (const slot of this.slots()) {
      if (uniqueCourses.has(slot.course.publicUuid)) continue;
      const visual = resolveCourseVisual(slot.course.code, slot.course.color, slot.course.icon);
      uniqueCourses.set(slot.course.publicUuid, {
        id: slot.course.publicUuid,
        name: slot.course.name,
        color: visual.color,
      });
    }
    return [...uniqueCourses.values()].sort((left, right) =>
      left.name.localeCompare(right.name, 'es'),
    );
  });

  ngOnInit(): void {
    this.load();
    this.loadAttendance();
    this.clockTimer = setInterval(() => {
      const previousWeek = this.clock().weekStart;
      const clock = getLimaClock();
      this.clock.set(clock);
      if (this.followToday) this.selectedDay.set(clock.dayOfWeek);
      this.refreshMaterialsForNextClass();
      if (clock.weekStart !== previousWeek) this.loadAttendance();
    }, 60_000);
    this.destroyRef.onDestroy(() => {
      if (this.clockTimer) clearInterval(this.clockTimer);
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listSectionPeriods()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const periods = response.data ?? [];
          this.periods.set(periods);
          const selected = periods.find((period) => period.current) ?? periods[0] ?? null;
          this.selectedPeriodUuid.set(selected?.publicUuid ?? null);
          this.loadSchedule(selected?.publicUuid ?? null);
        },
        error: () => {
          this.periods.set([]);
          this.loadSchedule(null);
        },
      });
  }

  loadSchedule(periodPublicUuid: string | null): void {
    const requestId = ++this.scheduleRequestId;
    this.materialRequestId += 1;
    this.materialLookupKey = null;
    this.materials.set([]);
    this.materialLoading.set(false);
    this.scheduleLoading.set(true);
    this.error.set(null);
    this.api
      .listSchedule(periodPublicUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.scheduleRequestId) return;
          const view = response.data;
          this.slots.set(view?.slots ?? []);
          this.nonTeachingBlocks.set(view?.nonTeachingBlocks ?? []);
          this.scheduleLoading.set(false);
          this.loading.set(false);
          this.materialLookupKey = null;
          this.refreshMaterialsForNextClass();
        },
        error: () => {
          if (requestId !== this.scheduleRequestId) return;
          this.error.set('No se pudo cargar tu horario. Intenta nuevamente.');
          this.scheduleLoading.set(false);
          this.loading.set(false);
          this.slots.set([]);
          this.nonTeachingBlocks.set([]);
          this.materials.set([]);
        },
      });
  }

  onPeriodChange(periodPublicUuid: string): void {
    const period = this.periods().find((item) => item.publicUuid === periodPublicUuid);
    this.selectedPeriodUuid.set(period?.publicUuid ?? null);
    this.loadSchedule(period?.publicUuid ?? null);
  }

  setViewMode(mode: ScheduleViewMode): void {
    this.viewMode.set(mode);
    if (mode === 'day') {
      this.followToday = true;
      this.selectedDay.set(this.clock().dayOfWeek);
      this.refreshMaterialsForNextClass();
    }
  }

  selectDay(day: number): void {
    this.followToday = false;
    this.selectedDay.set(day);
    this.refreshMaterialsForNextClass();
  }

  printSchedule(): void {
    document.body.classList.add('student-schedule-printing');
    const cleanup = (): void => document.body.classList.remove('student-schedule-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  }

  selectedDayName(): string {
    return this.weekdays.find((day) => day.value === this.selectedDay())?.name ?? 'Domingo';
  }

  selectedDateLabel(): string {
    const date = this.dateLabels()[this.selectedDay()] ?? '';
    return `${this.selectedDayName()}, ${date}`;
  }

  dateDayNumber(): string {
    const date = this.dateLabels()[this.selectedDay()] ?? '';
    return date.match(/^\d+/)?.[0] ?? '';
  }

  formatSlotTime(slot: ScheduleSlotItem): string {
    return `${formatTime(slot.startTime)} – ${formatTime(slot.endTime)}`;
  }

  attendanceCount(status: MeAttendanceRecord['status']): number {
    return this.attendanceRecords().filter((record) => record.status === status).length;
  }

  async downloadMaterial(material: MeMaterialItem): Promise<void> {
    if (!material.filePublicUuid) return;
    this.downloadingMaterial.set(material.publicUuid);
    try {
      await this.files.downloadAndSave(
        material.filePublicUuid,
        material.filename || material.title || 'material',
      );
    } catch {
      // The global HTTP interceptor reports file download errors.
    } finally {
      this.downloadingMaterial.set(null);
    }
  }

  private loadAttendance(): void {
    const clock = this.clock();
    this.attendanceLoading.set(true);
    this.api
      .listAttendance({ from: clock.weekStart, to: clock.weekEnd })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.attendanceRecords.set(response.data ?? []);
          this.attendanceLoading.set(false);
        },
        error: () => {
          this.attendanceRecords.set([]);
          this.attendanceLoading.set(false);
        },
      });
  }

  private refreshMaterialsForNextClass(): void {
    const lesson = this.nextClass()?.slot;
    const sectionUuid = lesson?.section?.publicUuid;
    if (!lesson || !sectionUuid) {
      this.materialLookupKey = null;
      this.materials.set([]);
      this.materialCourseName.set(lesson?.course.name ?? '');
      this.materialLoading.set(false);
      return;
    }
    const lookupKey = `${sectionUuid}:${lesson.assignmentPublicUuid}`;
    if (lookupKey === this.materialLookupKey) return;
    this.materialLookupKey = lookupKey;
    const requestId = ++this.materialRequestId;
    this.materials.set([]);
    this.materialCourseName.set(lesson.course.name);
    this.materialLoading.set(true);
    this.api
      .getSection(sectionUuid, lesson.assignmentPublicUuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.materialRequestId) return;
          this.materials.set([...(response.data?.materials ?? [])]);
          this.materialLoading.set(false);
        },
        error: () => {
          if (requestId !== this.materialRequestId) return;
          this.materials.set([]);
          this.materialLoading.set(false);
        },
      });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Permission } from '@core/enums';
import { AuthService } from '@core/services';
import { FileMetadata } from '@core/services/file-upload.service';
import { IconComponent } from '@shared/components';
import { FileUploadComponent } from '@shared/components/file-upload/file-upload.component';
import { AttendanceExportActionsComponent } from '@features/attendance/components';
import { AttendancePrintService } from '@features/attendance/services/attendance-print.service';
import { AttendanceReportService } from '@features/attendance/services/attendance-report.service';
import { simpleRowsToPrintRows } from '@features/attendance/utils/attendance-print.helpers';
import { monthRange } from '@features/attendance/models/attendance-report-params.model';
import { ReportFormat } from '@features/reports/models/report.model';
import { MeAttendanceRecord, MeAttendanceStatus } from '../../models/me-attendance.model';
import { MeApiService } from '../../services/me-api.service';
import {
  MeAttendanceCalendarCell,
  MeAttendanceView,
  attendanceMonthLabel,
  buildMonthCells,
  canSubmitJustification,
  formatDayTitle,
  formatRate,
  groupAttendanceByDay,
  justificationLabel,
  localDateKey,
  sortByOccurredAt,
  statusBadgeClass,
  statusLabel,
  summarizeMeAttendance,
} from './me-attendance.logic';

@Component({
  selector: 'app-me-attendance',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    IconComponent,
    FileUploadComponent,
    AttendanceExportActionsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a
        routerLink="/me/profile"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mi perfil</span>
      </a>

      <header class="mt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
          <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mi asistencia</h1>
          <p class="mt-2 max-w-xl text-slate-600 dark:text-slate-400">
            Resumen del periodo, calendario por día y detalle de cada sesión. Puedes justificar una
            falta o tardanza con un motivo y un adjunto.
          </p>
          <div
            class="mt-4 inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
            role="tablist"
            aria-label="Vista de asistencia"
          >
            @for (tab of tabs; track tab.id) {
              <button
                type="button"
                role="tab"
                class="rounded-lg px-3 py-1.5 text-sm font-semibold"
                [attr.aria-selected]="view() === tab.id"
                [class]="tabClass(tab.id)"
                (click)="setView(tab.id)"
              >
                {{ tab.label }}
              </button>
            }
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          @if (!loading() && records().length) {
            <app-attendance-export-actions
              [busy]="exportBusy()"
              (printClick)="onPrint()"
              (downloadClick)="onDownload($event)"
            />
          }
          @if (showJustifyAction() && records().length) {
            <button
              type="button"
              class="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
              [disabled]="!canJustifyAny()"
              [attr.title]="
                canJustifyAny() ? null : 'No hay faltas ni tardanzas pendientes de justificar'
              "
              (click)="openNewJustification()"
            >
              Nueva justificación
            </button>
          }
        </div>
      </header>

      @if (loading()) {
        <div class="mt-8 space-y-3" aria-label="Cargando asistencia">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div
          class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700"
          role="alert"
        >
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (records().length === 0) {
        <div class="mt-6 max-w-sm">
          <ng-container *ngTemplateOutlet="periodCard" />
        </div>
        <div
          class="mt-4 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Sin registros</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Cuando el colegio tome asistencia en este periodo, verás el calendario y el resumen
            aquí.
          </p>
        </div>
      } @else {
        <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article
            class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Tasa del periodo
            </p>
            <p class="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {{ formatRate(summary().ratePercent ?? 0) }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              Presentes, excusadas y justificaciones aprobadas
            </p>
          </article>
          <article
            class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Sesiones asistidas
            </p>
            <p class="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {{ summary().attended }}
            </p>
            <p class="mt-1 text-xs text-slate-500">Presentes y tardanzas</p>
          </article>
          <article
            class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Tardanzas
            </p>
            <p class="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {{ summary().late }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              @if (summary().latePending || summary().lateToRegularize) {
                {{ summary().latePending }} en revisión · {{ summary().lateToRegularize }} sin
                justificación
              } @else {
                Sesiones con llegada tarde
              }
            </p>
          </article>
          <article
            class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Inasistencias
            </p>
            <p class="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
              {{ summary().absences }}
            </p>
            <p class="mt-1 text-xs text-slate-500">
              {{ summary().justifiedAbsences }} justificadas ·
              {{ summary().pendingAbsences }} pendientes · {{ summary().absencesToRegularize }} por
              regularizar
              @if (summary().rejectedAbsences) {
                · {{ summary().rejectedAbsences }} rechazadas
              }
            </p>
          </article>
          <ng-container *ngTemplateOutlet="periodCard" />
        </div>

        @if (view() === 'calendar') {
          <div
            class="mt-6 grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(16rem,22rem)]"
          >
            <div
              class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div class="flex items-center gap-2">
                <app-icon name="calendar" [size]="18" />
                <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Calendario del periodo
                </h2>
              </div>
              <p class="mt-1 text-sm text-slate-500">
                Cada día resume las sesiones de clase. El color es el estado más grave de ese día.
              </p>
              <div class="mt-4 grid grid-cols-7 gap-1">
                @for (label of weekdayLabels; track label) {
                  <div
                    class="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {{ label }}
                  </div>
                }
                @for (cell of monthCells(); track cell.dateKey) {
                  @if (dayGroup(cell); as group) {
                    <button
                      type="button"
                      [class]="dayButtonClass(group.worst, selectedDayKey() === cell.dateKey)"
                      [attr.aria-pressed]="selectedDayKey() === cell.dateKey"
                      [attr.aria-label]="dayAriaLabel(cell, group.records.length, group.worst)"
                      (click)="selectDay(cell.dateKey)"
                    >
                      <span class="text-xs font-semibold">{{ cell.day }}</span>
                      <span class="mt-auto truncate text-[10px] font-semibold">
                        @if (group.records.length > 1) {
                          {{ group.records.length }} ·
                        }
                        {{ statusLabel(group.worst) }}
                      </span>
                    </button>
                  } @else {
                    <div
                      class="flex h-[4.5rem] flex-col rounded-xl px-1.5 py-1 text-slate-300 dark:text-slate-600"
                    >
                      <span class="text-xs">{{ cell.day }}</span>
                      @if (cell.dateKey === todayKey && cell.inMonth) {
                        <span class="mt-auto text-[10px] font-semibold text-indigo-500">Hoy</span>
                      }
                    </div>
                  }
                }
              </div>
              <ng-container *ngTemplateOutlet="legend" />
            </div>
            <aside
              class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <ng-container *ngTemplateOutlet="dayPanel" />
            </aside>
          </div>
        } @else {
          <div
            class="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <p class="px-4 pt-4 text-sm text-slate-500">Selecciona una fila para ver el detalle.</p>
            <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead class="bg-slate-50 dark:bg-slate-950/40">
                <tr>
                  <th
                    class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Fecha
                  </th>
                  <th
                    class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Estado
                  </th>
                  <th
                    class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Justificación
                  </th>
                  <th
                    class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (record of sortedRecords(); track record.publicUuid) {
                  <tr
                    tabindex="0"
                    [class]="rowClass(record)"
                    (click)="selectRecord(record)"
                    (keydown.enter)="selectRecord(record)"
                  >
                    <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {{ record.occurredAt | date: 'dd/MM/yyyy HH:mm' }}
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                        [class]="statusClass(record.status)"
                      >
                        {{ statusLabel(record.status) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {{ justificationLabel(record.justificationStatus) }}
                    </td>
                    <td class="px-4 py-3">
                      @if (canJustify(record)) {
                        <button
                          type="button"
                          class="text-sm font-semibold text-indigo-600"
                          (click)="$event.stopPropagation(); openJustify(record)"
                        >
                          Justificar
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (selectedRecord(); as record) {
            <div
              class="mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <ng-container *ngTemplateOutlet="sessionCard; context: { $implicit: record }" />
            </div>
          }
          <ng-container *ngTemplateOutlet="legend" />
        }
      }

      @if (!loading() && !error()) {
        <aside
          class="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-slate-800"
        >
          <p class="font-semibold text-slate-800 dark:text-slate-100">Avisos de asistencia</p>
          <p class="mt-1">
            Una falta o tardanza se puede justificar mientras no tenga una solicitud. Queda
            pendiente hasta que el docente o la coordinación la apruebe o la rechace. Si la
            rechazan, no se puede enviar otra sobre el mismo registro.
          </p>
        </aside>
      }

      <ng-template #periodCard>
        <article
          class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Periodo</p>
          <div class="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              class="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Mes anterior"
              (click)="shiftMonth(-1)"
            >
              <app-icon name="chevron-left" [size]="18" />
            </button>
            <p class="text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ periodLabel() }}
            </p>
            <button
              type="button"
              class="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Mes siguiente"
              (click)="shiftMonth(1)"
            >
              <app-icon name="chevron-right" [size]="18" />
            </button>
          </div>
        </article>
      </ng-template>

      <ng-template #dayPanel>
        @if (selectedDayKey(); as dayKey) {
          <p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Día seleccionado
          </p>
          <h2 class="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {{ formatDayTitle(dayKey) }}
          </h2>
          <p class="mt-1 text-sm text-slate-500">{{ sessionCountLabel(panelRecords().length) }}</p>
          <div class="mt-4 space-y-3">
            @for (record of panelRecords(); track record.publicUuid) {
              <ng-container *ngTemplateOutlet="sessionCard; context: { $implicit: record }" />
            }
          </div>
        } @else {
          <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
            Detalle del día
          </h2>
          <p class="mt-2 text-sm text-slate-500">
            Elige un día con clases para ver cada sesión y su justificación.
          </p>
        }
      </ng-template>

      <ng-template #sessionCard let-record>
        <article class="rounded-xl p-3 ring-1 ring-slate-200 dark:ring-slate-700">
          <div class="flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {{ record.occurredAt | date: 'HH:mm' }}
            </p>
            <span
              class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
              [class]="statusClass(record.status)"
            >
              {{ statusLabel(record.status) }}
            </span>
          </div>
          @if (record.notes) {
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ record.notes }}</p>
          }
          <p class="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Justificación
          </p>
          <p class="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {{ justificationLabel(record.justificationStatus) }}
          </p>
          @if (record.justificationText) {
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {{ record.justificationText }}
            </p>
          }
          @if (record.approvedAt) {
            <p class="mt-1 text-xs text-slate-500">
              Resuelta el {{ record.approvedAt | date: 'dd/MM/yyyy HH:mm' }}
            </p>
          }
          @if (canJustify(record)) {
            <button
              type="button"
              class="mt-3 text-sm font-semibold text-indigo-600"
              (click)="openJustify(record)"
            >
              Justificar
            </button>
          }
        </article>
      </ng-template>

      <ng-template #legend>
        <ul class="mt-4 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
          @for (status of legendStatuses; track status) {
            <li class="inline-flex items-center gap-1.5">
              <span
                class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
                [class]="statusClass(status)"
              >
                {{ statusLabel(status) }}
              </span>
            </li>
          }
        </ul>
      </ng-template>

      @if (justifying(); as record) {
        <div
          class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 class="text-lg font-semibold">
              Justificar {{ record.status === 'LATE' ? 'tardanza' : 'inasistencia' }}
            </h2>
            <p class="mt-1 text-sm text-slate-500">
              {{ record.occurredAt | date: 'dd/MM/yyyy HH:mm' }}
            </p>
            <p class="mt-2 text-sm text-slate-500">
              Describe el motivo y, si quieres, adjunta un documento o foto. La solicitud queda en
              revisión.
            </p>
            <textarea
              class="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              rows="4"
              maxlength="2000"
              [value]="justifyText()"
              (input)="onJustifyInput($event)"
            ></textarea>
            <div class="mt-3">
              <app-file-upload
                module="attendance"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                [maxSizeMb]="10"
                (uploaded)="onJustifyFile($event)"
              />
            </div>
            @if (justifyError()) {
              <p class="mt-2 text-sm text-rose-600">{{ justifyError() }}</p>
            }
            <div class="mt-4 flex justify-end gap-3">
              <button
                type="button"
                class="text-sm font-semibold text-slate-600"
                (click)="closeJustify()"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                [disabled]="submitting()"
                (click)="submitJustify()"
              >
                {{ submitting() ? 'Enviando…' : 'Enviar' }}
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class MeAttendancePageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly printService = inject(AttendancePrintService);
  private readonly reportService = inject(AttendanceReportService);
  private requestSeq = 0;

  readonly records = signal<MeAttendanceRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly exportBusy = signal(false);
  readonly justifying = signal<MeAttendanceRecord | null>(null);
  readonly justifyText = signal('');
  readonly justifyAttachment = signal<string | null>(null);
  readonly justifyError = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly view = signal<MeAttendanceView>('calendar');
  readonly month = signal<number | null>(new Date().getMonth() + 1);
  readonly year = signal(new Date().getFullYear());
  readonly selectedDayKey = signal<string | null>(null);
  readonly selectedRecordId = signal<string | null>(null);

  readonly tabs: readonly { id: MeAttendanceView; label: string }[] = [
    { id: 'calendar', label: 'Calendario' },
    { id: 'list', label: 'Lista' },
    { id: 'history', label: 'Historial' },
  ];
  readonly weekdayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly legendStatuses: readonly MeAttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED'];
  readonly todayKey = localDateKey(new Date().toISOString());
  readonly statusLabel = statusLabel;
  readonly justificationLabel = justificationLabel;
  readonly formatRate = formatRate;
  readonly formatDayTitle = formatDayTitle;

  readonly summary = computed(() => summarizeMeAttendance(this.records()));
  readonly sortedRecords = computed(() => sortByOccurredAt(this.records(), 'desc'));
  readonly byDay = computed(() => groupAttendanceByDay(this.records()));
  readonly monthCells = computed(() => {
    const month = this.month();
    if (month == null) return [] as MeAttendanceCalendarCell[];
    return buildMonthCells(this.year(), month);
  });
  readonly periodLabel = computed(() => {
    const month = this.month();
    if (month == null) return 'Todo el historial';
    const name = attendanceMonthLabel(month);
    const label = name.charAt(0).toUpperCase() + name.slice(1);
    return `${label} ${this.year()}`;
  });
  readonly showJustifyAction = computed(() =>
    this.auth.hasPermission(Permission.MeAttendanceJustify),
  );
  readonly canJustifyAny = computed(() => this.records().some((record) => this.canJustify(record)));
  readonly selectedRecord = computed(
    () => this.records().find((record) => record.publicUuid === this.selectedRecordId()) ?? null,
  );
  readonly panelRecords = computed(() => {
    const key = this.selectedDayKey();
    if (!key) return [] as MeAttendanceRecord[];
    return [...(this.byDay().get(key)?.records ?? [])];
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const requestId = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    const range = this.activeRange();
    this.api
      .listAttendance(range ? { from: range.from, to: range.to } : undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.requestSeq) return;
          this.records.set(response.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          if (requestId !== this.requestSeq) return;
          this.error.set('No se pudo cargar tu asistencia.');
          this.loading.set(false);
        },
      });
  }

  setView(next: MeAttendanceView): void {
    if (next === this.view()) return;
    this.selectedDayKey.set(null);
    this.selectedRecordId.set(null);
    if (next === 'history') {
      this.view.set('history');
      if (this.month() != null) {
        this.month.set(null);
        this.load();
      }
      return;
    }
    const needsMonth = this.month() == null;
    this.view.set(next);
    if (needsMonth) {
      const now = new Date();
      this.month.set(now.getMonth() + 1);
      this.year.set(now.getFullYear());
      this.load();
    }
  }

  shiftMonth(delta: number): void {
    const now = new Date();
    const currentMonth = this.month();
    const base =
      currentMonth == null
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(this.year(), currentMonth - 1, 1);
    const next = new Date(base.getFullYear(), base.getMonth() + delta, 1);
    this.month.set(next.getMonth() + 1);
    this.year.set(next.getFullYear());
    if (this.view() === 'history') {
      this.view.set('calendar');
    }
    this.selectedDayKey.set(null);
    this.selectedRecordId.set(null);
    this.load();
  }

  selectDay(dateKey: string): void {
    if (!this.byDay().has(dateKey)) return;
    this.selectedDayKey.set(dateKey);
    this.selectedRecordId.set(null);
  }

  selectRecord(record: MeAttendanceRecord): void {
    this.selectedRecordId.set(record.publicUuid);
    this.selectedDayKey.set(localDateKey(record.occurredAt));
  }

  dayGroup(cell: MeAttendanceCalendarCell) {
    if (!cell.inMonth) return undefined;
    return this.byDay().get(cell.dateKey);
  }

  dayAriaLabel(cell: MeAttendanceCalendarCell, count: number, status: MeAttendanceStatus): string {
    const sessions = count === 1 ? '1 sesión' : `${count} sesiones`;
    return `${formatDayTitle(cell.dateKey)}, ${sessions}, ${statusLabel(status)}`;
  }

  dayButtonClass(status: MeAttendanceStatus, selected: boolean): string {
    const layout =
      'flex h-[4.5rem] flex-col rounded-xl px-1.5 py-1 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500';
    const tone: Record<MeAttendanceStatus, string> = {
      PRESENT:
        'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 hover:ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-100 dark:ring-emerald-900',
      LATE: 'bg-amber-50 text-amber-950 ring-1 ring-amber-200 hover:ring-amber-300 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-900',
      ABSENT:
        'bg-rose-50 text-rose-950 ring-1 ring-rose-200 hover:ring-rose-300 dark:bg-rose-950/40 dark:text-rose-100 dark:ring-rose-900',
      EXCUSED:
        'bg-indigo-50 text-indigo-950 ring-1 ring-indigo-200 hover:ring-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-100 dark:ring-indigo-900',
    };
    const toneClass = tone[status];
    return selected
      ? `${layout} ${toneClass} outline outline-2 outline-indigo-500`
      : `${layout} ${toneClass}`;
  }

  rowClass(record: MeAttendanceRecord): string {
    const base =
      'cursor-pointer hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo-500 dark:hover:bg-slate-800/60';
    return this.selectedRecordId() === record.publicUuid
      ? `${base} bg-indigo-50 dark:bg-indigo-950/40`
      : base;
  }

  sessionCountLabel(count: number): string {
    return count === 1 ? '1 sesión' : `${count} sesiones`;
  }

  tabClass(id: MeAttendanceView): string {
    return this.view() === id
      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400';
  }

  canJustify(record: MeAttendanceRecord): boolean {
    return this.showJustifyAction() && canSubmitJustification(record);
  }

  openNewJustification(): void {
    const selected = this.selectedRecord();
    if (selected && this.canJustify(selected)) {
      this.openJustify(selected);
      return;
    }
    const fromDay = this.panelRecords().find((record) => this.canJustify(record));
    if (fromDay) {
      this.openJustify(fromDay);
      return;
    }
    const first = this.sortedRecords().find((record) => this.canJustify(record));
    if (first) this.openJustify(first);
  }

  openJustify(record: MeAttendanceRecord): void {
    this.justifying.set(record);
    this.justifyText.set('');
    this.justifyAttachment.set(null);
    this.justifyError.set(null);
  }

  closeJustify(): void {
    this.justifying.set(null);
    this.justifyText.set('');
    this.justifyAttachment.set(null);
    this.justifyError.set(null);
  }

  onJustifyInput(event: Event): void {
    this.justifyText.set((event.target as HTMLTextAreaElement).value);
  }

  onJustifyFile(file: FileMetadata | { publicUuid: string }): void {
    this.justifyAttachment.set(file.publicUuid);
  }

  submitJustify(): void {
    const record = this.justifying();
    const text = this.justifyText().trim();
    if (!record || !text) {
      this.justifyError.set('Escribe un motivo.');
      return;
    }
    this.submitting.set(true);
    this.api.justifyAttendance(record.publicUuid, text, this.justifyAttachment()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeJustify();
        this.load();
      },
      error: () => {
        this.submitting.set(false);
        this.justifyError.set('No se pudo enviar la justificación.');
      },
    });
  }

  statusClass(status: MeAttendanceStatus): string {
    return statusBadgeClass(status);
  }

  onPrint(): void {
    this.printService.print({
      mode: 'studentHistory',
      meta: {
        title: 'Mi asistencia',
        subtitle: this.periodLabel(),
        generatedAt: new Date(),
      },
      rows: simpleRowsToPrintRows(
        this.sortedRecords().map((record) => ({
          occurredAt: record.occurredAt,
          status: record.status,
          notes: record.notes,
        })),
      ),
    });
  }

  async onDownload(format: ReportFormat): Promise<void> {
    const range = this.activeRange();
    this.exportBusy.set(true);
    try {
      await this.reportService.downloadScopedAttendance('me', null, range?.from, range?.to, format);
    } finally {
      this.exportBusy.set(false);
    }
  }

  private activeRange(): { from: string; to: string } | null {
    const month = this.month();
    if (month == null) return null;
    return monthRange(this.year(), month);
  }
}

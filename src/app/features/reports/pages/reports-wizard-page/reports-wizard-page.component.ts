import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Subscription } from 'rxjs';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearStatus, SectionRow } from '@features/academic/models';
import {
  AttendanceReportScope,
  monthRange,
  serializeReportParams,
} from '@features/attendance/models/attendance-report-params.model';
import { ReportsApiService } from '../../services/reports-api.service';
import { ReportJob, ReportType, ReportFormat } from '../../models/report.model';

/**
 * Reports wizard page (Sprint 9 / FE-9.3).
 *
 * <p>3-step wizard on a single page:</p>
 * <ol>
 *   <li>Pick the report type (grade book, attendance, period close, transcript).</li>
 *   <li>Pick the format (PDF, XLSX, CSV).</li>
 *   <li>Submit; we poll the backend every 2s until the job is
 *       {@code DONE} or {@code FAILED}. When done, the download
 *       button is enabled.</li>
 * </ol>
 *
 * <h3>Idempotency</h3>
 * We pass a deterministic {@code idemKey} based on (type, format,
 * date) so that clicking "Generate" twice in a row returns the
 * same job instead of producing two PDFs.
 */
@Component({
  selector: 'app-reports-wizard-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Generar reporte</h1>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        El reporte se generará en segundo plano. Te avisaremos cuando esté listo.
      </p>

      <!-- Step 1: type -->
      <fieldset
        class="mt-6 rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      >
        <legend class="px-2 text-sm font-semibold">1. Tipo de reporte</legend>
        <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          @for (t of types; track t.value) {
            <label
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:border-emerald-500 has-[:checked]:bg-emerald-50 dark:border-slate-700 dark:has-[:checked]:bg-emerald-900/20"
            >
              <input
                type="radio"
                name="type"
                [value]="t.value"
                [(ngModel)]="type"
                class="text-emerald-600"
              />
              <div>
                <div class="text-sm font-medium">{{ t.label }}</div>
                <div class="text-xs text-slate-500">{{ t.hint }}</div>
              </div>
            </label>
          }
        </div>
      </fieldset>

      @if (type === 'ATTENDANCE_SUMMARY') {
        <fieldset
          class="mt-4 rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <legend class="px-2 text-sm font-semibold">2. Parámetros de asistencia</legend>
          <div class="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label class="text-xs font-medium text-slate-600">Alcance</label>
              <select class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="attScope" name="attScope">
                <option value="SECTION_DAILY">Por sección — día</option>
                <option value="SECTION_MONTHLY">Por sección — mes</option>
                <option value="SECTION_RANGE">Por sección — rango</option>
                <option value="STUDENT">Por alumno</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-medium text-slate-600">Sección</label>
              <select class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="sectionPublicUuid" name="section">
                <option [ngValue]="null">Todas</option>
                @for (s of sections(); track s.publicUuid) {
                  <option [ngValue]="s.publicUuid">{{ s.gradeName }} · {{ s.name }}</option>
                }
              </select>
            </div>
            @if (attScope === 'STUDENT') {
              <div class="sm:col-span-2">
                <label class="text-xs font-medium text-slate-600">UUID del alumno</label>
                <input class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="studentPublicUuid" name="studentUuid" placeholder="student-public-uuid" />
              </div>
            }
            @if (attScope === 'SECTION_MONTHLY') {
              <div>
                <label class="text-xs font-medium text-slate-600">Mes</label>
                <select class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="month" name="month">
                  @for (m of months; track m.value) {
                    <option [ngValue]="m.value">{{ m.label }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="text-xs font-medium text-slate-600">Año</label>
                <input type="number" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="year" name="year" />
              </div>
            } @else {
              <div>
                <label class="text-xs font-medium text-slate-600">Desde</label>
                <input type="date" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="fromDate" name="from" />
              </div>
              <div>
                <label class="text-xs font-medium text-slate-600">Hasta</label>
                <input type="date" class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" [(ngModel)]="toDate" name="to" />
              </div>
            }
          </div>
        </fieldset>
      }

      <!-- Step format -->
      <fieldset
        class="mt-4 rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      >
        <legend class="px-2 text-sm font-semibold">{{ type === 'ATTENDANCE_SUMMARY' ? '3' : '2' }}. Formato</legend>
        <div class="mt-3 flex flex-wrap gap-2">
          @for (f of formats; track f) {
            <label
              class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 hover:border-emerald-500 has-[:checked]:bg-emerald-50 dark:border-slate-700 dark:has-[:checked]:bg-emerald-900/20"
            >
              <input
                type="radio"
                name="format"
                [value]="f"
                [(ngModel)]="format"
                class="text-emerald-600"
              />
              <span class="text-sm font-medium">{{ f }}</span>
            </label>
          }
        </div>
      </fieldset>

      <!-- Step 3: status + download -->
      <fieldset
        class="mt-4 rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      >
        <legend class="px-2 text-sm font-semibold">{{ type === 'ATTENDANCE_SUMMARY' ? '4' : '3' }}. Estado</legend>

        <div class="mt-3 flex items-center gap-3">
          <button
            (click)="submit()"
            [disabled]="submitting() || !!job()"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {{ submitting() ? 'Enviando…' : 'Generar reporte' }}
          </button>
          @if (job()?.status === 'DONE') {
            <a
              [href]="downloadHref()"
              class="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
            >
              Descargar {{ job()?.format }}
            </a>
          }
        </div>

        @if (job(); as j) {
          <div class="mt-4">
            <div class="flex items-center justify-between text-xs text-slate-500">
              <span
                >Estado: <b>{{ j.status }}</b></span
              >
              <span>{{ j.progressPct }}%</span>
            </div>
            <div class="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                class="h-2 rounded-full bg-emerald-500 transition-all"
                [style.width.%]="j.progressPct"
              ></div>
            </div>
            @if (j.status === 'FAILED') {
              <p class="mt-2 text-sm text-rose-600">
                {{ j.errorMessage || 'Falló la generación' }}
              </p>
            }
            @if (timedOut()) {
              <p class="mt-2 text-sm text-amber-700 dark:text-amber-300">
                Está tardando más de lo esperado. Te avisaremos por email cuando esté listo.
              </p>
            }
          </div>
        }
      </fieldset>
    </section>
  `,
})
export class ReportsWizardPageComponent implements OnInit {
  private readonly api = inject(ReportsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly academicApi = inject(AcademicApiService);

  readonly sections = signal<SectionRow[]>([]);
  attScope: AttendanceReportScope = 'SECTION_MONTHLY';
  sectionPublicUuid: string | null = null;
  studentPublicUuid = '';
  fromDate = '';
  toDate = '';
  month = new Date().getMonth() + 1;
  year = new Date().getFullYear();
  readonly months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  readonly types: { value: ReportType; label: string; hint: string }[] = [
    { value: 'GRADE_BOOK', label: 'Libreta de calificaciones', hint: 'Por curso y sección' },
    { value: 'ATTENDANCE_SUMMARY', label: 'Resumen de asistencia', hint: 'Por sección y periodo' },
    { value: 'PERIOD_CLOSE', label: 'Cierre de periodo', hint: 'Snapshot firmado' },
    { value: 'STUDENT_TRANSCRIPT', label: 'Historial del estudiante', hint: 'Notas por periodo' },
  ];
  readonly formats: ReportFormat[] = ['PDF', 'XLSX', 'CSV'];

  type: ReportType = 'GRADE_BOOK';
  format: ReportFormat = 'CSV';

  readonly job = signal<ReportJob | null>(null);
  readonly submitting = signal(false);
  readonly timedOut = signal(false);
  /** Sprint 10 / DEBT-9-FE-2: number of polls so far (debug aid). */
  readonly pollCount = signal(0);

  private pollSub: Subscription | null = null;

  /**
   * Backoff schedule (DEBT-9-FE-2, Sprint 10 / FE-10.4):
   * poll 1: 2s, poll 2: 4s, poll 3: 8s, poll 4: 8s, then cap 15s.
   * Total: 5min cap (DEBT-9-FE-2 DoD).
   */
  private static readonly MAX_POLL_MS = 5 * 60 * 1000;
  private pollStart = 0;

  downloadHref(): string {
    const j = this.job();
    return j ? this.api.downloadUrl(j.publicUuid) : '#';
  }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const qpType = qp.get('type') as ReportType | null;
    if (qpType) this.type = qpType;
    const qpScope = qp.get('scope') as AttendanceReportScope | null;
    if (qpScope) this.attScope = qpScope;
    this.sectionPublicUuid = qp.get('sectionPublicUuid');
    this.studentPublicUuid = qp.get('studentPublicUuid') ?? '';
    this.fromDate = qp.get('from') ?? '';
    this.toDate = qp.get('to') ?? '';
    if (qp.get('month')) this.month = Number(qp.get('month'));
    if (qp.get('year')) this.year = Number(qp.get('year'));
    void this.loadSections();
  }

  private async loadSections(): Promise<void> {
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active = years.find((y) => y.status === AcademicYearStatus.Active);
      if (!active) return;
      const sections = await firstValueFrom(
        this.academicApi.listSections({ academicYearPublicUuid: active.publicUuid }),
      );
      this.sections.set(sections);
    } catch {
      this.sections.set([]);
    }
  }

  submit(): void {
    if (this.submitting() || this.job()) return;
    this.submitting.set(true);
    this.timedOut.set(false);
    this.pollCount.set(0);
    const params =
      this.type === 'ATTENDANCE_SUMMARY' ? this.buildAttendanceParams() : undefined;
    const idemKey = `wizard-${this.type}-${this.format}-${params ?? 'none'}-${new Date().toISOString().slice(0, 10)}`;
    this.api
      .create({
        reportType: this.type,
        format: this.format,
        params,
        idemKey,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (j) => {
          this.job.set(j);
          this.submitting.set(false);
          this.pollWithBackoff(j.publicUuid);
        },
        error: () => this.submitting.set(false),
      });
  }

  /**
   * Polling with exponential backoff (Sprint 10 / FE-10.4, DEBT-9-FE-2).
   * Each tick waits {@code backoff(pollCount)} ms before the next GET.
   * Stops on terminal status or after {@link #MAX_POLL_MS} (5 minutes).
   */
  private pollWithBackoff(publicUuid: string): void {
    this.pollStart = Date.now();
    this.pollSub?.unsubscribe();
    let attempt = 0;

    const tick = () => {
      const elapsed = Date.now() - this.pollStart;
      if (elapsed > ReportsWizardPageComponent.MAX_POLL_MS) {
        this.timedOut.set(true);
        this.pollSub?.unsubscribe();
        return;
      }
      this.pollSub = this.api
        .get(publicUuid)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (j) => {
            this.job.set(j);
            this.pollCount.update((c) => c + 1);
            if (j.status === 'DONE' || j.status === 'FAILED' || j.status === 'CANCELLED') {
              this.pollSub?.unsubscribe();
              return;
            }
            attempt++;
            const delay = backoffMs(attempt);
            setTimeout(tick, delay);
          },
          error: () => {
            // On error, retry once after 5s. After that, give up.
            if (attempt++ > 3) {
              this.pollSub?.unsubscribe();
              return;
            }
            setTimeout(tick, 5000);
          },
        });
    };
    tick();
  }

  private buildAttendanceParams(): string {
    let from = this.fromDate || undefined;
    let to = this.toDate || undefined;
    if (this.attScope === 'SECTION_MONTHLY') {
      const range = monthRange(this.year, this.month);
      from = range.from;
      to = range.to;
    }
    if (this.attScope === 'SECTION_DAILY' && from && !to) {
      to = from;
    }
    return serializeReportParams({
      scope: this.attScope,
      sectionPublicUuid: this.sectionPublicUuid ?? undefined,
      studentPublicUuid: this.studentPublicUuid || undefined,
      from,
      to,
      month: this.attScope === 'SECTION_MONTHLY' ? this.month : undefined,
      year: this.attScope === 'SECTION_MONTHLY' ? this.year : undefined,
    });
  }
}

/**
 * Backoff helper. Sequence: 2s, 4s, 8s, 8s, then cap 15s.
 */
function backoffMs(attempt: number): number {
  const seq = [2000, 4000, 8000, 8000, 15000];
  return seq[Math.min(attempt - 1, seq.length - 1)];
}

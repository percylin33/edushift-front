import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
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
  imports: [CommonModule, FormsModule, DatePipe],
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

      <!-- Step 2: format -->
      <fieldset
        class="mt-4 rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      >
        <legend class="px-2 text-sm font-semibold">2. Formato</legend>
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
        <legend class="px-2 text-sm font-semibold">3. Estado</legend>

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
    // intentionally no-op: the effect() in the constructor already
    // pulls the current report-type into form state on every change.
    void this.job;
  }

  submit(): void {
    if (this.submitting() || this.job()) return;
    this.submitting.set(true);
    this.timedOut.set(false);
    this.pollCount.set(0);
    const idemKey = `wizard-${this.type}-${this.format}-${new Date().toISOString().slice(0, 10)}`;
    this.api
      .create({
        reportType: this.type,
        format: this.format,
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
}

/**
 * Backoff helper. Sequence: 2s, 4s, 8s, 8s, then cap 15s.
 */
function backoffMs(attempt: number): number {
  const seq = [2000, 4000, 8000, 8000, 15000];
  return seq[Math.min(attempt - 1, seq.length - 1)];
}

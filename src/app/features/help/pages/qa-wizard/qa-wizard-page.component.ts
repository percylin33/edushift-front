import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { PageContainerComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components';
import { SpinnerComponent } from '@shared/components';
import { IconComponent } from '@shared/components';

import { findCapability } from '../../capabilities.catalog';
import { QaRunnerService } from '../../services/qa-runner.service';
import { QaBugReportService } from '../../services/qa-bug-report.service';
import {
  BugReportSeverity,
  CapabilityStep,
  StepRunResult,
  StepStatus,
} from '../../models/qa.model';

interface StepState {
  status: StepStatus;
  result?: StepRunResult;
  reportedBugId?: string;
}

interface PromptPayload {
  stepId: string;
  severity: BugReportSeverity;
  notes: string;
}

/**
 * Wizard for one {@link Capability} — `/help/role/:roleKey/:capId`.
 *
 * <h3>Flow</h3>
 * <ol>
 *   <li>Each step starts in {@code idle}.</li>
 *   <li>"Ejecutar todo" runs the steps sequentially; first failure halts.</li>
 *   <li>A failed step exposes "Reportar bug" / "Reintentar" / "Saltar".</li>
 *   <li>Step passed → green; failed → red; reported → also green; skipped
 *       → yellow.</li>
 * </ol>
 *
 * <h3>Why a custom modal</h3>
 * Bug reporting carries severity + notes + the captured request snapshot.
 * A bespoke inline modal keeps the form next to the failure context, where
 * the QA operator already is.
 */
@Component({
  selector: 'app-qa-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormsModule,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
    IconComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        [eyebrow]="eyebrow()"
        [title]="title()"
        [subtitle]="subtitle()"
      >
        <a
          [routerLink]="['/help/role', roleKey()]"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="arrow-left" [size]="14" />
          Volver al rol
        </a>
        <button
          type="button"
          (click)="runAll()"
          [disabled]="running() || capability() === undefined"
          class="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <app-icon name="play" [size]="14" />
          Ejecutar todo
        </button>
        <button
          type="button"
          (click)="exportReport()"
          [disabled]="!hasAnyState()"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted disabled:opacity-50"
        >
          <app-icon name="download" [size]="14" />
          Exportar reporte (JSON)
        </button>
      </app-page-header>

      @if (capability(); as cap) {
        <p class="mb-4 rounded-md border border-border-subtle bg-surface-muted p-3 text-sm text-content-muted">
          {{ cap.summary }}
        </p>

        <ol class="space-y-3">
          @for (step of cap.steps; track step.id) {
            <li
              class="rounded-md border p-4"
              [class]="stepCardClass(states()[step.id]?.status)"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="min-w-0">
                  <h3 class="text-sm font-semibold text-content">
                    <span class="font-mono text-2xs text-content-subtle">{{ step.id }}</span>
                    · {{ step.label }}
                  </h3>
                  <p class="mt-1 text-xs text-content-muted">
                    {{ step.description }}
                  </p>
                  @if (step.endpoint; as ep) {
                    <p class="mt-1 font-mono text-2xs text-content-subtle">
                      {{ ep.method }} {{ ep.path }}
                    </p>
                  }
                </div>
                <div class="flex items-center gap-2">
                  <span class="rounded-full bg-surface px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider">
                    {{ statusLabel(states()[step.id]?.status ?? 'idle') }}
                  </span>
                  <button
                    type="button"
                    (click)="runStep(step)"
                    [disabled]="running()"
                    class="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
                  >
                    <app-icon name="play" [size]="12" />
                    Ejecutar
                  </button>
                </div>
              </div>

              @if (states()[step.id]; as s) {
                @if (s.result?.durationMs !== undefined && s.result?.durationMs !== null) {
                  <p class="mt-2 text-2xs text-content-subtle">
                    {{ s.result?.status ?? '–' }} · {{ formatDuration(s.result?.durationMs) }} ms
                  </p>
                }
                @if (s.result?.manual) {
                  <p class="mt-2 rounded-md bg-warning/10 p-2 text-xs text-warning">
                    {{ s.result?.prompt }}
                  </p>
                }
                @if (s.result && !s.result.ok && !s.result.manual && s.result.status !== undefined && s.result.status !== null) {
                  <details class="mt-2">
                    <summary class="cursor-pointer text-2xs text-content-subtle">
                      Ver respuesta ({{ s.result?.status }})
                    </summary>
                    <pre class="mt-1 max-h-40 overflow-auto rounded-md bg-surface p-2 text-2xs">{{ formatBody(s.result?.body) }}</pre>
                  </details>
                  @if (!s.reportedBugId) {
                    <div class="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        (click)="openReportModal(step)"
                        class="inline-flex items-center gap-1 rounded-md bg-danger px-2 py-1 text-xs font-semibold text-danger-foreground hover:opacity-90"
                      >
                        <app-icon name="alert-circle" [size]="12" />
                        Reportar bug
                      </button>
                      <button
                        type="button"
                        (click)="runStep(step)"
                        [disabled]="running()"
                        class="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-surface-muted disabled:opacity-50"
                      >
                        <app-icon name="refresh" [size]="12" />
                        Reintentar
                      </button>
                      <button
                        type="button"
                        (click)="skipStep(step)"
                        class="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium hover:bg-surface-muted"
                      >
                        Saltar
                      </button>
                    </div>
                  } @else {
                    <p class="mt-2 text-2xs text-success">
                      Bug reportado · id {{ s.reportedBugId }}
                    </p>
                  }
                }
              }
            </li>
          }
        </ol>
      } @else {
        <p class="rounded-md border border-border bg-surface p-6 text-center text-sm text-content-muted">
          Capability no encontrada.
          <a [routerLink]="['/help/role', roleKey()]" class="text-primary hover:underline">Volver</a>
        </p>
      }

      @if (reportModalStep()) {
        <div
          role="dialog"
          aria-modal="true"
          class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
        >
          <div class="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-lg">
            <h3 class="text-base font-semibold text-content">Reportar bug</h3>
            <p class="mt-1 text-xs text-content-muted">{{ reportModalStep()!.label }}</p>

            <label class="mt-4 block text-xs font-medium text-content">Severidad</label>
            <select
              [(ngModel)]="reportDraft.severity"
              class="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
            >
              <option value="BLOCKER">BLOCKER</option>
              <option value="MAJOR">MAJOR</option>
              <option value="MINOR">MINOR</option>
              <option value="COSMETIC">COSMETIC</option>
            </select>

            <label class="mt-4 block text-xs font-medium text-content">Notas</label>
            <textarea
              [(ngModel)]="reportDraft.notes"
              rows="4"
              class="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm"
              placeholder="Pasos para reproducir, contexto adicional..."
            ></textarea>

            <div class="mt-4 flex justify-end gap-2">
              <button
                type="button"
                (click)="closeReportModal()"
                class="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="submitBugReport()"
                [disabled]="reporting()"
                class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                @if (reporting()) {
                  <app-spinner [size]="12" />
                }
                Enviar
              </button>
            </div>
          </div>
        </div>
      }
    </app-page-container>
  `,
})
export class QaWizardPageComponent {
  readonly roleKey = input.required<string>();
  readonly capId = input.required<string>();

  private readonly runner = inject(QaRunnerService);
  private readonly bugService = inject(QaBugReportService);

  readonly capability = computed(() => findCapability(this.capId()));
  readonly title = computed(() => this.capability()?.title ?? 'Capability');
  readonly subtitle = computed(() => this.capability()?.summary ?? '');
  readonly eyebrow = computed(() => `Wizard / ${this.capId()}`);

  readonly running = signal(false);
  readonly states = signal<Record<string, StepState>>({});
  readonly reportModalStep = signal<CapabilityStep | null>(null);
  readonly reporting = signal(false);
  reportDraft: PromptPayload = { stepId: '', severity: 'MAJOR', notes: '' };

  async runAll(): Promise<void> {
    const cap = this.capability();
    if (!cap || this.running()) return;
    this.running.set(true);
    for (const step of cap.steps) {
      const result = await this.runOneStep(step);
      if (!result.ok) break;
    }
    this.running.set(false);
  }

  async runStep(step: CapabilityStep): Promise<void> {
    if (this.running()) return;
    this.running.set(true);
    await this.runOneStep(step);
    this.running.set(false);
  }

  skipStep(step: CapabilityStep): void {
    this.states.update((s) => ({
      ...s,
      [step.id]: { status: 'skipped', result: s[step.id]?.result },
    }));
  }

  openReportModal(step: CapabilityStep): void {
    this.reportModalStep.set(step);
    this.reportDraft = {
      stepId: step.id,
      severity: 'MAJOR',
      notes: '',
    };
  }

  closeReportModal(): void {
    this.reportModalStep.set(null);
  }

  submitBugReport(): void {
    const step = this.reportModalStep();
    const cap = this.capability();
    if (!step || !cap) return;
    const state = this.states()[step.id];
    this.reporting.set(true);
    this.bugService
      .create({
        capabilityId: cap.id,
        stepId: step.id,
        stepLabel: step.label,
        severity: this.reportDraft.severity,
        notes: this.reportDraft.notes,
        request: state?.result
          ? {
              method: step.endpoint?.method ?? 'UNKNOWN',
              path: step.endpoint?.path ?? 'UNKNOWN',
              status: state.result.status ?? 0,
              bodyPreview: this.formatBody(state.result.body).slice(0, 1024),
            }
          : null,
      })
      .pipe(finalize(() => this.reporting.set(false)))
      .subscribe({
        next: (saved) => {
          this.states.update((s) => ({
            ...s,
            [step.id]: { ...(s[step.id] ?? { status: 'broken' }), reportedBugId: saved.id },
          }));
          this.reportModalStep.set(null);
        },
        error: () => {
          this.closeReportModal();
        },
      });
  }

  exportReport(): void {
    const cap = this.capability();
    if (!cap) return;
    const payload = {
      capabilityId: cap.id,
      role: this.roleKey(),
      exportedAt: new Date().toISOString(),
      states: this.states(),
      capability: { id: cap.id, title: cap.title, status: cap.status },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${cap.id}-report.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  statusLabel(status: StepStatus): string {
    switch (status) {
      case 'idle':
        return 'Pendiente';
      case 'running':
        return 'Corriendo';
      case 'passed':
        return 'OK';
      case 'failed':
        return 'Falló';
      case 'broken':
        return 'Roto';
      case 'skipped':
        return 'Saltado';
      default:
        return status;
    }
  }

  stepCardClass(status: StepStatus | undefined): string {
    switch (status) {
      case 'passed':
        return 'border-success/40 bg-success/5';
      case 'failed':
      case 'broken':
        return 'border-danger/40 bg-danger/5';
      case 'skipped':
        return 'border-warning/40 bg-warning/5';
      case 'running':
        return 'border-primary/40 bg-primary/5';
      default:
        return 'border-border';
    }
  }

  formatBody(body: unknown): string {
    if (body == null) return '';
    try {
      return JSON.stringify(body, null, 2);
    } catch {
      return String(body);
    }
  }

  formatDuration(ms: number | undefined): string {
    if (ms == null) return '0';
    return ms.toFixed(0);
  }

  hasAnyState(): boolean {
    return Object.keys(this.states()).length > 0;
  }

  private runOneStep(step: CapabilityStep): Promise<StepRunResult> {
    return new Promise((resolve) => {
      this.states.update((s) => ({ ...s, [step.id]: { status: 'running' } }));
      this.runner.run(step).subscribe({
        next: (result) => {
          const status: StepStatus = result.ok
            ? 'passed'
            : result.manual
              ? 'skipped'
              : (this.states()[step.id]?.reportedBugId ? 'broken' : 'failed');
          this.states.update((s) => ({
            ...s,
            [step.id]: { ...(s[step.id] ?? {}), status, result },
          }));
          resolve(result);
        },
        error: () => {
          this.states.update((s) => ({
            ...s,
            [step.id]: {
              ...(s[step.id] ?? {}),
              status: 'failed',
              result: { ok: false, durationMs: 0, errorMessage: 'Excepción no controlada' },
            },
          }));
          resolve({ ok: false, durationMs: 0, errorMessage: 'Excepción no controlada' });
        },
      });
    });
  }
}

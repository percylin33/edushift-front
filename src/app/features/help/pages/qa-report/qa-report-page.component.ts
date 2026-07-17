import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { PageContainerComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components';
import { SpinnerComponent } from '@shared/components';
import { IconComponent } from '@shared/components';
import { EmptyStateComponent } from '@shared/components';

import { QaBugReportService } from '../../services/qa-bug-report.service';
import {
  BugReport,
  BugReportSeverity,
  BugReportStatus,
} from '../../models/qa.model';

const SEVERITIES: BugReportSeverity[] = ['BLOCKER', 'MAJOR', 'MINOR', 'COSMETIC'];
const STATUSES: BugReportStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

/**
 * Bug reports listing — `/help/reports`.
 *
 * <p>Tabs by status; supports severity + status filters and lets the
 * owner or any SUPER_ADMIN advance the workflow.</p>
 */
@Component({
  selector: 'app-qa-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    JsonPipe,
    FormsModule,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
    IconComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        eyebrow="Centro de Pruebas"
        title="Bug reports"
        subtitle="Issues generados por el wizard. Cambia status al triages."
      >
        <a
          routerLink="/help"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="arrow-left" [size]="14" />
          Centro de pruebas
        </a>
      </app-page-header>

      <div class="mb-4 flex flex-wrap items-end gap-3">
        <label class="text-xs font-medium text-content">
          Severidad
          <select
            [(ngModel)]="severityFilter"
            (change)="reload()"
            class="ml-1 rounded-md border border-border bg-surface px-2 py-1 text-xs"
          >
            <option [ngValue]="null">Todas</option>
            @for (s of severities; track s) {
              <option [ngValue]="s">{{ s }}</option>
            }
          </select>
        </label>

        <div class="ml-auto flex gap-1 rounded-md border border-border p-1 text-xs">
          @for (s of statuses; track s) {
            <button
              type="button"
              (click)="setStatusFilter(s)"
              [class]="tabClass(s)"
            >
              {{ s }}
              <span class="ml-1 rounded bg-surface px-1 py-0.5 text-2xs">
                {{ countByStatus()[s] ?? 0 }}
              </span>
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <app-spinner [size]="20" />
        </div>
      } @else if (reports().length === 0) {
        <app-empty-state
          title="Sin reports"
          description="No hay bugs reportados con los filtros actuales."
        />
      } @else {
        <ul class="space-y-2">
          @for (r of reports(); track r.id) {
            <li
              class="rounded-md border border-border bg-surface p-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p class="font-mono text-xs text-content-subtle">{{ r.capabilityId }} / {{ r.stepId }}</p>
                  <p class="mt-1 text-sm text-content">
                    {{ r.stepLabel ?? 'Sin etiqueta' }}
                  </p>
                  <p class="mt-1 text-2xs text-content-subtle">
                    {{ r.createdAt | date: 'short' }} · severidad
                    <span class="font-semibold">{{ r.severity }}</span>
                  </p>
                </div>
                <div class="flex flex-col items-end gap-1">
                  <span [class]="statusBadgeClass(r.status)">{{ r.status }}</span>
                  @if (r.status === 'OPEN') {
                    <div class="flex gap-1">
                      <button
                        type="button"
                        (click)="advance(r, 'ACKNOWLEDGED')"
                        class="rounded-md border border-border bg-surface px-2 py-0.5 text-2xs hover:bg-surface-muted"
                      >
                        ACK
                      </button>
                      <button
                        type="button"
                        (click)="advance(r, 'RESOLVED')"
                        class="rounded-md bg-primary px-2 py-0.5 text-2xs font-semibold text-primary-foreground hover:opacity-90"
                      >
                        Resolver
                      </button>
                    </div>
                  }
                </div>
              </div>
              @if (r.notes) {
                <p class="mt-2 rounded-md bg-surface-muted p-2 text-xs text-content-muted">
                  {{ r.notes }}
                </p>
              }
              @if (r.request) {
                <details class="mt-2">
                  <summary class="cursor-pointer text-2xs text-content-subtle">Request snapshot</summary>
                  <pre class="mt-1 max-h-32 overflow-auto rounded-md bg-surface p-2 text-2xs">{{ r.request | json }}</pre>
                </details>
              }
            </li>
          }
        </ul>
      }
    </app-page-container>
  `,
})
export class QaReportPageComponent {
  private readonly bugService = inject(QaBugReportService);

  readonly severities = SEVERITIES;
  readonly statuses = STATUSES;

  readonly loading = signal(true);
  readonly reports = signal<BugReport[]>([]);
  readonly statusFilter = signal<BugReportStatus>('OPEN');
  severityFilter: BugReportSeverity | null = null;

  readonly countByStatus = computed(() => {
    const map: Partial<Record<BugReportStatus, number>> = {};
    for (const r of this.reports()) {
      map[r.status] = (map[r.status] ?? 0) + 1;
    }
    return map;
  });

  constructor() {
    this.reload();
  }

  setStatusFilter(status: BugReportStatus): void {
    this.statusFilter.set(status);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    const params: { status?: string; size: number } = { size: 200 };
    params.status = this.statusFilter();
    this.bugService
      .list(params)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          const filtered = this.severityFilter
            ? page.content.filter((r) => r.severity === this.severityFilter)
            : page.content;
          this.reports.set(filtered);
        },
        error: () => {
          this.reports.set([]);
          this.loading.set(false);
        },
      });
  }

  advance(report: BugReport, to: BugReportStatus): void {
    this.bugService.updateStatus(report.id, to).subscribe({
      next: () => this.reload(),
      error: () => {},
    });
  }

  tabClass(s: BugReportStatus): string {
    const active = this.statusFilter() === s;
    return active
      ? 'rounded-md bg-primary px-2 py-1 font-semibold text-primary-foreground'
      : 'rounded-md px-2 py-1 text-content-muted hover:bg-surface-muted';
  }

  statusBadgeClass(status: BugReportStatus): string {
    switch (status) {
      case 'OPEN':
        return 'rounded-full bg-warning/15 px-2 py-0.5 text-2xs font-semibold text-warning';
      case 'ACKNOWLEDGED':
        return 'rounded-full bg-primary/15 px-2 py-0.5 text-2xs font-semibold text-primary';
      case 'RESOLVED':
        return 'rounded-full bg-success/15 px-2 py-0.5 text-2xs font-semibold text-success';
      default:
        return 'rounded-full bg-surface px-2 py-0.5 text-2xs font-semibold';
    }
  }
}

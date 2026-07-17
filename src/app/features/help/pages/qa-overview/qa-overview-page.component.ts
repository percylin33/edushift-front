import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PageContainerComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components';
import { SpinnerComponent } from '@shared/components';
import { IconComponent } from '@shared/components';
import { EmptyStateComponent } from '@shared/components';

import { CAPABILITIES, ROLES, capabilitiesForRole } from '../../capabilities.catalog';
import { QaBugReportService } from '../../services/qa-bug-report.service';
import { BugReport, CapabilityStatus, RoleKey } from '../../models/qa.model';

interface RoleCard {
  key: RoleKey;
  title: string;
  subtitle: string;
  total: number;
  live: number;
  partial: number;
  planned: number;
  broken: number;
  openBugs: number;
}

/**
 * Centro de Pruebas landing — `/help`.
 *
 * <p>Lands the QA operator in a role-picker grid: one card per
 * {@link ROLES}, each summarising capability counts and open bug reports.
 * Bottom of the page links to the legacy manuals.</p>
 */
@Component({
  selector: 'app-qa-overview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
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
        title="Validación por rol"
        subtitle="Cada capacidad se ejecuta contra el backend real. Step fallido → bug automático."
      >
        <a
          routerLink="/help/guides"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
          data-testid="open-walkthroughs-btn"
        >
          <app-icon name="book-open" [size]="14" />
          Guías de prueba
        </a>
        <a
          routerLink="/help/reports"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="alert-circle" [size]="14" />
          Ver bug reports
        </a>
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <app-spinner [size]="20" />
        </div>
      } @else {
        @if (loadError(); as err) {
          <div
            role="alert"
            class="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
          >
            <p class="font-medium">No se pudo cargar el resumen.</p>
            <p class="mt-1 text-danger/80">{{ err }}</p>
            <button
              type="button"
              (click)="reload()"
              class="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
            >
              <app-icon name="rotate-ccw" [size]="14" />
              Reintentar
            </button>
          </div>
        } @else {
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (card of cards(); track card.key) {
            <li>
              <a
                [routerLink]="['/help/role', card.key]"
                class="group flex h-full flex-col rounded-lg border border-border bg-surface p-5 transition hover:border-primary hover:shadow"
              >
                <div class="flex items-center justify-between">
                  <h2 class="text-base font-semibold tracking-tight text-content">
                    {{ card.title }}
                  </h2>
                  <app-icon
                    name="arrow-right"
                    [size]="16"
                    class="text-content-subtle transition group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </div>
                <p class="mt-1 text-xs text-content-muted">{{ card.subtitle }}</p>

                <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div class="flex items-center justify-between rounded-md bg-success/10 px-2 py-1">
                    <span>Live</span>
                    <span class="font-semibold">{{ card.live }}</span>
                  </div>
                  <div class="flex items-center justify-between rounded-md bg-warning/10 px-2 py-1">
                    <span>Partial</span>
                    <span class="font-semibold">{{ card.partial }}</span>
                  </div>
                  <div class="flex items-center justify-between rounded-md bg-content-subtle/10 px-2 py-1">
                    <span>Planned</span>
                    <span class="font-semibold">{{ card.planned }}</span>
                  </div>
                  <div class="flex items-center justify-between rounded-md bg-danger/10 px-2 py-1">
                    <span>Bugs abiertos</span>
                    <span class="font-semibold">{{ card.openBugs }}</span>
                  </div>
                </div>

                <p class="mt-3 text-2xs text-content-subtle">
                  {{ card.total }} capabilities en total
                </p>
              </a>
            </li>
          }
        </ul>

        <footer class="mt-10 border-t border-border-subtle pt-4 text-xs text-content-subtle">
          ¿Buscas los manuales antiguos?
          <a routerLink="/help/legacy" class="text-primary hover:underline">
            Ir a /help/legacy
          </a>
        </footer>
        }
      }
    </app-page-container>
  `,
})
export class QaOverviewPageComponent {
  private readonly bugService = inject(QaBugReportService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly openBugsByCapability = signal<Record<string, number>>({});

  readonly cards = computed<RoleCard[]>(() => {
    const bugCounts = this.openBugsByCapability();
    return ROLES.map((role) => {
      const caps = capabilitiesForRole(role.key);
      const counts: Record<CapabilityStatus, number> = {
        live: 0,
        partial: 0,
        planned: 0,
        broken: 0,
      };
      let openBugs = 0;
      for (const cap of caps) {
        counts[cap.status] += 1;
        const bugsForCap = bugCounts[cap.id] ?? 0;
        if (cap.status === 'broken') openBugs += 1;
        openBugs += bugsForCap;
      }
      return {
        key: role.key,
        title: role.title,
        subtitle: role.subtitle,
        total: caps.length,
        live: counts.live,
        partial: counts.partial,
        planned: counts.planned,
        broken: counts.broken,
        openBugs,
      };
    });
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.bugService
      .list({ status: 'OPEN', size: 200 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (page) => {
          const counts: Record<string, number> = {};
          for (const report of page.content as BugReport[]) {
            counts[report.capabilityId] = (counts[report.capabilityId] ?? 0) + 1;
          }
          this.openBugsByCapability.set(counts);
          if (!this.hasAnyCapability()) {
            this.loadError.set(
              'No hay capabilities cargadas. Revisa /src/app/features/help/capabilities.catalog.ts.',
            );
          }
        },
        error: (err: unknown) => {
          this.loadError.set(this.formatError(err));
        },
      });
  }

  private hasAnyCapability(): boolean {
    return CAPABILITIES.length > 0;
  }

  private formatError(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
    return 'Error desconocido al cargar bug reports.';
  }
}

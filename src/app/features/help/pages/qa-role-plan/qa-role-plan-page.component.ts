import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PageContainerComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components';
import { SpinnerComponent } from '@shared/components';
import { IconComponent } from '@shared/components';
import { IconName } from '@shared/components/icon/icons.registry';
import { EmptyStateComponent } from '@shared/components';

import { ROLES, capabilitiesForRole } from '../../capabilities.catalog';
import { QaBugReportService } from '../../services/qa-bug-report.service';
import { BugReport, Capability, RoleKey } from '../../models/qa.model';

interface CapabilityCard {
  capability: Capability;
  statusLabel: string;
  statusClass: string;
  statusIcon: IconName;
  openBugs: number;
}

/**
 * Role-level QA plan — `/help/role/:roleKey`.
 *
 * <p>Renders a grid of {@link Capability} cards for one role, each with the
 * current bug-report count. The status badge reflects both the catalog
 * declaration and the runtime open-bugs tally.</p>
 */
@Component({
  selector: 'app-qa-role-plan',
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
        [eyebrow]="eyebrow()"
        [title]="title()"
        [subtitle]="subtitle()"
      >
        <a
          routerLink="/help"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="arrow-left" [size]="14" />
          Roles
        </a>
        <a
          routerLink="/help/reports"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="alert-circle" [size]="14" />
          Reports
        </a>
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <app-spinner [size]="20" />
        </div>
      } @else if (cards().length === 0) {
        <app-empty-state
          title="Sin capabilities en el catálogo"
          description="Añade al menos una capability para este rol en capabilities.catalog.ts."
        />
      } @else {
        <div class="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div class="rounded-md bg-success/10 px-3 py-2">
            <p class="text-2xs uppercase text-content-subtle">Live</p>
            <p class="text-lg font-semibold">{{ summary().live }}</p>
          </div>
          <div class="rounded-md bg-warning/10 px-3 py-2">
            <p class="text-2xs uppercase text-content-subtle">Partial</p>
            <p class="text-lg font-semibold">{{ summary().partial }}</p>
          </div>
          <div class="rounded-md bg-content-subtle/10 px-3 py-2">
            <p class="text-2xs uppercase text-content-subtle">Planned</p>
            <p class="text-lg font-semibold">{{ summary().planned }}</p>
          </div>
          <div class="rounded-md bg-danger/10 px-3 py-2">
            <p class="text-2xs uppercase text-content-subtle">Bugs abiertos</p>
            <p class="text-lg font-semibold">{{ summary().openBugs }}</p>
          </div>
        </div>

        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (card of cards(); track card.capability.id) {
            <li>
              <a
                [routerLink]="['/help/role', roleKey(), card.capability.id]"
                class="group flex h-full flex-col rounded-lg border border-border bg-surface p-4 transition hover:border-primary hover:shadow"
              >
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold"
                    [class]="card.statusClass"
                  >
                    <app-icon [name]="card.statusIcon" [size]="12" />
                    {{ card.statusLabel }}
                  </span>
                  <span class="text-2xs text-content-subtle">
                    {{ card.capability.steps.length }} steps
                  </span>
                </div>
                <h3 class="mt-2 text-sm font-semibold text-content">
                  {{ card.capability.title }}
                </h3>
                <p class="mt-1 line-clamp-3 text-xs text-content-muted">
                  {{ card.capability.summary }}
                </p>

                <div class="mt-3 flex items-center justify-between text-2xs text-content-subtle">
                  <span class="font-mono">{{ card.capability.id }}</span>
                  <span>
                    {{ card.openBugs }} bugs abiertos
                  </span>
                </div>
              </a>
            </li>
          }
        </ul>
      }
    </app-page-container>
  `,
})
export class QaRolePlanPageComponent {
  readonly roleKey = input.required<string>();

  private readonly bugService = inject(QaBugReportService);

  readonly loading = signal(true);
  readonly openBugsByCapability = signal<Record<string, number>>({});

  readonly capabilities = computed<Capability[]>(() => {
    const key = this.roleKey() as RoleKey;
    return capabilitiesForRole(key);
  });

  readonly cards = computed<CapabilityCard[]>(() => {
    const bugs = this.openBugsByCapability();
    return this.capabilities().map((cap) => {
      const open = bugs[cap.id] ?? 0;
      const status = open > 0 ? 'broken' : cap.status;
      return {
        capability: cap,
        statusLabel: this.statusLabel(status),
        statusClass: this.statusClass(status),
        statusIcon: this.statusIcon(status),
        openBugs: open,
      };
    });
  });

  readonly summary = computed(() => {
    const cards = this.cards();
    return {
      live: cards.filter((c) => c.capability.status === 'live').length,
      partial: cards.filter((c) => c.capability.status === 'partial').length,
      planned: cards.filter((c) => c.capability.status === 'planned').length,
      openBugs: cards.reduce((acc, c) => acc + c.openBugs, 0),
    };
  });

  readonly title = computed(() => {
    const role = ROLES.find((r) => r.key === this.roleKey());
    return role?.title ?? 'Rol desconocido';
  });

  readonly subtitle = computed(() => {
    const role = ROLES.find((r) => r.key === this.roleKey());
    return role?.subtitle ?? 'Capabilities para un rol no catalogado.';
  });

  readonly eyebrow = computed(() => `Centro de Pruebas / ${this.title()}`);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
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
        },
        error: () => {
          this.openBugsByCapability.set({});
        },
      });
  }

  private statusLabel(status: string): string {
    switch (status) {
      case 'live':
        return 'OK';
      case 'partial':
        return 'Parcial';
      case 'planned':
        return 'En progreso';
      case 'broken':
        return 'Roto';
      default:
        return status;
    }
  }

  private statusClass(status: string): string {
    switch (status) {
      case 'live':
        return 'bg-success/15 text-success';
      case 'partial':
        return 'bg-warning/15 text-warning';
      case 'planned':
        return 'bg-content-subtle/15 text-content-muted';
      case 'broken':
        return 'bg-danger/15 text-danger';
      default:
        return 'bg-content-subtle/15 text-content-muted';
    }
  }

  private statusIcon(status: string): IconName {
    switch (status) {
      case 'live':
        return 'check';
      case 'partial':
        return 'alert-triangle';
      case 'planned':
        return 'clock';
      case 'broken':
        return 'alert-circle';
      default:
        return 'circle';
    }
  }
}

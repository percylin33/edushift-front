import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';

export type ScheduleAdminSection = 'sections' | 'jornada' | 'workload';

@Component({
  selector: 'app-schedule-admin-nav',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav
      class="mb-6 flex flex-wrap gap-2 border-b border-border-subtle pb-3"
      aria-label="Gestión de horarios"
    >
      <a
        [routerLink]="ROUTES.SCHEDULE.ROOT"
        [queryParams]="yearParams()"
        [attr.aria-current]="active() === 'sections' ? 'page' : null"
        class="rounded-md border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        [class.border-primary]="active() === 'sections'"
        [class.border-transparent]="active() !== 'sections'"
        [class.text-primary]="active() === 'sections'"
        [class.text-content-muted]="active() !== 'sections'"
        aria-label="Horario por sección"
      >
        Por sección
      </a>
      <a
        [routerLink]="ROUTES.SCHEDULE.JORNADA"
        [queryParams]="yearParams()"
        [attr.aria-current]="active() === 'jornada' ? 'page' : null"
        class="rounded-md border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        [class.border-primary]="active() === 'jornada'"
        [class.border-transparent]="active() !== 'jornada'"
        [class.text-primary]="active() === 'jornada'"
        [class.text-content-muted]="active() !== 'jornada'"
        aria-label="Jornada escolar"
      >
        Jornada
      </a>
      <a
        [routerLink]="ROUTES.SCHEDULE.WORKLOAD"
        [queryParams]="yearParams()"
        [attr.aria-current]="active() === 'workload' ? 'page' : null"
        class="rounded-md border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        [class.border-primary]="active() === 'workload'"
        [class.border-transparent]="active() !== 'workload'"
        [class.text-primary]="active() === 'workload'"
        [class.text-content-muted]="active() !== 'workload'"
        aria-label="Carga docente"
      >
        Carga docente
      </a>
    </nav>
  `,
})
export class ScheduleAdminNavComponent {
  readonly active = input.required<ScheduleAdminSection>();
  readonly yearUuid = input<string | null>(null);
  readonly periodUuid = input<string | null>(null);
  protected readonly ROUTES = ROUTES;
  protected readonly yearParams = computed(() => ({
    ...(this.yearUuid() ? { year: this.yearUuid() } : {}),
    ...(this.periodUuid() ? { period: this.periodUuid() } : {}),
  }));
}

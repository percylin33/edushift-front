import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
} from '@shared/components';

/**
 * `/attendance` — landing page for the attendance module.
 *
 * <p>Kept intentionally light: it's a hub that links into the
 * scanner (the primary docente flow) and the sessions list (the
 * admin / review flow). Heavier dashboard widgets (KPIs, charts)
 * land in FE-6.5.</p>
 */
@Component({
  selector: 'app-attendance-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header title="Asistencia" subtitle="Control diario, historial y reportes.">
        <a [routerLink]="scannerRoute" class="btn btn-primary btn-sm">
          <app-icon name="target" [size]="16" />
          <span class="hidden sm:inline">Abrir scanner</span>
        </a>
      </app-page-header>

      <div class="grid gap-3 sm:grid-cols-2">
        <a [routerLink]="scannerRoute" class="card transition hover:shadow-md">
          <div class="card-body flex flex-row items-center gap-3">
            <app-icon name="target" [size]="32" class="text-primary" />
            <div class="flex-1">
              <p class="font-semibold">Scanner</p>
              <p class="text-sm text-content-muted">
                Toma asistencia escaneando el QR de cada alumno.
              </p>
            </div>
            <app-icon name="chevron-right" [size]="20" class="text-content-subtle" />
          </div>
        </a>
        <a [routerLink]="sessionsRoute" class="card transition hover:shadow-md">
          <div class="card-body flex flex-row items-center gap-3">
            <app-icon name="calendar-check" [size]="32" class="text-primary" />
            <div class="flex-1">
              <p class="font-semibold">Sesiones</p>
              <p class="text-sm text-content-muted">
                Lista de sesiones, abre nuevas, edita rosters.
              </p>
            </div>
            <app-icon name="chevron-right" [size]="20" class="text-content-subtle" />
          </div>
        </a>
      </div>

      <div class="card mt-4">
        <div class="card-body">
          <app-empty-state
            icon="bar-chart"
            title="Dashboard (FE-6.5)"
            description="KPIs y widgets llegan en el siguiente sub-ticket."
          />
        </div>
      </div>
    </app-page-container>
  `,
})
export class AttendanceHomeComponent {
  protected readonly scannerRoute = ROUTES.ATTENDANCE.SCANNER;
  protected readonly sessionsRoute = ROUTES.ATTENDANCE.SESSIONS;
}

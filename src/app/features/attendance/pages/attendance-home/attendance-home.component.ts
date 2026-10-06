import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
} from '@shared/components';

/**
 * `/attendance/hub` — optional hub for the attendance module.
 *
 * <p>Primary entry is the gate scanner ({@code /attendance} redirects
 * there). This page remains for users who want an explicit choice
 * between puerta (escáner) and aula (sesiones por sección).</p>
 */
@Component({
  selector: 'app-attendance-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, PageContainerComponent, PageHeaderComponent, IconComponent],
  template: `
    <app-page-container>
      <app-page-header
        title="Asistencia"
        subtitle="En la puerta: escanea o busca al alumno. Por aula: abre una sesión por sección."
      >
        <a [routerLink]="scannerRoute" class="btn btn-primary btn-sm">
          <app-icon name="target" [size]="16" />
          <span class="hidden sm:inline">Entrada / Escáner</span>
        </a>
      </app-page-header>

      <div class="grid gap-3 sm:grid-cols-2">
        <a [routerLink]="scannerRoute" class="card transition hover:shadow-md">
          <div class="card-body flex flex-row items-center gap-3">
            <app-icon name="target" [size]="32" class="text-primary" />
            <div class="flex-1">
              <p class="font-semibold">Entrada / Escáner</p>
              <p class="text-sm text-content-muted">
                Asistencia en la puerta: QR o búsqueda por nombre. No eliges sección; el sistema la
                resuelve solo.
              </p>
            </div>
            <app-icon name="chevron-right" [size]="20" class="text-content-subtle" />
          </div>
        </a>
        <a [routerLink]="sessionsRoute" class="card transition hover:shadow-md">
          <div class="card-body flex flex-row items-center gap-3">
            <app-icon name="calendar-check" [size]="32" class="text-primary" />
            <div class="flex-1">
              <p class="font-semibold">Sesiones (por aula)</p>
              <p class="text-sm text-content-muted">
                Revisar el día, abrir sesión por sección y editar la lista.
              </p>
            </div>
            <app-icon name="chevron-right" [size]="20" class="text-content-subtle" />
          </div>
        </a>
      </div>
    </app-page-container>
  `,
})
export class AttendanceHomeComponent {
  protected readonly scannerRoute = ROUTES.ATTENDANCE.SCANNER;
  protected readonly sessionsRoute = ROUTES.ATTENDANCE.SESSIONS;
}

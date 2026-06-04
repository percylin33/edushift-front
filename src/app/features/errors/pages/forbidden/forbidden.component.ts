import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-subtle px-6 text-content">
      <div class="max-w-md text-center">
        <p class="text-sm font-semibold uppercase tracking-widest text-danger">403</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight">Acceso denegado</h1>
        <p class="mt-2 text-content-muted">No tienes permisos para ver esta página.</p>
        <a [routerLink]="dashboardRoute" class="mt-6 inline-block">Volver al inicio</a>
      </div>
    </section>
  `
})
export class ForbiddenComponent {
  readonly dashboardRoute = ROUTES.DASHBOARD.ROOT;
}

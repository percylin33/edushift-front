import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-subtle px-6 text-content">
      <div class="max-w-md text-center">
        <p class="text-sm font-semibold uppercase tracking-widest text-primary-600">404</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight">Página no encontrada</h1>
        <p class="mt-2 text-content-muted">La ruta que buscas no existe o fue movida.</p>
        <a [routerLink]="dashboardRoute" class="mt-6 inline-block">Volver al inicio</a>
      </div>
    </section>
  `
})
export class NotFoundComponent {
  readonly dashboardRoute = ROUTES.DASHBOARD.ROOT;
}

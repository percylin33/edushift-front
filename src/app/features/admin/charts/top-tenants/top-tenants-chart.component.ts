import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TopTenant } from '../../models';

@Component({
  selector: 'app-top-tenants-chart',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="h-full rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm shadow-black/10">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-white">Principales instituciones</h2>
          <p class="mt-1 text-xs text-slate-400">Por monto de facturas emitidas este mes, según su estado actual.</p>
        </div>
        <a routerLink="/admin/tenants" class="shrink-0 text-xs font-medium text-indigo-300 hover:text-indigo-200">Ver todas <span aria-hidden="true">→</span></a>
      </div>

      @if (loading()) {
        <div role="status" class="mt-4 h-64 animate-pulse rounded-lg bg-slate-800/50"></div>
      } @else if (failed()) {
        <div role="alert" class="mt-4 grid h-64 place-items-center rounded-lg border border-rose-500/15 bg-rose-950/20 px-4 text-center text-sm text-rose-200">No se pudo cargar el ranking.</div>
      } @else if (!data().length) {
        <div class="mt-4 grid h-64 place-items-center rounded-lg border border-dashed border-slate-700 px-4 text-center text-sm text-slate-400">No hay facturas de instituciones en el mes actual.</div>
      } @else {
        <ol class="mt-3 divide-y divide-slate-800/80">
          @for (tenant of data(); track tenant.publicUuid; let index = $index) {
            <li>
              <a
                [routerLink]="['/admin/tenants', tenant.publicUuid]"
                class="flex min-h-12 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <span class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-indigo-500/15 text-[11px] font-semibold text-indigo-200">{{ index + 1 }}</span>
                <span class="min-w-0 flex-1 truncate text-sm text-slate-200">{{ tenant.tenantName }}</span>
                <span class="shrink-0 text-right text-xs font-semibold tabular-nums text-white">{{ formatCurrency(tenant.revenue) }}</span>
              </a>
            </li>
          }
        </ol>
      }
    </section>
  `,
})
export class TopTenantsChartComponent {
  readonly data = input<TopTenant[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
  }
}

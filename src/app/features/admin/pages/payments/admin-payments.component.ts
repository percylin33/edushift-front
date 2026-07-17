import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { AdminPaymentsService } from '../../services';

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Pagos</h1>
          <p class="mt-1 text-sm text-slate-400">Historial de pagos B2B.</p>
        </div>
      </div>

      @if (svc.error(); as err) {
        <div class="mt-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{{ err }}</div>
      }

      <div class="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-4 py-3">Colegio</th>
              <th class="px-4 py-3">Factura</th>
              <th class="px-4 py-3">Monto</th>
              <th class="px-4 py-3">Método</th>
              <th class="px-4 py-3">Referencia</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            @for (p of svc.payments(); track p.publicUuid) {
              <tr class="hover:bg-slate-800/50">
                <td class="px-4 py-3 font-medium text-white">{{ p.tenantName }}</td>
                <td class="px-4 py-3 text-slate-400">{{ p.invoicePeriod ?? '—' }}</td>
                <td class="px-4 py-3 text-slate-300">S/ {{ (p.amountCents / 100).toFixed(2) }}</td>
                <td class="px-4 py-3 text-slate-400">{{ p.method }}</td>
                <td class="px-4 py-3 text-slate-400">{{ p.reference }}</td>
                <td class="px-4 py-3">
                  <span [class]="p.status === 'APPROVED' ? 'rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300' : 'rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300'">
                    {{ p.status }}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-400">{{ p.paidAt }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-500">
                  {{ svc.loading() ? 'Cargando…' : 'No hay pagos registrados.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminPaymentsComponent implements OnInit {
  protected readonly svc = inject(AdminPaymentsService);

  ngOnInit(): void {
    this.svc.loadPayments();
  }
}

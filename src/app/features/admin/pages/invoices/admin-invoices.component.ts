import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminInvoicesService } from '../../services';

@Component({
  selector: 'app-admin-invoices',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Facturas</h1>
          <p class="mt-1 text-sm text-slate-400">Facturación B2B de la plataforma.</p>
        </div>
        <span class="text-xs text-slate-500">{{ svc.invoices().length }} facturas</span>
      </div>

      <div class="mt-4 flex flex-wrap gap-3">
        <select
          [(ngModel)]="statusFilter"
          (change)="applyFilters()"
          class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagada</option>
          <option value="OVERDUE">Vencida</option>
          <option value="CANCELLED">Anulada</option>
        </select>
      </div>

      @if (svc.error(); as err) {
        <div class="mt-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{{ err }}</div>
      }

      @if (selectedInvoice(); as inv) {
        <div class="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-white">Detalle de factura</h3>
            <button (click)="selectedInvoice.set(null)" class="text-xs text-slate-400 hover:text-white">Cerrar</button>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div><span class="text-slate-400">Colegio:</span> <span class="text-white">{{ inv.tenantName }}</span></div>
            <div><span class="text-slate-400">Período:</span> <span class="text-white">{{ inv.period }}</span></div>
            <div><span class="text-slate-400">Estudiantes:</span> <span class="text-white">{{ inv.activeStudents }}</span></div>
            <div><span class="text-slate-400">Total:</span> <span class="text-white">S/ {{ (inv.totalCents / 100).toFixed(2) }}</span></div>
            <div><span class="text-slate-400">Estado:</span> <span class="text-white">{{ inv.status }}</span></div>
            <div><span class="text-slate-400">Vencimiento:</span> <span class="text-white">{{ inv.dueDate }}</span></div>
          </div>
          @if (inv.status === 'PENDING' || inv.status === 'OVERDUE') {
            <div class="mt-4">
              <button (click)="markAsPaid(inv.publicUuid)" class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
                Marcar como pagada
              </button>
            </div>
          }
        </div>
      }

      <div class="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-4 py-3">Colegio</th>
              <th class="px-4 py-3">Período</th>
              <th class="px-4 py-3">Estudiantes</th>
              <th class="px-4 py-3">Total</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Vencimiento</th>
              <th class="px-4 py-3">Pagado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            @for (inv of svc.invoices(); track inv.publicUuid) {
              <tr class="cursor-pointer hover:bg-slate-800/50" (click)="selectInvoice(inv.publicUuid)">
                <td class="px-4 py-3 font-medium text-white">{{ inv.tenantName }}</td>
                <td class="px-4 py-3 text-slate-400">{{ inv.period }}</td>
                <td class="px-4 py-3 text-slate-300">{{ inv.activeStudents }}</td>
                <td class="px-4 py-3 text-slate-300">S/ {{ (inv.totalCents / 100).toFixed(2) }}</td>
                <td class="px-4 py-3">
                  <span [class]="statusClass(inv.status)">{{ inv.status }}</span>
                </td>
                <td class="px-4 py-3 text-slate-400">{{ inv.dueDate }}</td>
                <td class="px-4 py-3 text-slate-400">{{ inv.paidAt ?? '—' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-500">
                  {{ svc.loading() ? 'Cargando…' : 'No hay facturas.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class AdminInvoicesComponent implements OnInit {
  protected readonly svc = inject(AdminInvoicesService);

  protected statusFilter = '';
  protected readonly selectedInvoice = signal<any | null>(null);

  constructor() {
    // Mirror the service's selected invoice signal into our local one
    // so the template can bind to a single source of truth.
    effect(() => this.selectedInvoice.set(this.svc.selectedInvoice()));
  }

  ngOnInit(): void {
    this.svc.loadInvoices();
  }

  protected applyFilters(): void {
    this.svc.loadInvoices({ status: this.statusFilter || undefined });
  }

  protected selectInvoice(uuid: string): void {
    this.svc.loadInvoiceDetail(uuid);
  }

  protected markAsPaid(uuid: string): void {
    this.svc.markAsPaid(uuid, { method: 'CASH', reference: 'Pago manual', notes: 'Marcado por admin' });
  }

  protected statusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300',
      PAID: 'rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300',
      OVERDUE: 'rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-300',
      CANCELLED: 'rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400',
    };
    return map[status] ?? 'rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300';
  }
}

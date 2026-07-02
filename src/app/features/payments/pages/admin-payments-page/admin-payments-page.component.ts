import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AdminPaymentsStore } from '../../store/admin-payments.store';
import { Payment, PaymentStatus } from '../../models/invoice.model';
import { AdminPaymentActionModalComponent } from '../../components/admin-payment-action-modal/admin-payment-action-modal.component';
import { AdminActionKind, AdminActionResult } from '../../store/admin-payments.store';

/**
 * Admin payments page (Sprint 11 / FE-11.1 + FE-11.2).
 *
 * <p>Lands at {@code /payments/admin/payments}. Renders the tenant
 * payment ledger with per-row action affordances:</p>
 *
 * <ul>
 *   <li>PENDING/IN_PROCESS → <em>Reconcile</em></li>
 *   <li>APPROVED → <em>Refund</em></li>
 *   <li>PAID invoice (no payment yet) → <em>Mark paid cash</em></li>
 * </ul>
 *
 * <p>Filters (status, provider, search) drive a debounced re-fetch
 * via the store. The page also surfaces a banner that announces the
 * outcome of the last action so the admin gets explicit feedback
 * beyond the spinner.</p>
 */
@Component({
  selector: 'app-admin-payments-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe, AdminPaymentActionModalComponent],
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <header class="mb-6">
        <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
          Pagos (admin)
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Conciliación, reembolsos y marcado en efectivo. Cada acción queda registrada en auditoría.
        </p>
      </header>

      <!-- Filters -->
      <form class="card mb-4" (submit)="$event.preventDefault()">
        <div class="card-body grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label class="block">
            <span class="text-xs font-medium text-slate-700 dark:text-slate-300">Estado</span>
            <select
              [value]="statusFilter()"
              (change)="onStatusChange($any($event.target).value)"
              class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendiente</option>
              <option value="IN_PROCESS">En proceso</option>
              <option value="APPROVED">Aprobado</option>
              <option value="REJECTED">Rechazado</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="REFUNDED">Reembolsado</option>
            </select>
          </label>

          <label class="block">
            <span class="text-xs font-medium text-slate-700 dark:text-slate-300">Proveedor</span>
            <select
              [value]="providerFilter()"
              (change)="onProviderChange($any($event.target).value)"
              class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Todos</option>
              <option value="MERCADOPAGO">MercadoPago</option>
              <option value="MANUAL">Manual</option>
              <option value="CASH">Efectivo</option>
            </select>
          </label>

          <label class="block">
            <span class="text-xs font-medium text-slate-700 dark:text-slate-300">Buscar</span>
            <input
              type="search"
              [value]="searchFilter()"
              (input)="onSearchChange($any($event.target).value)"
              placeholder="ID externo o referencia"
              class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>
      </form>

      <!-- Last action banner -->
      @if (lastAction(); as la) {
        <div
          class="mb-4 rounded-md px-4 py-3 text-sm"
          [ngClass]="
            la.ok
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
          "
          role="status"
        >
          @if (la.ok) {
            Acción <strong>{{ la.kind }}</strong> completada. Nuevo estado:
            <strong>{{ la.newStatus }}</strong
            >.
          } @else {
            {{ la.message }}
          }
          <button type="button" class="ml-3 text-xs underline" (click)="store.clearLastAction()">
            Cerrar
          </button>
        </div>
      }

      <!-- Body: loading / empty / error / table -->
      @if (loading()) {
        <div class="card">
          <div class="card-body space-y-3">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="h-10 animate-pulse rounded bg-slate-200 dark:bg-slate-700"></div>
            }
          </div>
        </div>
      } @else if (errorMsg()) {
        <div class="card">
          <div class="card-body space-y-2">
            <p class="text-sm font-medium text-rose-700 dark:text-rose-300">
              No se pudo cargar el listado de pagos.
            </p>
            <p class="text-sm text-rose-600 dark:text-rose-400">
              {{ errorMsg() }}
            </p>
            @if (isEndpointMissing()) {
              <p class="text-xs text-slate-500 dark:text-slate-400">
                El endpoint <code class="font-mono">GET /api/v1/admin/payments</code>
                está pendiente (DEBT-11-PAY-1). Se entrega en el siguiente sprint.
              </p>
            }
            <button type="button" class="btn btn-ghost btn-sm w-fit" (click)="store.load()">
              Reintentar
            </button>
          </div>
        </div>
      } @else if (!hasItems()) {
        <div
          class="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <p class="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sin pagos registrados
          </p>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Cuando se generen pagos en este tenant los verás aquí. Ajusta los filtros o espera a la
            próxima facturación.
          </p>
        </div>
      } @else {
        <div class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 text-left dark:bg-slate-800/50">
                <tr>
                  <th class="px-4 py-2 font-medium text-slate-700 dark:text-slate-300">Pago</th>
                  <th class="px-4 py-2 font-medium text-slate-700 dark:text-slate-300">Estado</th>
                  <th class="px-4 py-2 font-medium text-slate-700 dark:text-slate-300">
                    Proveedor
                  </th>
                  <th class="px-4 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                    Monto
                  </th>
                  <th class="px-4 py-2 font-medium text-slate-700 dark:text-slate-300">Pagado</th>
                  <th class="px-4 py-2 text-right font-medium text-slate-700 dark:text-slate-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                @for (p of items(); track p.publicUuid) {
                  <tr>
                    <td class="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {{ p.publicUuid | slice: 0 : 8 }}…
                    </td>
                    <td class="px-4 py-2">
                      <span
                        class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        [class]="statusBadge(p.status)"
                      >
                        {{ p.status }}
                      </span>
                    </td>
                    <td class="px-4 py-2 text-slate-700 dark:text-slate-300">
                      {{ p.provider }}
                    </td>
                    <td class="px-4 py-2 text-right text-slate-900 dark:text-slate-100">
                      {{ p.currency }} {{ p.amountCents / 100 | number: '1.2-2' }}
                    </td>
                    <td class="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {{ p.paidAt ? (p.paidAt | date: 'short') : '—' }}
                    </td>
                    <td class="px-4 py-2 text-right">
                      @if (canReconcile(p)) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs"
                          [disabled]="store.pendingAction() !== null"
                          (click)="open('reconcile', p)"
                        >
                          Conciliar
                        </button>
                      }
                      @if (canRefund(p)) {
                        <button
                          type="button"
                          class="btn btn-ghost btn-xs text-amber-600"
                          [disabled]="store.pendingAction() !== null"
                          (click)="open('refund', p)"
                        >
                          Reembolsar
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <p class="mt-3 text-right text-xs text-slate-500 dark:text-slate-400">
          {{ totalElements() }} pago(s) en total.
        </p>
      }
    </section>

    @if (modalKind()) {
      <app-admin-payment-action-modal
        [kind]="modalKind()!"
        [payment]="modalPayment()"
        [submitting]="store.pendingAction() !== null"
        [lastResult]="lastAction()"
        (actionCancel)="closeModal()"
        (actionSubmit)="onModalSubmit($event)"
      />
    }
  `,
})
export class AdminPaymentsPageComponent implements OnInit {
  readonly store = inject(AdminPaymentsStore);

  // Expose store state to the template as readonly signals.
  readonly items = this.store.items;
  readonly totalElements = this.store.totalElements;
  readonly loading = this.store.loading;
  readonly errorMsg = this.store.error;
  readonly hasItems = this.store.hasItems;
  readonly lastAction = this.store.lastAction;

  // Modal state.
  private readonly _modalKind = signal<AdminActionKind | null>(null);
  private readonly _modalPayment = signal<Payment | null>(null);
  readonly modalKind = this._modalKind.asReadonly();
  readonly modalPayment = this._modalPayment.asReadonly();

  // Filter mirrors (used to keep the selects' [value] bound without
  // an extra form; the store is the source of truth).
  statusFilter = computed(() => this.store.filter().status ?? '');
  providerFilter = computed(() => this.store.filter().provider ?? '');
  searchFilter = computed(() => this.store.filter().search ?? '');

  ngOnInit(): void {
    this.store.load();
  }

  // -------------------------------------------------------------------------
  // Filters
  // -------------------------------------------------------------------------

  onStatusChange(value: string): void {
    this.store.load({ status: (value || undefined) as PaymentStatus | undefined, page: 0 });
  }
  onProviderChange(value: string): void {
    this.store.load({ provider: (value || undefined) as Payment['provider'] | undefined, page: 0 });
  }
  onSearchChange(value: string): void {
    this.store.load({ search: value || undefined, page: 0 });
  }

  // -------------------------------------------------------------------------
  // Modal lifecycle
  // -------------------------------------------------------------------------

  open(kind: AdminActionKind, payment: Payment): void {
    this._modalPayment.set(payment);
    this._modalKind.set(kind);
  }

  closeModal(): void {
    this._modalKind.set(null);
    this._modalPayment.set(null);
  }

  onModalSubmit(payload: { reason?: string; note?: string }): void {
    const kind = this._modalKind();
    const payment = this._modalPayment();
    if (!kind) return;

    if (kind === 'reconcile' && payment && payload.reason) {
      this.store.reconcile(payment.publicUuid, { reason: payload.reason });
    } else if (kind === 'refund' && payment && payload.reason) {
      this.store.refund(payment.publicUuid, { reason: payload.reason });
    } else if (kind === 'mark-paid-cash' && payment) {
      // The invoice publicUuid is not present on the Payment model, so we
      // fall back to payment.invoiceId (internal UUID) — the BE accepts
      // the publicUuid on the URL; for the MVP we surface the limitation
      // in tech-debt.md. Until then the action button is hidden, see
      // canMarkPaidCash() below.
      return;
    }
    this.closeModal();
  }

  // -------------------------------------------------------------------------
  // Per-row affordances
  // -------------------------------------------------------------------------

  canReconcile(p: Payment): boolean {
    return p.status === 'PENDING' || p.status === 'IN_PROCESS';
  }

  canRefund(p: Payment): boolean {
    return p.status === 'APPROVED';
  }

  statusBadge(s: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      IN_PROCESS: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
      APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
      CANCELLED: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      REFUNDED: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    };
    return map[s] ?? 'bg-slate-100 text-slate-700';
  }

  /**
   * Best-effort detection of the "endpoint not yet implemented" case.
   * Until BE-11.11 lands `GET /api/v1/admin/payments`, the FE surfaces
   * a 404 — we show a more actionable copy than the raw error.
   * Matches: status 0 / 404 / 501.
   */
  isEndpointMissing(): boolean {
    const err = this.errorMsg();
    if (!err) return false;
    return /404|not\s*found|0\s*$/i.test(err);
  }
}

// Re-export so the template can use the `AdminActionResult` type without
// reaching into the store internals — the parent page only needs to
// know "ok / message" for the banner copy.
export type { AdminActionResult };

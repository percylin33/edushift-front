import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PaymentsApiService } from '../../services/payments-api.service';
import {
  Invoice,
  InvoiceItem,
  Payment,
  STATUS_BADGE,
  STATUS_LABELS,
  formatMoney,
} from '../../models/invoice.model';

/**
 * Invoice detail + checkout (Sprint 10 / FE-10.1).
 *
 * <p>Shows the invoice breakdown, a list of payment attempts, and
 * a "Pagar con MercadoPago" button that calls
 * {@code POST /payments/invoices/{uuid}/checkout} and opens the
 * returned {@code init_point} in a new tab.</p>
 */
@Component({
  selector: 'app-invoice-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <a routerLink="/payments/invoices" class="text-sm text-slate-500 hover:text-slate-700"
        >← Mis cuotas</a
      >

      @if (invoice(); as i) {
        <article
          class="mt-4 rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <header class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Cuota {{ i.periodLabel }}
              </h1>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Vence {{ i.dueAt | date: 'longDate' }}
              </p>
            </div>
            <span
              class="inline-flex items-center rounded-full px-3 py-1 text-xs
                         font-medium {{ badgeClass(i.status) }}"
            >
              {{ statusLabel(i.status) }}
            </span>
          </header>

          <table class="mt-6 w-full text-sm">
            <thead class="text-left text-xs uppercase text-slate-500 dark:text-slate-400">
              <tr>
                <th class="pb-2">Descripción</th>
                <th class="pb-2 text-right">Cant.</th>
                <th class="pb-2 text-right">Unitario</th>
                <th class="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (it of i.items; track it.id) {
                <tr>
                  <td class="py-2 text-slate-800 dark:text-slate-200">{{ it.description }}</td>
                  <td class="py-2 text-right text-slate-600 dark:text-slate-300">
                    {{ it.quantity }}
                  </td>
                  <td class="py-2 text-right text-slate-600 dark:text-slate-300">
                    {{ money(it.unitAmountCents, i.currency) }}
                  </td>
                  <td class="py-2 text-right font-semibold text-slate-800 dark:text-slate-100">
                    {{ money(it.lineTotalCents, i.currency) }}
                  </td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" class="pt-4 text-right text-slate-500 dark:text-slate-400">
                  Total
                </td>
                <td class="pt-4 text-right text-xl font-bold text-slate-900 dark:text-slate-100">
                  {{ money(i.totalCents, i.currency) }}
                </td>
              </tr>
            </tfoot>
          </table>

          @if (canPay()) {
            <div class="mt-6 flex justify-end">
              <button
                type="button"
                (click)="onPay()"
                [disabled]="paying()"
                class="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                @if (paying()) {
                  Abriendo MercadoPago…
                } @else {
                  Pagar con MercadoPago
                }
              </button>
            </div>
          }

          @if (errorMsg()) {
            <p class="mt-3 text-sm text-rose-600">{{ errorMsg() }}</p>
          }
        </article>

        @if (payments().length > 0) {
          <section
            class="mt-6 rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          >
            <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
              Intentos de pago
            </h2>
            <ul class="mt-3 space-y-2 text-sm">
              @for (p of payments(); track p.publicUuid) {
                <li
                  class="flex items-center justify-between border-b border-slate-100 pb-2 last:border-b-0 dark:border-slate-800"
                >
                  <div>
                    <span class="font-medium text-slate-800 dark:text-slate-200">
                      {{ p.provider }} · {{ p.status }}
                    </span>
                    @if (p.externalId) {
                      <span class="ml-2 text-xs text-slate-500"> MP #{{ p.externalId }} </span>
                    }
                    @if (p.failureReason) {
                      <p class="text-xs text-rose-600">{{ p.failureReason }}</p>
                    }
                  </div>
                  <div class="text-right text-slate-700 dark:text-slate-200">
                    <div>{{ money(p.amountCents, p.currency) }}</div>
                    <div class="text-xs text-slate-500">
                      {{ p.createdAt | date: 'short' }}
                    </div>
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      } @else if (loading()) {
        <div
          class="mt-4 animate-pulse rounded-2xl bg-white p-6 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <div class="mb-4 h-5 w-1/3 rounded bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700"></div>
        </div>
      } @else {
        <p class="mt-4 text-sm text-rose-600">{{ errorMsg() ?? 'Cuota no encontrada' }}</p>
      }
    </section>
  `,
})
export class InvoiceDetailPageComponent implements OnInit {
  private readonly api = inject(PaymentsApiService);
  private readonly route = inject(ActivatedRoute);

  readonly invoice = signal<Invoice | null>(null);
  readonly items = signal<InvoiceItem[]>([]);
  readonly payments = signal<Payment[]>([]);
  readonly loading = signal(true);
  readonly paying = signal(false);
  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    const publicUuid = this.route.snapshot.paramMap.get('publicUuid');
    if (!publicUuid) {
      this.errorMsg.set('UUID inválido');
      this.loading.set(false);
      return;
    }

    this.api.getInvoice(publicUuid).subscribe({
      next: (i) => {
        this.invoice.set(i);
        this.items.set(i.items);
        this.loading.set(false);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.message ?? 'No se pudo cargar la cuota');
        this.loading.set(false);
      },
    });
    this.api.listPaymentsForInvoice(publicUuid).subscribe({
      next: (ps) => this.payments.set(ps),
      error: () => {
        /* non-blocking */
      },
    });
  }

  canPay(): boolean {
    const i = this.invoice();
    return !!i && (i.status === 'PENDING' || i.status === 'OVERDUE');
  }

  onPay(): void {
    const i = this.invoice();
    if (!i) return;
    this.paying.set(true);
    this.errorMsg.set(null);
    this.api.checkout(i.publicUuid).subscribe({
      next: (resp) => {
        this.paying.set(false);
        // Open the MP checkout in a new tab; on return the user
        // refreshes and the webhook (handled in BE) will have
        // updated the invoice.
        window.open(resp.initPoint, '_blank', 'noopener,noreferrer');
      },
      error: (e) => {
        this.paying.set(false);
        this.errorMsg.set(e?.error?.message ?? 'No se pudo iniciar el pago');
      },
    });
  }

  statusLabel(s: Invoice['status']) {
    return STATUS_LABELS[s];
  }
  badgeClass(s: Invoice['status']) {
    return STATUS_BADGE[s];
  }
  money(cents: number, c: string) {
    return formatMoney(cents, c);
  }
}

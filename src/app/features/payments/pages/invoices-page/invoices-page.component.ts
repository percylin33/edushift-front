import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PaymentsApiService } from '../../services/payments-api.service';
import { Invoice, STATUS_BADGE, STATUS_LABELS, formatMoney } from '../../models/invoice.model';

/**
 * Invoices list (Sprint 10 / FE-10.1).
 *
 * <p>Guardian-facing: shows all invoices for the current user
 * (PENDING, PAID, OVERDUE, etc.). Click an invoice to see detail
 * + start a checkout flow.</p>
 */
@Component({
  selector: 'app-invoices-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Mis cuotas</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Historial de pagos y cuotas pendientes.
        </p>
      </header>

      @if (loading()) {
        <div class="space-y-3">
          @for (i of [1, 2, 3]; track i) {
            <div
              class="animate-pulse rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div class="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700"></div>
              <div class="h-3 w-full rounded bg-slate-200 dark:bg-slate-700"></div>
            </div>
          }
        </div>
      } @else if (items().length === 0) {
        <div
          class="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Aún no tienes cuotas registradas.
          </p>
        </div>
      } @else {
        <ul class="space-y-3">
          @for (i of items(); track i.publicUuid) {
            <li>
              <a
                [routerLink]="['/payments/invoices', i.publicUuid]"
                class="block rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 transition hover:ring-emerald-500 dark:bg-slate-900 dark:ring-slate-800"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Cuota {{ i.periodLabel }}
                    </h2>
                    <div
                      class="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                    >
                      <span>Emitida {{ i.issuedAt | date: 'longDate' }}</span>
                      <span>·</span>
                      <span>Vence {{ i.dueAt | date: 'longDate' }}</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {{ money(i.totalCents, i.currency) }}
                    </p>
                    <span
                      class="mt-1 inline-flex items-center rounded-full px-2 py-0.5
                                 text-xs font-medium {{ badgeClass(i.status) }}"
                    >
                      {{ statusLabel(i.status) }}
                    </span>
                  </div>
                </div>
              </a>
            </li>
          }
        </ul>
      }

      @if (errorMsg()) {
        <p class="mt-4 text-sm text-rose-600">{{ errorMsg() }}</p>
      }
    </section>
  `,
})
export class InvoicesPageComponent implements OnInit {
  private readonly api = inject(PaymentsApiService);

  readonly items = signal<Invoice[]>([]);
  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  ngOnInit(): void {
    this.api.listMyInvoices().subscribe({
      next: (page) => {
        this.items.set(page.content);
        this.loading.set(false);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.message ?? 'No se pudieron cargar las cuotas');
        this.loading.set(false);
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

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeInvoice } from '../../models/me-invoice.model';
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-payments',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a
        routerLink="/me/profile"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mi perfil</span>
      </a>
      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mis pagos</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Estado de tu cuenta. Sube el voucher de pago o descarga el comprobante cuando esté pagada.
        </p>
      </header>

      @if (loading()) {
        <div class="mt-8 space-y-3" aria-label="Cargando pagos">
          @for (item of [1, 2, 3]; track item) {
            <div class="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (invoices().length === 0) {
        <div
          class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sin facturas
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Cuando el colegio emita una cuota, aparecerá aquí.
          </p>
        </div>
      } @else {
        <div class="mt-8 grid gap-4">
          @for (invoice of invoices(); track invoice.publicUuid) {
            <article
              class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {{ invoice.periodLabel }}
                  </h2>
                  <p class="text-sm text-slate-500">
                    Vence:
                    {{ invoice.dueAt ? (invoice.dueAt | date: 'dd/MM/yyyy') : '—' }}
                  </p>
                </div>
                <div class="text-left sm:text-right">
                  <p class="text-xl font-bold text-slate-900 dark:text-slate-100">
                    {{ formatMoney(invoice) }}
                  </p>
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {{ invoice.status }}
                  </p>
                  @if (canPay(invoice.status)) {
                    <a
                      [routerLink]="['/payments/invoices', invoice.publicUuid]"
                      class="mt-2 inline-block text-sm font-semibold text-emerald-700"
                    >
                      Subir voucher
                    </a>
                  }
                  @if (invoice.status === 'PENDING_REVIEW') {
                    <a
                      [routerLink]="['/payments/invoices', invoice.publicUuid]"
                      class="mt-2 inline-block text-sm font-semibold text-sky-700"
                    >
                      En revisión
                    </a>
                  }
                  @if (invoice.status === 'PAID') {
                    <a
                      [routerLink]="['/payments/invoices', invoice.publicUuid]"
                      class="mt-2 inline-block text-sm font-semibold text-indigo-600"
                    >
                      Ver comprobante
                    </a>
                  }
                </div>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class MePaymentsPageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly invoices = signal<MeInvoice[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listPayments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.invoices.set(response.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar tus pagos.');
          this.loading.set(false);
        },
      });
  }

  formatMoney(invoice: MeInvoice): string {
    const amount = (invoice.totalCents ?? 0) / 100;
    return `${invoice.currency || 'PEN'} ${amount.toFixed(2)}`;
  }

  canPay(status: string): boolean {
    return status === 'PENDING' || status === 'OVERDUE';
  }
}

import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FamilyPaymentItem } from '../../models/family-activity.model';
import { FamilyApiService } from '../../services/family-api.service';

@Component({
  selector: 'app-family-child-payments-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a [routerLink]="['/family/children', studentPublicUuid()]" class="text-sm font-semibold text-indigo-600">
        ← Volver al resumen
      </a>
      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Familia</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Pagos</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Estado de cuenta del hijo. Puedes pagar las cuotas pendientes o descargar el comprobante.
        </p>
        <a
          [routerLink]="['/payments/invoices']"
          [queryParams]="{ student: studentPublicUuid() }"
          class="mt-3 inline-block text-sm font-semibold text-indigo-600"
        >
          Ver todas las cuotas
        </a>
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
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">Reintentar</button>
        </div>
      } @else if (items().length === 0) {
        <div class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700">
          <h2 class="text-lg font-semibold">Sin facturas</h2>
          <p class="mt-2 text-sm text-slate-600">Cuando el colegio emita una cuota, aparecerá aquí.</p>
        </div>
      } @else {
        <div class="mt-8 grid gap-4">
          @for (invoice of items(); track invoice.publicUuid) {
            <article class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <div>
                  <h2 class="text-lg font-semibold">{{ invoice.periodLabel }}</h2>
                  <p class="text-sm text-slate-500">
                    Vence: {{ invoice.dueAt ? (invoice.dueAt | date: 'dd/MM/yyyy') : '—' }}
                  </p>
                </div>
                <div class="sm:text-right">
                  <p class="text-xl font-bold">{{ formatMoney(invoice) }}</p>
                  <p class="text-xs font-semibold uppercase text-slate-500">{{ invoice.status }}</p>
                  @if (canPay(invoice.status)) {
                    <a
                      [routerLink]="['/payments/invoices', invoice.publicUuid]"
                      class="mt-2 inline-block text-sm font-semibold text-emerald-700"
                    >
                      Pagar
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
export class FamilyChildPaymentsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(FamilyApiService);

  readonly studentPublicUuid = signal(this.route.snapshot.paramMap.get('studentPublicUuid') ?? '');
  readonly items = signal<FamilyPaymentItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const uuid = this.studentPublicUuid();
    if (!uuid) {
      this.error.set('No se encontró el estudiante solicitado.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.getChildPayments(uuid).subscribe({
      next: (response) => {
        this.items.set(response.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los pagos.');
        this.loading.set(false);
      },
    });
  }

  formatMoney(invoice: FamilyPaymentItem): string {
    return `${invoice.currency || 'PEN'} ${(invoice.totalCents / 100).toFixed(2)}`;
  }

  canPay(status: string): boolean {
    return status === 'PENDING' || status === 'OVERDUE';
  }
}

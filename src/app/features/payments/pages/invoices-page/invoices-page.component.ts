import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import { FamilyApiService, FamilyChildSummary } from '@features/family/services/family-api.service';
import { PaymentsApiService } from '../../services/payments-api.service';
import { Invoice, STATUS_BADGE, STATUS_LABELS, formatMoney } from '../../models/invoice.model';

@Component({
  selector: 'app-invoices-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
      <header class="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-medium text-primary-700 dark:text-primary-300">Mi espacio <span class="mx-1 text-slate-400">›</span> Mis pagos</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Mis pagos y cuotas</h1>
          <p class="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">Consulta el estado de tus cuotas, fechas de vencimiento y comprobantes.</p>
        </div>
        @if (children().length > 1) {
          <label class="block text-sm font-medium text-slate-700 dark:text-slate-200">
            Ver cuotas de
            <select class="mt-1 block w-full min-w-52 rounded-xl border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900" [value]="selectedStudent()" (change)="onStudentChange($event)">
              <option value="">Todos los hijos</option>
              @for (child of children(); track child.publicUuid) { <option [value]="child.publicUuid">{{ child.fullName }}</option> }
            </select>
          </label>
        }
      </header>

      @if (loading()) {
        <div class="grid gap-4 sm:grid-cols-3" aria-label="Cargando resumen de pagos">
          @for (i of [1, 2, 3]; track i) {
            <div class="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><div class="mb-4 h-3 w-28 rounded bg-slate-200 dark:bg-slate-700"></div><div class="h-7 w-36 rounded bg-slate-200 dark:bg-slate-700"></div></div>
          }
        </div>
        <div class="mt-6 h-64 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      } @else if (errorMsg()) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{{ errorMsg() }}</div>
      } @else {
        <div class="mb-6 grid gap-4 sm:grid-cols-3">
          <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cuotas registradas</p>
            <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{{ visibleItems().length }}</p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">En tu historial de pagos</p>
          </article>
          <article class="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
            <p class="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Pagadas</p>
            <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{{ paidCount() }}</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ money(paidTotal(), 'PEN') }} registrados</p>
          </article>
          <article class="rounded-2xl border border-primary-200 bg-primary-50/70 p-5 dark:border-primary-900 dark:bg-primary-950/20">
            <p class="text-xs font-semibold uppercase tracking-wide text-primary-800 dark:text-primary-300">Pendientes de pago</p>
            <p class="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{{ pendingCount() }}</p>
            <p class="mt-1 text-sm text-slate-600 dark:text-slate-400">{{ money(pendingTotal(), 'PEN') }} por regularizar</p>
          </article>
        </div>

        <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div class="flex flex-col gap-1 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
            <div><h2 class="text-lg font-semibold text-slate-950 dark:text-white">Historial de cuotas</h2><p class="text-sm text-slate-500 dark:text-slate-400">Detalle de vencimientos y estado de tus pagos.</p></div>
            <span class="w-fit rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ visibleItems().length }} {{ visibleItems().length === 1 ? 'registro' : 'registros' }}</span>
          </div>
          @if (visibleItems().length === 0) {
            <div class="px-6 py-14 text-center">
              <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-hidden="true">▤</div>
              <h3 class="mt-4 font-semibold text-slate-900 dark:text-white">Aún no tienes cuotas registradas</h3>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Cuando el colegio emita una cuota, aparecerá en este historial.</p>
            </div>
          } @else {
            <div class="hidden overflow-x-auto md:block">
              <table class="w-full min-w-[700px] text-left text-sm">
                <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400"><tr><th scope="col" class="px-5 py-3">Periodo / concepto</th><th scope="col" class="px-5 py-3">Vencimiento</th><th scope="col" class="px-5 py-3">Importe</th><th scope="col" class="px-5 py-3">Estado</th><th scope="col" class="px-5 py-3 text-right">Detalle</th></tr></thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                  @for (i of visibleItems(); track i.publicUuid) {
                    <tr class="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td class="px-5 py-4"><p class="font-semibold text-slate-900 dark:text-slate-100">{{ i.periodLabel }}</p><p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Emitida {{ i.issuedAt | date: 'dd MMM yyyy' }}</p></td>
                      <td class="px-5 py-4 text-slate-600 dark:text-slate-300">{{ i.dueAt | date: 'dd MMM yyyy' }}</td>
                      <td class="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">{{ money(amountForDisplay(i), i.currency) }}
                        @if ((i.advanceAppliedCents ?? 0) > 0 && i.status !== 'PAID') { <span class="mt-1 block text-xs font-normal text-slate-500">Saldo luego del anticipo</span> }
                      </td>
                      <td class="px-5 py-4"><span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold {{ badgeClass(i.status) }}"><span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{{ statusLabel(i.status) }}</span></td>
                      <td class="px-5 py-4 text-right"><a [routerLink]="['/payments/invoices', i.publicUuid]" class="inline-flex min-h-9 items-center rounded-lg bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:bg-primary-950/50 dark:text-primary-300 dark:hover:bg-primary-900/60">{{ actionLabel(i.status) }} <span class="ml-1" aria-hidden="true">→</span></a></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <ul class="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              @for (i of visibleItems(); track i.publicUuid) {
                <li class="p-4"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="truncate font-semibold text-slate-900 dark:text-slate-100">{{ i.periodLabel }}</h3><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Vence {{ i.dueAt | date: 'dd MMM yyyy' }}</p></div><p class="shrink-0 text-right font-bold text-slate-900 dark:text-slate-100">{{ money(amountForDisplay(i), i.currency) }}@if ((i.advanceAppliedCents ?? 0) > 0 && i.status !== 'PAID') {<span class="mt-1 block text-xs font-normal text-slate-500">Saldo</span>}</p></div><div class="mt-3 flex items-center justify-between gap-3"><span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold {{ badgeClass(i.status) }}"><span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>{{ statusLabel(i.status) }}</span><a [routerLink]="['/payments/invoices', i.publicUuid]" class="text-sm font-semibold text-primary-700 dark:text-primary-300">{{ actionLabel(i.status) }} →</a></div></li>
              }
            </ul>
          }
          <div class="flex flex-col gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-400 sm:flex-row sm:items-center"><span class="inline-flex items-center gap-2"><span class="text-emerald-700 dark:text-emerald-400" aria-hidden="true">✓</span>Los comprobantes disponibles se consultan desde el detalle de cada cuota.</span></div>
        </section>
      }
    </section>
  `,
})
export class InvoicesPageComponent implements OnInit {
  private readonly api = inject(PaymentsApiService);
  private readonly familyApi = inject(FamilyApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly items = signal<Invoice[]>([]);
  readonly children = signal<FamilyChildSummary[]>([]);
  readonly selectedStudent = signal('');
  readonly loading = signal(true);
  readonly errorMsg = signal<string | null>(null);

  readonly visibleItems = computed(() => {
    const selected = this.selectedStudent();
    const all = this.items();
    if (!selected) return all;
    return all.filter((invoice) => invoice.studentId === selected);
  });

  readonly paidItems = computed(() => this.visibleItems().filter((invoice) => invoice.status === 'PAID'));
  readonly pendingItems = computed(() =>
    this.visibleItems().filter((invoice) => invoice.status === 'PENDING' || invoice.status === 'OVERDUE'),
  );
  readonly paidCount = computed(() => this.paidItems().length);
  readonly pendingCount = computed(() => this.pendingItems().length);
  readonly paidTotal = computed(() => this.paidItems().reduce((total, invoice) => total + invoice.totalCents, 0));
  readonly pendingTotal = computed(() =>
    this.pendingItems().reduce((total, invoice) => total + (invoice.balanceCents ?? invoice.totalCents), 0),
  );

  ngOnInit(): void {
    const fromQuery = this.route.snapshot.queryParamMap.get('student') ?? '';
    this.selectedStudent.set(fromQuery);
    this.api.listMyInvoices(0, 100).subscribe({
      next: (page) => {
        this.items.set(page.content ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.message ?? 'No se pudieron cargar las cuotas');
        this.loading.set(false);
      },
    });
    if (this.auth.hasRole(UserRole.Parent)) {
      this.familyApi.listChildren().subscribe({
        next: (response) => this.children.set(response.data ?? []),
        error: () => this.children.set([]),
      });
    }
  }

  statusLabel(s: Invoice['status']) {
    return STATUS_LABELS[s];
  }
  actionLabel(s: Invoice['status']): string {
    if (s === 'PENDING' || s === 'OVERDUE') return 'Ver y pagar';
    if (s === 'PAID') return 'Ver comprobante';
    return 'Ver detalle';
  }
  onStudentChange(event: Event): void {
    this.selectedStudent.set((event.target as HTMLSelectElement).value);
  }
  badgeClass(s: Invoice['status']) {
    return STATUS_BADGE[s];
  }
  money(cents: number, c: string) {
    return formatMoney(cents, c);
  }
  amountForDisplay(invoice: Invoice): number {
    return invoice.status === 'PAID'
      ? invoice.totalCents
      : (invoice.balanceCents ?? invoice.totalCents);
  }
}

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
    <section class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">Mis cuotas</h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Historial de pagos y cuotas pendientes.
        </p>
      </header>

      @if (children().length > 1) {
        <label class="mb-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
          Hijo
          <select
            class="mt-1 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            [value]="selectedStudent()"
            (change)="selectedStudent.set($any($event.target).value)"
          >
            <option value="">Todos</option>
            @for (child of children(); track child.publicUuid) {
              <option [value]="child.publicUuid">{{ child.fullName }}</option>
            }
          </select>
        </label>
      }

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
      } @else if (visibleItems().length === 0) {
        <div
          class="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Aún no tienes cuotas registradas.
          </p>
        </div>
      } @else {
        <ul class="space-y-3">
          @for (i of visibleItems(); track i.publicUuid) {
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
  badgeClass(s: Invoice['status']) {
    return STATUS_BADGE[s];
  }
  money(cents: number, c: string) {
    return formatMoney(cents, c);
  }
}

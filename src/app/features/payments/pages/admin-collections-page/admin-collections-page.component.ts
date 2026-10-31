import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@core/services';
import { Permission } from '@core/enums';
import { AdminInvoicesPageComponent } from '../admin-invoices-page/admin-invoices-page.component';
import { AdminEmitPageComponent } from '../admin-emit-page/admin-emit-page.component';

type CollectionsTab = 'payments' | 'generate';

@Component({
  selector: 'app-admin-collections-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, AdminInvoicesPageComponent, AdminEmitPageComponent],
  template: `
    <main class="mx-auto max-w-6xl px-4 pb-8 pt-8 sm:pb-10 sm:pt-10">
      <header class="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">Cobros</h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ reconciliationOnly() ? 'Revisa los vouchers enviados por las familias.' : 'Registra pagos recibidos y genera cuotas pendientes.' }}
          </p>
        </div>
        @if (canReadPayments()) {
          <a routerLink="/payments/admin/payments" class="text-sm font-semibold text-indigo-600">
            Ver historial de pagos
          </a>
        }
      </header>

      <nav
        class="mb-6 flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800"
        aria-label="Operaciones de cobro"
        role="tablist"
      >
        @if (canReviewPayments()) {
          <a
            routerLink="/payments/admin/invoices"
            role="tab"
            id="collections-payments-tab"
            aria-controls="collections-tab-panel"
            [attr.aria-selected]="isTabSelected('payments')"
            [class]="tabClass(isTabSelected('payments'))"
          >
            {{ canReadPayments() ? 'Registrar y conciliar pagos' : 'Revisar vouchers' }}
          </a>
        }
        @if (canGenerateInvoices()) {
          <a
            routerLink="/payments/admin/emit"
            role="tab"
            id="collections-generate-tab"
            aria-controls="collections-tab-panel"
            [attr.aria-selected]="isTabSelected('generate')"
            [class]="tabClass(isTabSelected('generate'))"
          >
            Generar cuotas
          </a>
        }
      </nav>

      <div
        id="collections-tab-panel"
        role="tabpanel"
        [attr.aria-labelledby]="showPaymentTab() ? 'collections-payments-tab' : 'collections-generate-tab'"
      >
        @if (showPaymentTab()) {
          <app-admin-invoices-page />
        } @else if (canGenerateInvoices()) {
          <app-admin-emit-page />
        }
      </div>
    </main>
  `,
})
export class AdminCollectionsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  readonly activeTab = signal<CollectionsTab>('payments');

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.activeTab.set(data['collectionsTab'] === 'generate' ? 'generate' : 'payments');
    });
  }

  canReadPayments(): boolean {
    return this.auth.hasPermission(Permission.PaymentsReadGranular, Permission.LmsPaymentAdmin);
  }

  canGenerateInvoices(): boolean {
    return this.auth.hasPermission(Permission.PaymentsIssue, Permission.LmsPaymentAdmin);
  }

  showPaymentTab(): boolean {
    return this.isTabSelected('payments');
  }

  isTabSelected(tab: CollectionsTab): boolean {
    const selected = this.canReviewPayments() ? this.activeTab() : 'generate';
    return selected === tab;
  }

  canReviewPayments(): boolean {
    return this.auth.hasPermission(
      Permission.PaymentsReadGranular,
      Permission.PaymentsReconcile,
      Permission.LmsPaymentAdmin,
    );
  }

  reconciliationOnly(): boolean {
    return !this.canReadPayments() && this.auth.hasPermission(Permission.PaymentsReconcile);
  }

  tabClass(selected: boolean): string {
    return selected
      ? 'border-b-2 border-indigo-600 px-3 py-3 text-sm font-semibold text-indigo-700 dark:text-indigo-300'
      : 'border-b-2 border-transparent px-3 py-3 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white';
  }
}

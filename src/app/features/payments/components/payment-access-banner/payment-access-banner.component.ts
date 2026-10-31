import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { ROUTES } from '@core/constants';
import { PaymentsApiService } from '../../services/payments-api.service';

/**
 * Sticky soft-gate banner for PARENT/STUDENT when LMS is restricted
 * due to overdue tuition ({@code GET /payments/access-status}).
 */
@Component({
  selector: 'app-payment-access-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  template: `
    @if (show()) {
      <div
        class="sticky top-0 z-40 flex items-center justify-center gap-2 bg-rose-600 px-4 py-2 text-center text-xs font-medium text-white sm:text-sm"
        role="status"
        data-testid="payment-access-banner"
      >
        <span>Acceso limitado por cuota vencida</span>
        <a
          [routerLink]="invoicesRoute"
          class="underline decoration-white/80 underline-offset-2 hover:decoration-white"
        >
          Ver mis cuotas
        </a>
      </div>
    }
  `,
})
export class PaymentAccessBannerComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly payments = inject(PaymentsApiService);

  readonly show = signal(false);
  readonly invoicesRoute = ROUTES.PAYMENTS.INVOICES;

  ngOnInit(): void {
    const roles = this.auth.roles();
    const isGuardian =
      roles.includes(UserRole.Parent) || roles.includes(UserRole.Student);
    if (!isGuardian || !this.auth.isAuthenticated()) {
      return;
    }
    this.payments.getAccessStatus().subscribe({
      next: (s) => this.show.set(!!s?.lmsRestricted),
      error: () => this.show.set(false),
    });
  }
}

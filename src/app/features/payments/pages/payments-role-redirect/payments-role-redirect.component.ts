import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';

/**
 * Role-aware entry-point for {@code /payments}
 * (FIX BUG-2026-07-30-07).
 *
 * <p>{@code InvoicesPageComponent} is a guardian-facing screen that
 * calls {@code GET /payments/invoices} (the current user's own
 * invoices); for {@code TENANT_ADMIN} that endpoint either fails
 * ("Failed to fetch") or returns an empty list, and the copy
 * ("Mis cuotas") is wrong for the admin. This resolver picks the
 * right entry-point per role:</p>
 * <ul>
 *   <li>TENANT_ADMIN / STAFF → {@code /payments/admin/invoices}
 *       (voucher review queue, gated by {@code LMS_PAYMENT_ADMIN}).</li>
 *   <li>STUDENT / PARENT → {@code /payments/invoices}.</li>
 *   <li>Anything else → {@code /dashboard}.</li>
 * </ul>
 *
 * <p>Implemented as a tiny component rather than a {@code resolve} /
 * {@code canActivate} function so the redirect can wait for the
 * {@code AuthService} to resolve asynchronously on first paint.</p>
 */
@Component({
  selector: 'app-payments-role-redirect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class PaymentsRoleRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const roles = this.auth.roles();

    if (roles.includes(UserRole.TenantAdmin) || roles.includes(UserRole.Staff)) {
      await this.router.navigateByUrl('/payments/admin/invoices');
      return;
    }

    if (roles.includes(UserRole.Student) || roles.includes(UserRole.Parent)) {
      await this.router.navigateByUrl('/payments/invoices');
      return;
    }

    await this.router.navigateByUrl('/dashboard');
  }
}

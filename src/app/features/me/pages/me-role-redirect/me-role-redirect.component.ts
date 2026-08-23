import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';

/**
 * Role-aware entry-point for {@code /me}
 * (FIX BUG-2026-07-30-11 follow-up).
 *
 * <p>STUDENT lands on {@code /me/profile} (the rich student profile
 * with ME_* sub-sections). Any other authenticated role is sent to
 * {@code /profile} (the global profile page) because {@code /me/*} is
 * intentionally STUDENT-only and would otherwise 403 them.</p>
 */
@Component({
  selector: 'app-me-role-redirect',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class MeRoleRedirectComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const roles = this.auth.roles();
    if (roles.includes(UserRole.Student)) {
      await this.router.navigateByUrl('/me/profile');
      return;
    }
    await this.router.navigateByUrl('/profile');
  }
}

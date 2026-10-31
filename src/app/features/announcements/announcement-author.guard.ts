import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Permission, UserRole } from '@core/enums';
import { AuthService } from '@core/services';

/**
 * Students never open the composer, even if a permission override is present
 * in the client session. Everyone else needs the school-wide or teacher-scoped
 * authoring permission. Denied callers land back on the list.
 */
export const announcementAuthorGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const list = router.createUrlTree(['/announcements']);
  if (auth.hasRole(UserRole.Student)) return list;
  const canAuthor =
    auth.hasPermission(Permission.LmsAnnouncementsCreate) ||
    auth.hasPermission(Permission.LmsAnnouncementsCreateOwn);
  return canAuthor ? true : list;
};

import { ROUTES } from '@core/constants';
import { tenantUrlForSlug } from './tenant-host';

/** Host-only cookies cannot be transferred to the new school's origin. */
export function schoolRegistrationDestination(origin: string, slug: string): string {
  const onboarding = new URL(tenantUrlForSlug(origin, slug, ROUTES.ONBOARDING.WELCOME));
  if (onboarding.origin === new URL(origin).origin) return onboarding.toString();
  const login = new URL(ROUTES.AUTH.LOGIN, onboarding.origin);
  login.searchParams.set('schoolCreated', '1');
  login.searchParams.set('returnUrl', ROUTES.ONBOARDING.WELCOME);
  return login.toString();
}

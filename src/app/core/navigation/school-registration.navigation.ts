import { ROUTES } from '@core/constants';

/** Keep the host-only registration session on its original origin. */
export function schoolRegistrationDestination(origin: string): string {
  return new URL(ROUTES.ONBOARDING.WELCOME, origin).toString();
}

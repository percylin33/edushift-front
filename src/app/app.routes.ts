import { Routes } from '@angular/router';
import { ERROR_ROUTES, PRIVATE_ROUTES, PUBLIC_ROUTES } from './app-routing';

/**
 * Top-level route composition. Three logical areas, each in its own file:
 *
 *   - `PUBLIC_ROUTES`   → `/auth/*`, `/onboarding/*` (no session required)
 *   - `PRIVATE_ROUTES`  → `/dashboard`, `/students`, …  (session + tenant)
 *   - `ERROR_ROUTES`    → `/403`, `/404` + wildcard catch-all
 *
 * Order matters: the empty redirect to `/dashboard` ships first, then the
 * three areas (PUBLIC and PRIVATE both mount on the empty path with their
 * own layout components, Angular Router resolves them by their child paths).
 * `ERROR_ROUTES` must come last because of its `**` wildcard.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  ...PUBLIC_ROUTES,
  ...PRIVATE_ROUTES,
  ...ERROR_ROUTES
];

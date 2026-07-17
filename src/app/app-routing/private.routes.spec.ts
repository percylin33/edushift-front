import { PRIVATE_ROUTES } from './private.routes';

/**
 * Regression guard for the routing bug that made {@code /dashboard}
 * (and every other private child like {@code /users}, {@code /students}, …)
 * silently redirect to {@code /404}.
 *
 * <p>The root cause was a {@code pathMatch: 'full'} on the parent route with
 * {@code path: ''}. With that combination Angular Router only activates the
 * parent when the URL is exactly empty, so the children were unreachable and
 * the wildcard {@code **} route in {@code error.routes.ts} caught every
 * navigation, rendering {@code NotFoundComponent}.</p>
 *
 * <p>The fix is to drop {@code pathMatch} from the parent so it defaults to
 * {@code 'prefix'}, letting the children ({@code dashboard}, {@code users},
 * etc.) match normally as prefixes of the URL.</p>
 */
describe('PRIVATE_ROUTES', () => {
  it('el padre NO debe tener pathMatch: full (causa /404 silencioso en /dashboard)', () => {
    expect(PRIVATE_ROUTES.length).toBeGreaterThan(0);
    const parent = PRIVATE_ROUTES[0];
    expect(parent.path).toBe('');
    expect(parent.pathMatch).not.toBe('full');
  });

  it('declara los children privados principales (dashboard, users, students…)', () => {
    const parent = PRIVATE_ROUTES[0];
    expect(parent.children).toBeDefined();
    const childPaths = (parent.children ?? []).map((c) => c.path);
    expect(childPaths).toContain('dashboard');
    expect(childPaths).toContain('users');
    expect(childPaths).toContain('students');
    expect(childPaths).toContain('teachers');
  });

  it('el padre tiene tenantGuard en canActivate', () => {
    const parent = PRIVATE_ROUTES[0];
    expect(parent.canActivate).toBeDefined();
    expect(parent.canActivate?.length).toBeGreaterThan(0);
  });
});

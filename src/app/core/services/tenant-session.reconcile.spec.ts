import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Tenant, User } from '@core/models';
import { TenantStatus, UserRole, UserStatus } from '@core/enums';
import { reconcileTenantWithSession, TenantSessionReconcileDeps } from './tenant-session.reconcile';

describe('Same-origin school session recovery', () => {
  const school: Tenant = { id: 'qa', slug: 'qa', name: 'QA', status: TenantStatus.Active, isActive: true };
  const user: User = { publicUuid: 'owner', fullName: 'QA', email: 'qa@example.test',
    status: UserStatus.Active, tenantId: 'qa', roles: [UserRole.TenantAdmin] };
  let deps: TenantSessionReconcileDeps;
  let findCurrent: jasmine.Spy;
  let setTenant: jasmine.Spy;
  let clearSession: jasmine.Spy;
  let currentUser: User;
  let requestedTenant: Tenant | null;
  let hasTenantHost: boolean;
  let previousPath: string;
  beforeEach(() => {
    previousPath = window.location.pathname;
    history.replaceState(null, '', '/onboarding/welcome');
    currentUser = user;
    requestedTenant = null;
    hasTenantHost = false;
    findCurrent = jasmine.createSpy().and.returnValue(of(school));
    setTenant = jasmine.createSpy();
    clearSession = jasmine.createSpy();
    deps = {
      auth: { isAuthenticated: () => true, user: () => currentUser, setUser: jasmine.createSpy(), clearSession },
      authApi: { me: () => of(currentUser) },
      tenantApi: { findCurrent },
      tenantService: { tenant: () => requestedTenant, hasTenantHost: () => hasTenantHost, setTenant },
      logger: { warn: jasmine.createSpy() },
    } as unknown as TenantSessionReconcileDeps;
  });
  afterEach(() => history.replaceState(null, '', previousPath));
  it('rehydrates the school from the authenticated endpoint on reload', async () => {
    await reconcileTenantWithSession(deps, 'test');
    expect(setTenant).toHaveBeenCalledWith(school, 'header');
  });
  it('does not infer a school on platform or public auth pages', async () => {
    for (const path of ['/admin', '/admin/login', '/auth/setup-school', '/auth/login']) {
      history.replaceState(null, '', path);
      await reconcileTenantWithSession(deps, 'test');
    }
    expect(findCurrent).not.toHaveBeenCalled();
  });
  it('does not infer school context for Super Admin', async () => {
    currentUser = { ...user, roles: [UserRole.SuperAdmin] };
    await reconcileTenantWithSession(deps, 'test');
    expect(findCurrent).not.toHaveBeenCalled();
  });
  it('does not infer school context without an authenticated tenant identity', async () => {
    currentUser = { ...user, tenantId: undefined };
    await reconcileTenantWithSession(deps, 'test');
    expect(findCurrent).not.toHaveBeenCalled();
  });
  for (const status of [401, 403]) {
    it(`rejects invalid, expired or unauthorized sessions (HTTP ${status})`, async () => {
      spyOn(deps.authApi, 'me').and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      await reconcileTenantWithSession(deps, 'test');
      expect(clearSession).toHaveBeenCalled();
      expect(findCurrent).not.toHaveBeenCalled();
      expect(setTenant).not.toHaveBeenCalled();
    });
  }
  it('does not load context for a signed-out visitor', async () => {
    spyOn(deps.auth, 'isAuthenticated').and.returnValue(false);
    await reconcileTenantWithSession(deps, 'test');
    expect(findCurrent).not.toHaveBeenCalled();
  });
  it('rejects a session belonging to another school hostname', async () => {
    hasTenantHost = true;
    requestedTenant = { ...school, slug: 'other' };
    await reconcileTenantWithSession(deps, 'test');
    expect(clearSession).toHaveBeenCalled();
    expect(setTenant).toHaveBeenCalledWith(requestedTenant, 'subdomain');
  });
  it('does not create school context when the authenticated lookup fails', async () => {
    findCurrent.and.returnValue(throwError(() => ({ status: 401 })));
    await reconcileTenantWithSession(deps, 'test');
    expect(setTenant).not.toHaveBeenCalled();
  });
});

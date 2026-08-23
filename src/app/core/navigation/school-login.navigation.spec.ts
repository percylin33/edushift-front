import { TenantService } from '@core/services/tenant.service';
import { TenantStatus } from '@core/enums';
import { pinSchoolForLogin, schoolInvitationAcceptUrl, schoolLoginQueryParams } from './school-login.navigation';

describe('schoolLoginQueryParams', () => {
  const tenant = {
    tenant: () => ({
      id: 'uuid-1',
      slug: 'tecnosur',
      name: 'Tecnosur',
      status: TenantStatus.Active,
      isActive: true,
    }),
    setTenant: jasmine.createSpy('setTenant'),
  } as unknown as TenantService;

  it('incluye tenant del colegio actual', () => {
    const params = schoolLoginQueryParams(tenant);
    expect(params['tenant']).toBe('tecnosur');
    expect(tenant.setTenant).toHaveBeenCalled();
  });

  it('conserva returnUrl', () => {
    const params = schoolLoginQueryParams(tenant, { returnUrl: '/dashboard' });
    expect(params['tenant']).toBe('tecnosur');
    expect(params['returnUrl']).toBe('/dashboard');
  });

  it('pinSchoolForLogin retorna null sin tenant', () => {
    const empty = {
      tenant: () => null,
      setTenant: jasmine.createSpy('setTenant'),
    } as unknown as TenantService;
    expect(pinSchoolForLogin(empty)).toBeNull();
  });
});

describe('schoolInvitationAcceptUrl', () => {
  it('añade ?tenant= del colegio', () => {
    expect(schoolInvitationAcceptUrl('http://localhost:4201/', 'tok-1', 'Colegio-De-Percy')).toBe(
      'http://localhost:4201/invitation/tok-1?tenant=colegio-de-percy',
    );
  });

  it('omite query si no hay slug', () => {
    expect(schoolInvitationAcceptUrl('http://localhost:4201', 'tok-1', null)).toBe(
      'http://localhost:4201/invitation/tok-1',
    );
  });
});

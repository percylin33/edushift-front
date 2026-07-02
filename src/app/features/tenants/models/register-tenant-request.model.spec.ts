import { RegisterTenantRequest } from './register-tenant-request.model';

describe('RegisterTenantRequestModel', () => {
  it('requiere tenant y admin completos', () => {
    const r: RegisterTenantRequest = {
      tenantName: 'Acme School',
      tenantSlug: 'acme',
      adminEmail: 'admin@acme.com',
      adminPassword: 'pass1234',
      adminFirstName: 'Admin',
      adminLastName: 'User',
    };
    expect(r.tenantSlug).toBe('acme');
    expect(r.adminEmail).toBe('admin@acme.com');
  });

  it('campos sin opcionales', () => {
    const r: RegisterTenantRequest = {
      tenantName: '',
      tenantSlug: '',
      adminEmail: '',
      adminPassword: '',
      adminFirstName: '',
      adminLastName: '',
    };
    expect(Object.keys(r)).toHaveSize(6);
  });
});

import { UpdateTenantRequest } from './update-tenant-request.model';

describe('UpdateTenantRequestModel', () => {
  it('todos los campos opcionales', () => {
    const u: UpdateTenantRequest = {};
    expect(Object.keys(u)).toHaveSize(0);
  });

  it('acepta name y customDomain', () => {
    const u: UpdateTenantRequest = { name: 'Nuevo', customDomain: 'new.edu' };
    expect(u.name).toBe('Nuevo');
    expect(u.customDomain).toBe('new.edu');
  });

  it('branding es un objeto BrandingRaw', () => {
    const u: UpdateTenantRequest = {
      branding: { primaryColor: '#000', logoUrl: 'https://x.com/a.png' },
    };
    expect(u.branding?.primaryColor).toBe('#000');
  });

  it('settings y featureFlags son maps', () => {
    const u: UpdateTenantRequest = {
      settings: { locale: 'es' },
      featureFlags: { ai: true },
    };
    expect(u.settings?.['locale']).toBe('es');
    expect(u.featureFlags?.['ai']).toBeTrue();
  });

  it('maxStudents y maxTeachers pueden ser null (clear)', () => {
    const u: UpdateTenantRequest = { maxStudents: null, maxTeachers: null };
    expect(u.maxStudents).toBeNull();
    expect(u.maxTeachers).toBeNull();
  });
});

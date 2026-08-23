import { MeProfile } from './me-profile.model';

describe('MeProfile', () => {
  it('round-trips a minimal profile', () => {
    const p: MeProfile = {
      publicUuid: '11111111-1111-1111-1111-111111111111',
      userPublicUuid: '22222222-2222-2222-2222-222222222222',
      firstName: 'Lucia',
      lastName: 'Salazar',
      email: 'lucia.student@tecnosur.edushift.pe',
      sectionPublicUuid: '33333333-3333-3333-3333-333333333333',
      sectionName: '1A',
      gradeName: 'Primero',
      academicYearLabel: '2026',
      tenantPublicUuid: '44444444-4444-4444-4444-444444444444',
      tenantName: 'TecnoSur',
      tenantLogoUrl: null,
      permissions: ['ME_READ', 'ME_QR_READ'],
    };
    expect(p.firstName).toBe('Lucia');
    expect(p.permissions.length).toBe(2);
    expect(p.tenantLogoUrl).toBeNull();
  });

  it('supports null fields when the student has no section', () => {
    const p: MeProfile = {
      publicUuid: 'x',
      userPublicUuid: 'y',
      firstName: 'Mateo',
      lastName: 'Ramirez',
      email: null,
      sectionPublicUuid: null,
      sectionName: null,
      gradeName: null,
      academicYearLabel: null,
      tenantPublicUuid: 'z',
      tenantName: 'TecnoSur',
      tenantLogoUrl: null,
      permissions: [],
    };
    expect(p.sectionPublicUuid).toBeNull();
    expect(p.email).toBeNull();
  });
});

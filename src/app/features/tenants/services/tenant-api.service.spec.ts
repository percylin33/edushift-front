import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TenantApiService } from './tenant-api.service';
import { ApiService } from '@core/services';

describe('TenantApiService', () => {
  let service: TenantApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const summaryRaw = {
    publicUuid: 't-1',
    name: 'Acme School',
    slug: 'acme',
    status: 'ACTIVE',
    branding: {
      primaryColor: '#ff0000',
      logoUrl: 'https://x.com/logo.png',
      faviconUrl: null,
      loginBgUrl: null,
    },
  };

  const responseRaw = {
    publicUuid: 't-1',
    name: 'Acme School',
    slug: 'acme',
    customDomain: 'acme.edu',
    status: 'ACTIVE',
    plan: 'TRIAL',
    trialEndsAt: '2026-12-31',
    branding: {
      primaryColor: '#ff0000',
      logoUrl: 'https://x.com/logo.png',
      faviconUrl: 'https://x.com/f.png',
      loginBgUrl: null,
    },
    settings: { language: 'es' },
    featureFlags: { ai: true },
    maxStudents: 100,
    maxTeachers: 10,
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch']);
    TestBed.configureTestingModule({
      providers: [TenantApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(TenantApiService);
  });

  it('findBySlug hace GET y adapta a Tenant', (done) => {
    apiSpy.get.and.returnValue(of({ success: true, data: summaryRaw }));
    service.findBySlug('acme').subscribe((tenant) => {
      expect(tenant.id).toBe('t-1');
      expect(tenant.slug).toBe('acme');
      expect(tenant.isActive).toBeTrue();
      expect(tenant.branding?.primaryColor).toBe('#ff0000');
      done();
    });
  });

  it('findCurrent hace GET a /me', (done) => {
    apiSpy.get.and.returnValue(of({ success: true, data: responseRaw }));
    service.findCurrent().subscribe((tenant) => {
      expect(tenant.customDomain).toBe('acme.edu');
      expect(tenant.plan).toBe('TRIAL');
      expect(tenant.maxStudents).toBe(100);
      expect(tenant.featureFlags?.['ai']).toBeTrue();
      done();
    });
  });

  it('updateCurrent hace PATCH', (done) => {
    apiSpy.patch.and.returnValue(of({ success: true, data: responseRaw }));
    service.updateCurrent({ name: 'New Name' } as any).subscribe((tenant) => {
      expect(tenant.name).toBe('Acme School');
      done();
    });
  });

  it('register POSTea y adapta a AuthSession', (done) => {
    apiSpy.post.and.returnValue(
      of({
        accessToken: 'a',
        refreshToken: 'r',
        expiresIn: 3600,
        tokenType: 'Bearer',
        user: {
          publicUuid: 'u-1',
          email: 'admin@a.com',
          fullName: 'Admin',
          roles: ['TENANT_ADMIN'],
          permissions: [],
          tenantId: 't-1',
          tenantSlug: 'acme',
          tenantName: 'Acme',
        },
      }),
    );
    service
      .register({
        tenantName: 'X',
        tenantSlug: 'x',
        adminEmail: 'admin@x.com',
        adminPassword: 'pass1234',
        adminFirstName: 'A',
        adminLastName: 'B',
      })
      .subscribe((session) => {
        expect(session.accessToken).toBe('a');
        expect(session.user.tenantSlug).toBe('acme');
        done();
      });
  });

  it('activateCurrent POSTea al endpoint activate', (done) => {
    apiSpy.post.and.returnValue(of({ success: true, data: responseRaw }));
    service.activateCurrent().subscribe((tenant) => {
      expect(tenant.id).toBe('t-1');
      done();
    });
  });

  it('branding con paquete vacío retorna undefined', (done) => {
    apiSpy.get.and.returnValue(of({ success: true, data: { ...summaryRaw, branding: {} } }));
    service.findBySlug('acme').subscribe((tenant) => {
      expect(tenant.branding).toBeUndefined();
      done();
    });
  });

  it('branding con primaryColor + logo se adapta', (done) => {
    apiSpy.get.and.returnValue(
      of({
        success: true,
        data: { ...summaryRaw, branding: { primaryColor: '#abc' } },
      }),
    );
    service.findBySlug('acme').subscribe((tenant) => {
      expect(tenant.branding?.primaryColor).toBe('#abc');
      done();
    });
  });
});

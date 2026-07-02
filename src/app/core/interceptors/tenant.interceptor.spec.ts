import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TenantService } from '@core/services';
import { tenantInterceptor } from './tenant.interceptor';
import { signal } from '@angular/core';
import { API } from '@core/constants';

describe('tenantInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let tenantSlug: ReturnType<typeof signal<string | null>>;

  beforeEach(() => {
    tenantSlug = signal<string | null>(null);

    const tenantService = {
      tenantSlug: tenantSlug.asReadonly(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tenantInterceptor])),
        provideHttpClientTesting(),
        { provide: TenantService, useValue: tenantService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('no añade X-Tenant-Slug a endpoints que no son /auth/login', () => {
    httpClient.get('/api/sections').subscribe();
    const req = httpMock.expectOne('/api/sections');
    expect(req.request.headers.has('X-Tenant-Slug')).toBeFalse();
    req.flush({});
  });

  it('añade X-Tenant-Slug a /auth/login cuando hay slug', () => {
    tenantSlug.set('acme');
    httpClient.post(API.AUTH.LOGIN, {}).subscribe();
    const req = httpMock.expectOne(API.AUTH.LOGIN);
    expect(req.request.headers.get('X-Tenant-Slug')).toBe('acme');
    req.flush({});
  });

  it('usa defaultTenant como slug en /auth/login si no hay slug', () => {
    httpClient.post(API.AUTH.LOGIN, {}).subscribe();
    const req = httpMock.expectOne(API.AUTH.LOGIN);
    expect(req.request.headers.get('X-Tenant-Slug')).toBe('demo');
    req.flush({});
  });
});

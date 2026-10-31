import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminTenantAiSettings, AdminTenantDetail } from '../models';

describe('AdminTenantsService', () => {
  let service: AdminTenantsService;
  let api: jasmine.SpyObj<ApiService>;
  let http: jasmine.SpyObj<HttpClient>;

  function makeAiSettings(enabled: boolean): AdminTenantAiSettings {
    return {
      configured: true,
      enabled,
      planAvailable: true,
      planCode: 'PRO',
      dailyRequestLimit: 20,
      monthlyTokenLimit: 10000,
      blockedReason: null,
    };
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    http = jasmine.createSpyObj<HttpClient>('HttpClient', ['get']);
    TestBed.configureTestingModule({
      providers: [
        AdminTenantsService,
        { provide: ApiService, useValue: api },
        { provide: HttpClient, useValue: http },
      ],
    });
    service = TestBed.inject(AdminTenantsService);
  });

  it('maps overview metrics and resets to defaults when optional values are absent', () => {
    api.get.and.returnValue(
      of({
        data: { activeTenants: '4', activeStudents: 80, mrrCents: 129900, overdueCents: 5000 },
      }),
    );
    service.loadOverview();
    expect(service.overview()).toEqual({
      activeTenants: 4,
      activeStudents: 80,
      mrr: 1299,
      overdue: 50,
      collectionRate: 0,
      lastUpdated: null,
    });
    expect(service.overviewLoading()).toBeFalse();
    expect(service.overviewError()).toBeNull();

    api.get.and.returnValue(throwError(() => ({})));
    service.loadOverview();
    expect(service.overviewError()).toBe('No se pudieron cargar los indicadores.');
    expect(service.overviewLoading()).toBeFalse();
  });

  it('applies tenant filters and ignores stale list responses', () => {
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    api.get.and.returnValues(first, second);

    service.loadTenants({
      search: 'norte',
      plan: 'SCHOOL',
      status: 'ACTIVE',
      sort: 'name',
      page: 2,
      size: 5,
    });
    service.loadTenants();

    expect(api.get.calls.argsFor(0)).toEqual([
      API.ADMIN.TENANTS_ROOT,
      { search: 'norte', plan: 'SCHOOL', status: 'ACTIVE', sort: 'name', page: 2, size: 5 },
    ]);
    expect(api.get.calls.argsFor(1)).toEqual([API.ADMIN.TENANTS_ROOT, { page: 0, size: 10 }]);

    first.next({ data: { content: [{ publicUuid: 'stale' }], totalElements: 1, totalPages: 1 } });
    expect(service.tenants()).toEqual([]);
    second.next({
      data: { content: [{ publicUuid: 'current' }], totalElements: 7, totalPages: 1 },
    });
    expect(service.tenants()).toEqual([jasmine.objectContaining({ publicUuid: 'current' })]);
    expect(service.totalElements()).toBe(7);
    expect(service.loading()).toBeFalse();
  });

  it('supports legacy list payloads and reports current request errors', () => {
    api.get.and.returnValue(of({ data: [{ publicUuid: 'legacy' }] }));
    service.loadTenants({});
    expect(service.tenants()).toEqual([jasmine.objectContaining({ publicUuid: 'legacy' })]);
    expect(service.totalElements()).toBe(0);
    expect(service.totalPages()).toBe(0);

    api.get.and.returnValue(throwError(() => ({ error: { message: 'Sin acceso' } })));
    service.loadTenants();
    expect(service.error()).toBe('Sin acceso');
    expect(service.loading()).toBeFalse();

    api.get.and.returnValue(throwError(() => ({})));
    service.loadTenants();
    expect(service.error()).toBe('Error al cargar instituciones');
  });

  it('loads tenant details and AI settings, including default errors', () => {
    const detail: AdminTenantDetail = { publicUuid: 'tenant-1', slug: 'colegio-norte', name: 'Colegio Norte', status: 'ACTIVE' };
    const settings = makeAiSettings(true);
    api.get.and.returnValues(of({ data: detail }), of({ data: settings }));
    service.loadTenantDetail('tenant-1');
    service.loadTenantAiSettings('tenant-1');
    expect(service.selectedTenant()).toBe(detail);
    expect(service.tenantAiSettings()).toBe(settings);
    expect(service.loading()).toBeFalse();
    expect(service.tenantAiSettingsLoading()).toBeFalse();

    api.get.and.returnValues(
      throwError(() => ({})),
      throwError(() => ({ error: { message: 'IA denegada' } })),
    );
    service.loadTenantDetail('tenant-1');
    service.loadTenantAiSettings('tenant-1');
    expect(service.error()).toBe('Error al cargar detalle');
    expect(service.tenantAiSettingsError()).toBe('IA denegada');
  });

  it('ignores stale AI settings responses and maps AI settings updates', () => {
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    api.get.and.returnValues(first, second);
    service.loadTenantAiSettings('tenant-1');
    service.loadTenantAiSettings('tenant-2');
    first.next({ data: makeAiSettings(false) });
    expect(service.tenantAiSettings()).toBeNull();
    second.next({ data: makeAiSettings(true) });
    expect(service.tenantAiSettings()).toEqual(makeAiSettings(true));
    expect(service.tenantAiSettingsLoading()).toBeFalse();

    const updated = makeAiSettings(false);
    api.put.and.returnValue(of({ data: updated }));
    let result: unknown;
    service.updateTenantAiSettings('tenant-2', false).subscribe((value) => (result = value));
    expect(api.put).toHaveBeenCalledWith(API.ADMIN.TENANT_AI_SETTINGS('tenant-2'), {
      enabled: false,
    });
    expect(result).toBe(updated);
    expect(service.tenantAiSettings()).toBe(updated);
  });

  it('refreshes tenant and AI settings after mutations and exposes invitation endpoints', () => {
    api.post.and.returnValue(of({}));
    api.get.and.returnValue(of({ data: {} }));
    const detailSpy = spyOn(service, 'loadTenantDetail').and.stub();
    const aiSpy = spyOn(service, 'loadTenantAiSettings').and.stub();

    service.suspendTenant('tenant-1', 'impago').subscribe();
    expect(api.post).toHaveBeenCalledWith(API.ADMIN.TENANTS_SUSPEND('tenant-1'), {
      reason: 'impago',
    });
    service.reactivateTenant('tenant-1').subscribe();
    expect(api.post).toHaveBeenCalledWith(API.ADMIN.TENANTS_REACTIVATE('tenant-1'), {});
    service.assignPlan('tenant-1', 'plan-1').subscribe();
    expect(api.post).toHaveBeenCalledWith(API.ADMIN.ASSIGN_SUBSCRIPTION('tenant-1'), {
      planId: 'plan-1',
    });
    expect(detailSpy).toHaveBeenCalledTimes(3);
    expect(aiSpy).toHaveBeenCalledTimes(3);

    service.inviteSchool('admin@example.test');
    service.loadSchoolInvitations();
    service.resendSchoolInvitation('invite-1');
    service.cancelSchoolInvitation('invite-1');
    expect(api.post).toHaveBeenCalledWith(API.ADMIN.SCHOOL_INVITATIONS, {
      email: 'admin@example.test',
    });
    expect(api.get).toHaveBeenCalledWith(API.ADMIN.SCHOOL_INVITATIONS, { size: 20 });
    expect(api.post).toHaveBeenCalledWith(API.ADMIN.SCHOOL_INVITATION_RESEND('invite-1'));
    expect(api.delete).toHaveBeenCalledWith(API.ADMIN.SCHOOL_INVITATION_BY_ID('invite-1'));
  });

  it('downloads a binary package and adds a trimmed school name only when supplied', async () => {
    const zip = new Blob(['zip'], { type: 'application/zip' });
    http.get.and.returnValue(of(new HttpResponse<Blob>({ body: zip, status: 200 })));

    await expectAsync(
      firstValueFrom(service.downloadPrepPackage(' Colegio Norte ', 'PILOT')),
    ).toBeResolvedTo(zip);
    expect(http.get.calls.mostRecent().args[0]).toBe(API.ADMIN.PREP_PACKAGE);
    expect(http.get.calls.mostRecent().args[1] as unknown).toEqual({
      params: { variant: 'PILOT', schoolName: 'Colegio Norte' },
      responseType: 'blob',
      observe: 'response',
    });

    http.get.and.returnValue(of(new HttpResponse<Blob>({ body: zip, status: 200 })));
    await expectAsync(firstValueFrom(service.downloadPrepPackage('  '))).toBeResolvedTo(zip);
    expect(http.get.calls.mostRecent().args[1] as unknown).toEqual({
      params: { variant: 'PRODUCTION' },
      responseType: 'blob',
      observe: 'response',
    });
  });

  it('turns empty, JSON and malformed package responses into useful errors', async () => {
    http.get.and.returnValue(of(new HttpResponse<Blob>({ body: null, status: 0 })));
    const empty = await firstValueFrom(service.downloadPrepPackage('Colegio').pipe()).catch(
      (err) => err,
    );
    expect(empty).toEqual(jasmine.objectContaining({ status: 500, statusText: 'Empty download' }));

    const jsonError = new Blob(
      [JSON.stringify({ errors: [{ message: 'Paquete no disponible' }] })],
      {
        type: 'application/json',
      },
    );
    http.get.and.returnValue(of(new HttpResponse<Blob>({ body: jsonError, status: 200 })));
    const parsed = await firstValueFrom(service.downloadPrepPackage('Colegio')).catch((err) => err);
    expect(parsed).toEqual(
      jasmine.objectContaining({
        status: 500,
        error: { message: 'Paquete no disponible' },
      }),
    );

    const malformed = new Blob(['<html>fallo</html>'], { type: 'text/html' });
    http.get.and.returnValue(of(new HttpResponse<Blob>({ body: malformed, status: 503 })));
    const text = await firstValueFrom(service.downloadPrepPackage('Colegio')).catch((err) => err);
    expect(text).toEqual(
      jasmine.objectContaining({ status: 503, error: { message: '<html>fallo</html>' } }),
    );

    const headerJson = new Blob(['{"message":"fallo"}'], { type: '' });
    http.get.and.returnValue(
      of(
        new HttpResponse({
          body: headerJson,
          status: 200,
          headers: new HttpHeaders({ 'Content-Type': 'text/json' }),
        }),
      ),
    );
    const header = await firstValueFrom(service.downloadPrepPackage('Colegio')).catch((err) => err);
    expect(header).toEqual(jasmine.objectContaining({ error: { message: 'fallo' } }));
  });
});

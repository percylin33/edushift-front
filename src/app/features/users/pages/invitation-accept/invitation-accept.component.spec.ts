import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { InvitationAcceptComponent } from './invitation-accept.component';
import { UsersApiService } from '../../services';
import { AuthApiService } from '@features/auth/services';
import { AuthService, TenantService } from '@core/services';
import { InvitationPreflight, AcceptInvitationRequest } from '../../models';
import { ROUTES } from '@core/constants';

describe('InvitationAcceptComponent', () => {
  let fixture: ComponentFixture<InvitationAcceptComponent>;
  let component: InvitationAcceptComponent;
  let fakeUsersApi: jasmine.SpyObj<UsersApiService>;
  let fakeAuthApi: jasmine.SpyObj<AuthApiService>;
  let fakeAuth: { setSession: jasmine.Spy; setUser: jasmine.Spy };
  let fakeTenant: { tenantSlug: () => string; setSlug: jasmine.Spy };

  const preflight: InvitationPreflight = {
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    fullName: 'A B',
    tenantName: 'Acme School',
    tenantSlug: 'acme',
  };

  function configureModule(token: string | null = 'tok-1', tenantQuery: string | null = null): void {
    TestBed.resetTestingModule();
    fakeUsersApi = jasmine.createSpyObj<UsersApiService>('UsersApiService', [
      'previewInvitation',
      'acceptInvitation',
    ]);
    fakeAuthApi = jasmine.createSpyObj<AuthApiService>('AuthApiService', ['me']);
    fakeAuth = {
      setSession: jasmine.createSpy('setSession'),
      setUser: jasmine.createSpy('setUser'),
    };
    fakeTenant = {
      tenantSlug: () => 'acme',
      setSlug: jasmine.createSpy('setSlug'),
    };
    TestBed.configureTestingModule({
      imports: [InvitationAcceptComponent],
      providers: [
        provideRouter([]),
        { provide: UsersApiService, useValue: fakeUsersApi },
        { provide: AuthApiService, useValue: fakeAuthApi },
        { provide: AuthService, useValue: fakeAuth },
        { provide: TenantService, useValue: fakeTenant },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (_: string) => token },
              queryParamMap: { get: (key: string) => (key === 'tenant' ? tenantQuery : null) },
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(InvitationAcceptComponent);
    component = fixture.componentInstance;
  }

  it('se crea correctamente', () => {
    configureModule();
    expect(component).toBeTruthy();
  });

  it('expone loginRoute', () => {
    configureModule();
    expect((component as any).loginRoute).toBe(ROUTES.AUTH.LOGIN);
  });

  it('ngOnInit sin token no llama api', async () => {
    configureModule(null);
    await component.ngOnInit();
    expect(fakeUsersApi.previewInvitation).not.toHaveBeenCalled();
  });

  it('ngOnInit carga preflight y fija el slug del colegio', async () => {
    configureModule();
    fakeUsersApi.previewInvitation.and.returnValue(of(preflight));
    await component.ngOnInit();
    expect((component as any).preflight()?.fullName).toBe('A B');
    expect((component as any).loading()).toBeFalse();
    expect(fakeTenant.setSlug).toHaveBeenCalledWith('acme');
    expect((component as any).loginQueryParams()).toEqual({ tenant: 'acme' });
  });

  it('ngOnInit 404 setea blocker', async () => {
    configureModule();
    fakeUsersApi.previewInvitation.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );
    await component.ngOnInit();
    expect((component as any).blockerTitle()).toContain('no encontrado');
  });

  it('ngOnInit rechaza ?tenant= distinto al de la invitacion (UAT-CD-11)', async () => {
    configureModule('tok-1', 'demo');
    fakeUsersApi.previewInvitation.and.returnValue(of(preflight));
    await component.ngOnInit();
    expect(fakeUsersApi.previewInvitation).toHaveBeenCalledWith('tok-1', 'demo');
    expect((component as any).preflight()).toBeNull();
    expect((component as any).blockerTitle()).toContain('otro colegio');
    expect(fakeTenant.setSlug).not.toHaveBeenCalled();
  });

  it('ngOnInit 403 INVITATION_TENANT_MISMATCH setea blocker', async () => {
    configureModule('tok-1', 'demo');
    fakeUsersApi.previewInvitation.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    await component.ngOnInit();
    expect((component as any).blockerTitle()).toContain('otro colegio');
  });

  it('ngOnInit 410 con código INVITATION_ALREADY_ACCEPTED', async () => {
    configureModule();
    fakeUsersApi.previewInvitation.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 410,
            error: { error: { code: 'INVITATION_ALREADY_ACCEPTED' } },
          }),
      ),
    );
    await component.ngOnInit();
    expect((component as any).blockerMessage()).toContain('ya fue aceptada');
  });

  it('ngOnInit 410 con INVITATION_CANCELLED', async () => {
    configureModule();
    fakeUsersApi.previewInvitation.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 410,
            error: { error: { code: 'INVITATION_CANCELLED' } },
          }),
      ),
    );
    await component.ngOnInit();
    expect((component as any).blockerMessage()).toContain('canceló');
  });

  it('ngOnInit 410 con INVITATION_EXPIRED', async () => {
    configureModule();
    fakeUsersApi.previewInvitation.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 410,
            error: { error: { code: 'INVITATION_EXPIRED' } },
          }),
      ),
    );
    await component.ngOnInit();
    expect((component as any).blockerMessage()).toContain('expiró');
  });

  it('ngOnInit error genérico', async () => {
    configureModule();
    fakeUsersApi.previewInvitation.and.returnValue(throwError(() => ({ status: 500 })));
    await component.ngOnInit();
    expect((component as any).blockerTitle()).toBe('Enlace inválido');
  });

  function setPasswords(password: string, confirm: string): void {
    (component as any).passwordCtrl.setValue(password);
    (component as any).confirmCtrl.setValue(confirm);
    (component as any).form.updateValueAndValidity();
  }

  it('passwordsMismatch refleja state', () => {
    configureModule();
    setPasswords('12345678', '');
    expect((component as any).passwordsMismatch()).toBeFalse();
    setPasswords('12345678', '12345678');
    expect((component as any).passwordsMismatch()).toBeFalse();
    setPasswords('12345678', 'diferente');
    expect((component as any).passwordsMismatch()).toBeTrue();
  });

  it('canSubmit requiere 8+ chars y coincidencia', () => {
    configureModule();
    expect((component as any).canSubmit()).toBeFalse();
    (component as any).preflight.set(preflight);
    setPasswords('12345678', '12345678');
    expect((component as any).canSubmit()).toBeTrue();
    setPasswords('1234', '1234');
    expect((component as any).canSubmit()).toBeFalse();
    setPasswords('12345678', '87654321');
    expect((component as any).canSubmit()).toBeFalse();
  });

  it('onSubmit llama acceptInvitation y navega a dashboard', async () => {
    configureModule();
    fakeUsersApi.previewInvitation.and.returnValue(of(preflight));
    await component.ngOnInit();
    setPasswords('12345678', '12345678');
    fakeUsersApi.acceptInvitation.and.returnValue(
      of({ accessToken: 'a', refreshToken: 'r', user: {} } as any),
    );
    fakeAuthApi.me.and.returnValue(of({ publicUuid: 'u-1' } as any));
    const router = TestBed.inject((await import('@angular/router')).Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    await (component as any).onSubmit();
    expect(fakeAuth.setSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([ROUTES.DASHBOARD.ROOT]);
  });

  it('onSubmit con error setea mensaje', async () => {
    configureModule();
    fakeUsersApi.previewInvitation.and.returnValue(of(preflight));
    await component.ngOnInit();
    setPasswords('12345678', '12345678');
    fakeUsersApi.acceptInvitation.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { error: { message: 'rechazado' } },
          }),
      ),
    );
    await (component as any).onSubmit();
    expect((component as any).errorMessage()).toBe('rechazado');
  });

  it('onSubmit sin token no llama api', async () => {
    configureModule();
    setPasswords('12345678', '12345678');
    (component as any).preflight.set(preflight);
    (component as any)['token'] = null;
    await (component as any).onSubmit();
    expect(fakeUsersApi.acceptInvitation).not.toHaveBeenCalled();
  });
});

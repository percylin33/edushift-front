import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy } from '@angular/core';

import { AuthService } from '@core/services';
import { UserRole, UserStatus, TenantStatus } from '@core/enums';
import { User } from '@core/models';

import { TenantSettingsComponent } from './tenant-settings.component';

describe('TenantSettingsComponent', () => {
  let fixture: ComponentFixture<TenantSettingsComponent>;
  let component: any;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantSettingsComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    })
      .overrideComponent(TenantSettingsComponent, {
        set: { changeDetection: ChangeDetectionStrategy.Default },
      })
      .compileComponents();

    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    auth.setSession({
      user: {
        publicUuid: 'me',
        fullName: 'Alice Demo',
        email: 'alice@acme.test',
        status: UserStatus.Active,
        roles: [UserRole.TenantAdmin],
        mfaEnabled: false,
      } as User,
      accessToken: 'a',
      refreshToken: 'r',
      expiresAt: new Date(Date.now() + 60_000),
    });
  });

  afterEach(() => {
    auth.clearSession();
    httpMock.verify();
  });

  it('blocks non-admin users with a friendly message', () => {
    auth.setUser({
      publicUuid: 'me',
      fullName: 'Alice Demo',
      email: 'alice@acme.test',
      status: UserStatus.Active,
      roles: [UserRole.Teacher],
      mfaEnabled: false,
    } as User);
    fixture = TestBed.createComponent(TenantSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('No tienes permisos');
  });

  it('loads tenant branding and patches the form', () => {
    fixture = TestBed.createComponent(TenantSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/tenants/me'));
    req.flush({
      success: true,
      data: {
        publicUuid: 't-1',
        slug: 'acme',
        name: 'Acme School',
        status: TenantStatus.Active,
        plan: 'TRIAL',
        branding: { primaryColor: '#ff0000', logoUrl: 'https://x/logo.svg' },
        settings: {},
        featureFlags: {},
      },
    });
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.form.get('name')?.value).toBe('Acme School');
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('acme');
    expect(text).toContain('Título de bienvenida');
  });
});

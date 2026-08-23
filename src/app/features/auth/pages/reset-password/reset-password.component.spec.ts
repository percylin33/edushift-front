import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy } from '@angular/core';

import { TenantService } from '@core/services';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let fixture: ComponentFixture<ResetPasswordComponent>;
  let component: any;
  let httpMock: HttpTestingController;
  let routeQuery: Record<string, string>;

  function setupRoute(token: string | null): void {
    routeQuery = token ? { token } : {};
  }

  beforeEach(async () => {
    routeQuery = {};
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent, HttpClientTestingModule],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(routeQuery);
              },
            },
          },
        },
        {
          provide: TenantService,
          useValue: { tenantSlug: () => 'acme', setSlug: jasmine.createSpy('setSlug') },
        },
      ],
    })
      .overrideComponent(ResetPasswordComponent, {
        set: { changeDetection: ChangeDetectionStrategy.Default },
      })
      .compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('shows the "invalid link" state when no token is present', () => {
    setupRoute(null);

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.validationState()).toBe('invalid');
  });

  it('validates the token on mount and shows the form when valid', () => {
    setupRoute('good-token');

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/auth/reset-password/validate') && r.params.get('token') === 'good-token',
    );
    req.flush({
      success: true,
      data: {
        valid: true,
        tenantName: 'Acme',
        tenantSlug: 'acme',
        expiresAt: null,
        reasonCode: null,
      },
    });
    fixture.detectChanges();

    expect(component.validationState()).toBe('valid');
    expect(component.token()).toBe('good-token');
  });

  it('shows the "expired link" copy when the BE says expired', () => {
    setupRoute('expired-token');

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/reset-password/validate'));
    req.flush({
      success: true,
      data: {
        valid: false,
        tenantName: null,
        tenantSlug: null,
        expiresAt: null,
        reasonCode: 'RESET_TOKEN_EXPIRED',
      },
    });
    fixture.detectChanges();

    expect(component.validationState()).toBe('invalid');
    expect(component.validationError()).toMatch(/caducado/i);
  });

  it('rejects submission when passwords do not match', () => {
    setupRoute('good-token');

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url.endsWith('/auth/reset-password/validate'))
      .flush({
        success: true,
        data: {
          valid: true,
          tenantName: 'Acme',
          tenantSlug: 'acme',
          expiresAt: null,
          reasonCode: null,
        },
      });
    fixture.detectChanges();

    component.form.patchValue({
      password: 'newpassword123',
      passwordConfirmation: 'DIFFERENT',
    });
    (component as any)._confirmationTouched.set(true);
    component.onSubmit();

    httpMock.expectNone((r) => r.url.endsWith('/auth/reset-password'));
  });
});

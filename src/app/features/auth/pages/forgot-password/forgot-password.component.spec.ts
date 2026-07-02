import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ChangeDetectionStrategy } from '@angular/core';

import { environment } from '@env/environment';

import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;
  let component: ForgotPasswordComponent;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    })
      .overrideComponent(ForgotPasswordComponent, {
        set: { changeDetection: ChangeDetectionStrategy.Default },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('shows the success state on a 200 response (anti-enumeration: same UI for missing email)', () => {
    component.form.patchValue({ email: 'alice@acme.test' });
    component.onSubmit();

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/${environment.apiVersion}/auth/forgot-password` &&
        r.method === 'POST',
    );
    req.flush(null);
    fixture.detectChanges();

    expect(component.sent()).toBe(true);
  });

  it('maps a 429 error to a friendly Spanish message', () => {
    component.form.patchValue({ email: 'alice@acme.test' });
    component.onSubmit();

    const req = httpMock.expectOne((r) => r.url.endsWith('/auth/forgot-password'));
    req.flush(
      { code: 'TOO_MANY_REQUESTS', message: 'slow down' },
      { status: 429, statusText: 'Too Many Requests' },
    );
    fixture.detectChanges();

    expect(component.errorMessage()).toMatch(/espera unos minutos/i);
    expect(component.sent()).toBe(false);
  });

  it('rejects an invalid email before sending a request', () => {
    component.form.patchValue({ email: 'not-an-email' });
    component.form.get('email')?.markAsTouched();
    component.onSubmit();

    httpMock.expectNone((r) => r.url.endsWith('/auth/forgot-password'));
  });
});

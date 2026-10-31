import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService, LoggerService, NotificationService, TenantService } from '@core/services';
import { TokenRefreshService } from '@features/auth/services/token-refresh.service';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from './error.interceptor';
import { tokenRefreshInterceptor } from './token-refresh.interceptor';

describe('Upload errors preserve a recoverable session', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let clearSession: jasmine.Spy;
  let refresh: jasmine.Spy;
  let navigate: jasmine.Spy;
  const url = `${environment.apiUrl}/v1/files/upload-requests`;
  beforeEach(() => {
    clearSession = jasmine.createSpy(); refresh = jasmine.createSpy();
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor, errorInterceptor, tokenRefreshInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { clearSession } },
      { provide: LoggerService, useValue: { error: jasmine.createSpy() } },
      { provide: NotificationService, useValue: { error: jasmine.createSpy() } },
      { provide: TenantService, useValue: { tenant: () => ({ slug: 'colegioqa' }), setTenant: jasmine.createSpy() } },
      { provide: TokenRefreshService, useValue: { refresh } },
    ] });
    http = TestBed.inject(HttpClient); requests = TestBed.inject(HttpTestingController);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });
  afterEach(() => requests.verify());
  for (const status of [0, 503]) {
    it(`does not sign out when session refresh fails temporarily (${status})`, () => {
      refresh.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      let observed: HttpErrorResponse | undefined;
      http.post(url, {}).subscribe({ error: error => observed = error });
      requests.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
      expect(observed?.status).toBe(status);
      expect(clearSession).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    });
  }
  for (const status of [403, 500]) {
    it(`preserves the actual upload error after refresh succeeds (${status})`, () => {
      refresh.and.returnValue(of('cookies-renewed'));
      let observed: HttpErrorResponse | undefined;
      http.post(url, {}).subscribe({ error: error => observed = error });
      requests.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
      const retry = requests.expectOne(url);
      expect(retry.request.withCredentials).toBeTrue();
      expect(retry.request.headers.get('X-Refresh-Retry')).toBe('1');
      retry.flush({}, { status, statusText: 'Upload failed' });
      expect(observed?.status).toBe(status);
      expect(clearSession).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    });
  }
  it('still requires sign-in when refresh is actually unauthorized', () => {
    refresh.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    http.post(url, {}).subscribe({ error: () => undefined });
    requests.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(clearSession).toHaveBeenCalled(); expect(navigate).toHaveBeenCalled();
  });
  it('does not refresh or sign out for a storage server error', () => {
    http.post(url, {}).subscribe({ error: () => undefined });
    requests.expectOne(url).flush({}, { status: 500, statusText: 'Storage unavailable' });
    expect(refresh).not.toHaveBeenCalled(); expect(clearSession).not.toHaveBeenCalled();
  });
});

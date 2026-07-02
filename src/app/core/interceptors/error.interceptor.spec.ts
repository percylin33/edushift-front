import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { AuthService, LoggerService, NotificationService } from '@core/services';
import { ROUTES } from '@core/constants';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let router: Router;
  let authService: {
    clearSession: jasmine.Spy;
    accessToken: ReturnType<typeof signal<string | null>>;
  };
  let notificationService: jasmine.SpyObj<NotificationService>;
  let loggerService: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    authService = {
      clearSession: jasmine.createSpy('clearSession'),
      accessToken: signal<string | null>('token'),
    };

    notificationService = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'error',
    ]);

    loggerService = jasmine.createSpyObj<LoggerService>('LoggerService', ['error']);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
        { provide: LoggerService, useValue: loggerService },
        { provide: NotificationService, useValue: notificationService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('401 en endpoint no-auth limpia sesi—n y redirige a login', () => {
    spyOn(router, 'navigate');
    httpClient.get('/api/sections').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/sections');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authService.clearSession).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith([ROUTES.AUTH.LOGIN], jasmine.any(Object));
  });

  it('401 en /auth/login no limpia sesi—n ni redirige', () => {
    spyOn(router, 'navigate');
    httpClient.post('/auth/login', {}).subscribe({ error: () => {} });

    const req = httpMock.expectOne('/auth/login');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authService.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('403 redirige a /forbidden', () => {
    spyOn(router, 'navigate');
    httpClient.get('/api/admin').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/admin');
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    expect(router.navigate).toHaveBeenCalledWith([ROUTES.ERRORS.FORBIDDEN]);
  });

  it('status 0 muestra notificaci—n de conexi—n', () => {
    httpClient.get('/api/test').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/test');
    req.flush('Network Error', { status: 0, statusText: 'Unknown Error' });

    expect(notificationService.error).toHaveBeenCalledWith(jasmine.stringMatching(/conexi[óo]n/));
  });

  it('500+ muestra notificaci—n de error inesperado', () => {
    httpClient.get('/api/test').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/test');
    req.flush('Server Error', { status: 500, statusText: 'Internal Server Error' });

    expect(notificationService.error).toHaveBeenCalledWith(jasmine.stringMatching(/inesperado/));
  });
});

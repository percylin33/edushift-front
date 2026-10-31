import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '@core/services';
import { authInterceptor } from './auth.interceptor';
import { signal } from '@angular/core';
import { environment } from '@env/environment';

describe('authInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let accessToken: ReturnType<typeof signal<string | null>>;

  beforeEach(() => {
    accessToken = signal<string | null>(null);

    const authService = {
      accessToken: accessToken.asReadonly(),
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('envía cookies en llamadas al API', () => {
    httpClient.get(environment.apiUrl + '/test').subscribe();
    const req = httpMock.expectOne(environment.apiUrl + '/test');
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('no fuerza cookies en URLs externas', () => {
    accessToken.set('my-token');
    httpClient.get('https://external.com/api').subscribe();
    const req = httpMock.expectOne('https://external.com/api');
    expect(req.request.withCredentials).toBeFalse();
    req.flush({});
  });

  it('respeta withCredentials si el caller ya lo activó', () => {
    httpClient.get(environment.apiUrl + '/test', { withCredentials: true }).subscribe();
    const req = httpMock.expectOne(environment.apiUrl + '/test');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({});
  });
});

import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpRequest, HttpStatusCode } from '@angular/common/http';
import { environment } from '@env/environment';
import { AuthService } from '@core/services';
import { TokenRefreshService } from '@features/auth/services/token-refresh.service';
import { of, throwError } from 'rxjs';
import { tokenRefreshInterceptor } from './token-refresh.interceptor';

describe('tokenRefreshInterceptor', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let refreshSpy: jasmine.SpyObj<TokenRefreshService>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj(
      'AuthService',
      ['getToken', 'isAuthenticated', 'hasRole', 'hasPermission'],
      { refreshToken: () => 'refresh-token' },
    );
    refreshSpy = jasmine.createSpyObj('TokenRefreshService', ['refresh']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: TokenRefreshService, useValue: refreshSpy },
      ],
    });
  });

  it('no intercepta URLs que no son del API', (done) => {
    const req = new HttpRequest('GET', 'https://external.com/api/test');
    const next = jasmine.createSpy('next').and.returnValue(of({}));
    TestBed.runInInjectionContext(() => {
      tokenRefreshInterceptor(req, next).subscribe(() => {
        expect(next).toHaveBeenCalled();
        done();
      });
    });
  });

  it('no intercepta endpoints de auth flow', (done) => {
    const req = new HttpRequest('GET', `${environment.apiUrl}/auth/login`);
    const next = jasmine.createSpy('next').and.returnValue(of({}));
    TestBed.runInInjectionContext(() => {
      tokenRefreshInterceptor(req, next).subscribe(() => {
        expect(next).toHaveBeenCalled();
        done();
      });
    });
  });
});

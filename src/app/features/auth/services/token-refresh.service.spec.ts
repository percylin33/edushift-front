import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TokenRefreshService } from './token-refresh.service';
import { AuthService } from '@core/services';
import { AuthApiService } from './auth-api.service';

describe('TokenRefreshService', () => {
  let service: TokenRefreshService;
  let authStub: { refreshToken: jasmine.Spy; rotateTokens: jasmine.Spy; clearSession: jasmine.Spy };
  let authApiStub: jasmine.SpyObj<AuthApiService>;

  const session = {
    accessToken: 'a',
    refreshToken: 'r',
    expiresIn: 3600,
    tokenType: 'Bearer',
    user: {
      publicUuid: 'u-1',
      email: 'a@b.com',
      fullName: 'A',
      roles: [],
      permissions: [],
      tenantId: 't',
      tenantSlug: 'a',
      tenantName: 'A',
    },
  };

  beforeEach(() => {
    authStub = {
      refreshToken: jasmine.createSpy('refreshToken').and.returnValue('r-token'),
      rotateTokens: jasmine.createSpy('rotateTokens'),
      clearSession: jasmine.createSpy('clearSession'),
    };
    authApiStub = jasmine.createSpyObj<AuthApiService>('AuthApiService', ['refresh']);
    TestBed.configureTestingModule({
      providers: [
        TokenRefreshService,
        { provide: AuthService, useValue: authStub },
        { provide: AuthApiService, useValue: authApiStub },
      ],
    });
    service = TestBed.inject(TokenRefreshService);
  });

  it('sin refreshToken emite NO_REFRESH_TOKEN', (done) => {
    authStub.refreshToken.and.returnValue(null);
    service.refresh().subscribe({
      next: () => done.fail('expected error'),
      error: (err) => {
        expect(err.message).toBe('NO_REFRESH_TOKEN');
        done();
      },
    });
  });

  it('refresh exitoso llama rotateTokens y emite accessToken', (done) => {
    authApiStub.refresh.and.returnValue(of(session));
    service.refresh().subscribe((token) => {
      expect(token).toBe('a');
      expect(authStub.rotateTokens).toHaveBeenCalledWith(session);
      done();
    });
  });

  it('refresh con error no rota tokens', (done) => {
    authApiStub.refresh.and.returnValue(throwError(() => new Error('boom')));
    service.refresh().subscribe({
      next: () => done.fail('expected error'),
      error: () => {
        expect(authStub.rotateTokens).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('suscripciones concurrentes comparten el mismo Observable (single-flight)', (done) => {
    authApiStub.refresh.and.returnValue(of(session));
    let calls = 0;
    service.refresh().subscribe(() => {
      calls++;
      if (calls === 1) {
        service.refresh().subscribe((tok2) => {
          expect(tok2).toBe('a');
          expect(authApiStub.refresh).toHaveBeenCalledTimes(1);
          done();
        });
      }
    });
  });

  it('después de finalizar el refresh, una nueva llamada arranca flujo nuevo', (done) => {
    authApiStub.refresh.and.returnValue(of(session));
    service.refresh().subscribe(() => {
      service.refresh().subscribe(() => {
        expect(authApiStub.refresh).toHaveBeenCalledTimes(2);
        done();
      });
    });
  });
});

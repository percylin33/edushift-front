import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services';
import { AuthApiService } from './auth-api.service';
import { LoginRequest } from '../models';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockAuthResponseRaw = {
    accessToken: 'access-123',
    refreshToken: 'refresh-456',
    expiresIn: 3600,
    tokenType: 'Bearer',
    user: {
      publicUuid: 'u-1',
      email: 'test@test.com',
      fullName: 'Test User',
      roles: ['PARENT'],
      permissions: ['read:own'],
      tenantId: 't-1',
      tenantSlug: 'acme',
      tenantName: 'Acme School',
    },
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [AuthApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(AuthApiService);
  });

  it('login POSTea a /auth/login y adapta la respuesta a AuthSession', (done) => {
    apiSpy.post.and.returnValue(of(mockAuthResponseRaw));

    const payload: LoginRequest = { email: 'test@test.com', password: 'secret' };
    service.login(payload).subscribe((session) => {
      expect(session.accessToken).toBe('access-123');
      expect(session.user.email).toBe('test@test.com');
      expect(apiSpy.post).toHaveBeenCalledWith(jasmine.stringMatching(/\/auth\/login$/), payload);
      done();
    });
  });

  it('loginWithGoogle POSTea a /auth/google', (done) => {
    apiSpy.post.and.returnValue(of(mockAuthResponseRaw));

    service.loginWithGoogle({ idToken: 'google-jwt' }).subscribe(() => {
      expect(apiSpy.post).toHaveBeenCalledWith(jasmine.stringMatching(/\/auth\/google$/), {
        idToken: 'google-jwt',
      });
      done();
    });
  });

  it('logout POSTea a /auth/logout con refreshToken', (done) => {
    apiSpy.post.and.returnValue(of(void 0));

    service.logout('refresh-456').subscribe(() => {
      expect(apiSpy.post).toHaveBeenCalledWith(jasmine.stringMatching(/\/auth\/logout$/), {
        refreshToken: 'refresh-456',
      });
      done();
    });
  });

  it('refresh POSTea a /auth/refresh y adapta la respuesta', (done) => {
    apiSpy.post.and.returnValue(of(mockAuthResponseRaw));

    service.refresh('refresh-456').subscribe((session) => {
      expect(session.accessToken).toBe('access-123');
      expect(apiSpy.post).toHaveBeenCalledWith(jasmine.stringMatching(/\/auth\/refresh$/), {
        refreshToken: 'refresh-456',
      });
      done();
    });
  });

  it('me hace GET a /auth/me y adapta UserResponseRaw a User', (done) => {
    const apiResponse = {
      success: true,
      data: {
        publicUuid: 'u-1',
        email: 'test@test.com',
        fullName: 'Test User',
        roles: ['PARENT'],
      },
    };
    apiSpy.get.and.returnValue(of(apiResponse));

    service.me().subscribe((user) => {
      expect(user.email).toBe('test@test.com');
      expect(apiSpy.get).toHaveBeenCalledWith(jasmine.stringMatching(/\/auth\/me$/));
      done();
    });
  });
});

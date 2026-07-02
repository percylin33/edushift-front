import { TestBed } from '@angular/core/testing';
import { GoogleAuthService } from './google-auth.service';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { environment } from '@env/environment';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let socialSpy: jasmine.SpyObj<SocialAuthService>;

  beforeEach(() => {
    socialSpy = jasmine.createSpyObj<SocialAuthService>('SocialAuthService', ['signIn', 'signOut']);
    TestBed.configureTestingModule({
      providers: [GoogleAuthService, { provide: SocialAuthService, useValue: socialSpy }],
    });
    service = TestBed.inject(GoogleAuthService);
  });

  it('PROVIDER_ID es google', () => {
    expect(GoogleAuthService.PROVIDER_ID).toBe('google');
  });

  it('clientId viene de environment', () => {
    expect(service.clientId).toBe(environment.google.clientId);
  });

  it('isEnabled refleja environment.google.enabled', () => {
    expect(service.isEnabled()).toBe(environment.google.enabled);
  });

  it('signIn deshabilitado lanza error', async () => {
    (service as any).isEnabled = () => false;
    await expectAsync(service.signIn()).toBeRejectedWithError(/not enabled/);
  });

  it('signIn exitoso retorna idToken y email', async () => {
    (service as any).isEnabled = () => true;
    socialSpy.signIn.and.returnValue(
      Promise.resolve({ idToken: 'google-jwt', email: 'a@b.com' } as any),
    );
    const result = await service.signIn();
    expect(result.idToken).toBe('google-jwt');
    expect(result.email).toBe('a@b.com');
    expect(service.busy()).toBeFalse();
  });

  it('signIn sin idToken lanza error', async () => {
    (service as any).isEnabled = () => true;
    socialSpy.signIn.and.returnValue(Promise.resolve({ idToken: '' } as any));
    await expectAsync(service.signIn()).toBeRejectedWithError(/token válido/);
  });

  it('signIn maneja error del provider', async () => {
    (service as any).isEnabled = () => true;
    socialSpy.signIn.and.returnValue(Promise.reject(new Error('popup bloqueado')));
    await expectAsync(service.signIn()).toBeRejected();
    expect(service.busy()).toBeFalse();
  });

  it('signOut llama al provider', async () => {
    socialSpy.signOut.and.returnValue(Promise.resolve());
    await service.signOut();
    expect(socialSpy.signOut).toHaveBeenCalledWith(true);
  });

  it('busy signal refleja estado durante signIn', async () => {
    (service as any).isEnabled = () => true;
    let resolveSignIn: (v: unknown) => void = () => undefined;
    socialSpy.signIn.and.returnValue(
      new Promise((r) => {
        resolveSignIn = r;
      }) as any,
    );
    const promise = service.signIn();
    expect(service.busy()).toBeTrue();
    resolveSignIn({ idToken: 'tok' });
    await promise;
    expect(service.busy()).toBeFalse();
  });
});

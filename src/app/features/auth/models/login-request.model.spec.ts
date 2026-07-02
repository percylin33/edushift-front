import {
  LoginRequest,
  GoogleLoginRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from './login-request.model';

describe('LoginRequestModel', () => {
  describe('LoginRequest', () => {
    it('requiere email + password', () => {
      const r: LoginRequest = { email: 'a@b.com', password: 'secret' };
      expect(r.remember).toBeUndefined();
    });

    it('remember opcional', () => {
      const r: LoginRequest = { email: 'a@b.com', password: 'x', remember: true };
      expect(r.remember).toBeTrue();
    });
  });

  describe('GoogleLoginRequest', () => {
    it('shape con idToken', () => {
      const r: GoogleLoginRequest = { idToken: 'google-jwt' };
      expect(r.idToken).toBe('google-jwt');
    });
  });

  describe('ForgotPasswordRequest', () => {
    it('requiere email', () => {
      const r: ForgotPasswordRequest = { email: 'a@b.com' };
      expect(r.email).toBe('a@b.com');
    });
  });

  describe('ResetPasswordRequest', () => {
    it('requiere token + password + confirmación', () => {
      const r: ResetPasswordRequest = {
        token: 'tok',
        password: 'newSecret',
        passwordConfirmation: 'newSecret',
      };
      expect(r.password).toBe(r.passwordConfirmation);
    });
  });
});

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ROUTES, APP } from '@core/constants';
import { AuthService } from '@core/services';
import {
  AlertComponent,
  FormFieldComponent,
  PasswordFieldComponent,
  SubmitButtonComponent,
} from '@shared/components';
import { mapHttpError } from '@shared/utils';
import {
  AdminAuthApiService,
  AdminMfaEnrolmentPayload,
  MfaChallengeRequiredError,
  MfaEnrolmentRequiredError,
  PasswordChangeRequiredError,
} from '../../services/admin-auth-api.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    AlertComponent,
    FormFieldComponent,
    PasswordFieldComponent,
    SubmitButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div class="w-full max-w-sm">
        <div class="mb-8 text-center">
          <h1 class="text-2xl font-bold text-white">Admin Console</h1>
          <p class="mt-1 text-sm text-slate-400">{{ appName }}</p>
        </div>

        @if (passwordChangeToken()) {
          <section class="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 class="text-lg font-semibold text-white">Cambia tu contraseña temporal</h2>
            <p class="mt-2 text-sm text-slate-400">Tu contraseña temporal fue validada. Elige una contraseña nueva. Después configurarás la verificación en dos pasos obligatoria.</p>
            <label class="mt-4 block text-sm text-slate-300" for="new-password">Nueva contraseña</label>
            <input id="new-password" name="new-password" [(ngModel)]="newPassword" type="password" autocomplete="new-password" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
            <label class="mt-4 block text-sm text-slate-300" for="confirm-password">Confirma la nueva contraseña</label>
            <input id="confirm-password" name="confirm-password" [(ngModel)]="confirmNewPassword" type="password" autocomplete="new-password" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
            @if (error(); as err) { <p class="mt-3 text-sm text-red-300">{{ err }}</p> }
            <button type="button" (click)="changeInitialPassword()" [disabled]="mfaBusy() || !newPassword || newPassword !== confirmNewPassword" class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">
              {{ mfaBusy() ? 'Guardando…' : 'Cambiar y continuar' }}
            </button>
          </section>
        } @else if (mfaSetup()) {
          <section class="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 class="text-lg font-semibold text-white">Configura la verificación en dos pasos</h2>
            <p class="mt-2 text-sm text-slate-400">Escanea el QR con tu app de autenticación y escribe el código de seis dígitos.</p>
            <img [src]="mfaSetup()?.qrCodeDataUrl" alt="Código QR para configurar MFA" class="mx-auto my-5 h-48 w-48 rounded bg-white p-2" />
            <p class="break-all rounded bg-slate-950 p-3 font-mono text-xs text-slate-300">{{ mfaSetup()?.secretBase32 }}</p>
            <label class="mt-4 block text-sm text-slate-300" for="mfa-code">Código de autenticación</label>
            <input id="mfa-code" name="mfa-code" [(ngModel)]="totpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
            @if (error(); as err) { <p class="mt-3 text-sm text-red-300">{{ err }}</p> }
            <button type="button" (click)="verifyMfa()" [disabled]="mfaBusy() || totpCode.length !== 6" class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">
              {{ mfaBusy() ? 'Verificando…' : 'Verificar y entrar' }}
            </button>
          </section>
        } @else if (mfaChallengeToken()) {
          <section class="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 class="text-lg font-semibold text-white">Verificación de seguridad</h2>
            <p class="mt-2 text-sm text-slate-400">Escribe el código actual de tu app de autenticación.</p>
            <label class="mt-4 block text-sm text-slate-300" for="mfa-login-code">Código de seis dígitos</label>
            <input id="mfa-login-code" name="mfa-login-code" [(ngModel)]="totpCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white" />
            @if (error(); as err) { <p class="mt-3 text-sm text-red-300">{{ err }}</p> }
            <button type="button" (click)="verifyMfaChallenge()" [disabled]="mfaBusy() || totpCode.length < 6" class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50">{{ mfaBusy() ? 'Verificando…' : 'Continuar' }}</button>
          </section>
        } @else {
        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          @if (error(); as err) {
            <div class="mb-4">
              <app-alert variant="error" [message]="err" />
            </div>
          }

          <div class="mb-5">
            <app-form-field
              fieldId="email"
              [control]="emailCtrl"
              label="Correo electrónico"
              type="email"
              placeholder="super&#64;edushift.pe"
              autocomplete="email"
              theme="dark"
              [error]="errorMessage('email')"
            />
          </div>

          <div class="mb-6">
            <app-password-field
              fieldId="password"
              [control]="passwordCtrl"
              label="Contraseña"
              autocomplete="current-password"
              theme="dark"
              [error]="errorMessage('password')"
            />
          </div>

          <app-submit-button
            [loading]="loading()"
            [disabled]="form.invalid"
            theme="dark"
            size="md"
            [showArrow]="false"
            label="Ingresar"
            loadingLabel="Ingresando…"
          />
        </form>
        }

        <p class="mt-4 text-center text-xs text-slate-500">
          ¿Problemas de acceso?
          <a
            [href]="supportMailto"
            class="underline hover:text-slate-300"
            >Contacta a operaciones</a
          >. Por seguridad, las cuentas
          <code class="text-slate-400">SUPER_ADMIN</code> no usan recuperación
          self-service ni SSO externo.
        </p>

        <p class="mt-6 text-center text-xs text-slate-500">
          &copy; {{ year }} {{ appName }}. Solo personal autorizado.
        </p>
      </div>
    </div>
  `,
})
export class AdminLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AdminAuthApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly appName = APP.NAME;
  readonly year = new Date().getFullYear();

  readonly supportMailto =
    'mailto:ops@edushift.pe?subject=Acceso%20SUPER_ADMIN';

  readonly form: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  readonly emailCtrl = this.form.get('email') as FormControl<string>;
  readonly passwordCtrl = this.form.get('password') as FormControl<string>;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly mfaSetup = signal<AdminMfaEnrolmentPayload | null>(null);
  readonly onboardingToken = signal<string | null>(null);
  readonly passwordChangeToken = signal<string | null>(null);
  readonly mfaChallengeToken = signal<string | null>(null);
  readonly mfaBusy = signal(false);
  totpCode = '';
  newPassword = '';
  confirmNewPassword = '';

  errorMessage(field: 'email' | 'password'): string | null {
    const ctrl = this.form.get(field);
    if (!ctrl || !ctrl.errors || (!ctrl.dirty && !ctrl.touched)) return null;
    if (ctrl.errors['required']) return 'Este campo es obligatorio.';
    if (ctrl.errors['email']) return 'Ingresa un correo válido.';
    return null;
  }

  /**
   * The login service can throw either an {@link HttpErrorResponse}
   * (network / 4xx / 5xx) or, when MFA enrolment is required and the
   * FE is not eligible to auto-bypass, a typed
   * {@link MfaEnrolmentRequiredError}. The latter carries a
   * human-readable message already; the former is normalized through
   * {@link mapHttpError} so the operator sees consistent Spanish copy.
   */
  private resolveErrorMessage(
    err: HttpErrorResponse | MfaEnrolmentRequiredError | MfaChallengeRequiredError | PasswordChangeRequiredError,
  ): string {
    if (err instanceof PasswordChangeRequiredError) return err.message;
    if (err instanceof MfaEnrolmentRequiredError || err instanceof MfaChallengeRequiredError) {
      return err.message;
    }
    return mapHttpError(err as HttpErrorResponse, {
      rateLimit: 'Demasiados intentos. Espera un momento antes de reintentar.',
      fallback: 'Credenciales inválidas.',
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.loading.set(true);

    this.authApi.login({ email: this.emailCtrl.value, password: this.passwordCtrl.value }).subscribe({
      next: (session) => {
        this.loading.set(false);
        this.auth.setSession(session);
        this.router.navigateByUrl(ROUTES.ADMIN.DASHBOARD);
      },
      error: (err: HttpErrorResponse | MfaEnrolmentRequiredError | MfaChallengeRequiredError | PasswordChangeRequiredError) => {
        this.loading.set(false);
        if (err instanceof PasswordChangeRequiredError) {
          this.passwordCtrl.reset();
          this.passwordChangeToken.set(err.onboardingToken);
          return;
        }
        if (err instanceof MfaEnrolmentRequiredError) {
          this.beginMfaEnrolment(err);
          return;
        }
        if (err instanceof MfaChallengeRequiredError) {
          this.mfaChallengeToken.set(err.mfaToken);
          return;
        }
        this.error.set(this.resolveErrorMessage(err));
      },
    });
  }

  changeInitialPassword(): void {
    const token = this.passwordChangeToken();
    if (!token || !this.newPassword
        || this.newPassword !== this.confirmNewPassword) {
      this.error.set('La confirmación debe coincidir con la nueva contraseña.');
      return;
    }
    this.mfaBusy.set(true);
    this.error.set(null);
    this.authApi.changeInitialPassword(token, this.newPassword).subscribe({
      next: (raw) => {
        this.newPassword = '';
        this.confirmNewPassword = '';
        this.passwordChangeToken.set(null);
        this.beginMfaEnrolment(new MfaEnrolmentRequiredError(raw));
      },
      error: (err: HttpErrorResponse) => {
        this.mfaBusy.set(false);
        this.error.set(mapHttpError(err, { fallback: 'No se pudo cambiar la contraseña temporal.' }));
      },
    });
  }

  private beginMfaEnrolment(err: MfaEnrolmentRequiredError): void {
    this.mfaBusy.set(true);
    this.onboardingToken.set(err.onboardingToken);
    this.authApi.startMfaEnrolment(err.onboardingToken).subscribe({
      next: (setup) => {
        this.mfaSetup.set(setup);
        this.mfaBusy.set(false);
      },
      error: () => {
        this.mfaBusy.set(false);
        this.error.set('No se pudo iniciar la configuración MFA. Vuelve a ingresar para obtener un enlace nuevo.');
      },
    });
  }

  verifyMfa(): void {
    const token = this.onboardingToken();
    const code = Number(this.totpCode);
    if (!token || !Number.isInteger(code) || this.totpCode.length !== 6) return;
    this.mfaBusy.set(true);
    this.error.set(null);
    const setup = this.mfaSetup();
    if (!setup) {
      this.mfaBusy.set(false);
      return;
    }
    this.authApi.verifyMfaEnrolment(token, setup.secretBase32, code).subscribe({
      next: (session) => {
        this.auth.setSession(session);
        this.router.navigateByUrl(ROUTES.ADMIN.DASHBOARD);
      },
      error: () => {
        this.mfaBusy.set(false);
        this.error.set('El código no es válido o venció. Verifica tu app e inténtalo de nuevo.');
      },
    });
  }

  verifyMfaChallenge(): void {
    const token = this.mfaChallengeToken();
    if (!token || !/^\d{6}$/.test(this.totpCode)) return;
    this.mfaBusy.set(true);
    this.error.set(null);
    this.authApi.verifyMfaChallenge(token, this.totpCode).subscribe({
      next: (session) => {
        this.auth.setSession(session);
        this.router.navigateByUrl(ROUTES.ADMIN.DASHBOARD);
      },
      error: () => {
        this.mfaBusy.set(false);
        this.error.set('Código incorrecto o vencido. Ingresa uno nuevo de tu app de autenticación.');
      },
    });
  }
}

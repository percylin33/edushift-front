import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
  MfaEnrolmentRequiredError,
} from '../../services/admin-auth-api.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
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
    err: HttpErrorResponse | MfaEnrolmentRequiredError,
  ): string {
    if (err instanceof MfaEnrolmentRequiredError) {
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
      error: (err: HttpErrorResponse | MfaEnrolmentRequiredError) => {
        this.loading.set(false);
        this.error.set(this.resolveErrorMessage(err));
      },
    });
  }
}
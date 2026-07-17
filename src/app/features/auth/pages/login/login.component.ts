import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';

import { AuthService, TenantService } from '@core/services';
import { ROUTES } from '@core/constants';
import {
  AlertComponent,
  FormFieldComponent,
  PasswordFieldComponent,
  SubmitButtonComponent,
} from '@shared/components';
import { mapHttpError } from '@shared/utils';
import { environment } from '@env/environment';

import { AuthApiService } from '../../services/auth-api.service';
import { GoogleAuthService } from '../../services/google-auth.service';
import { GoogleSigninButtonComponent } from '../../components/google-signin-button/google-signin-button.component';
import { AuthStore } from '../../store/auth.store';
import { LoginRequest } from '../../models';

/**
 * Login screen.
 *
 * <h3>Why a single component, not a feature</h3>
 * The form is small (email + password), the layout (split-screen branding)
 * lives one level up in {@code AuthLayoutComponent}, and the only side
 * effect is the {@code authApi.login → auth.setSession → router.navigate}
 * chain. Splitting it further would inflate the surface without buying
 * anything testable. Forgot/reset password screens will follow the same
 * shape and lazy-load alongside this one.
 *
 * <h3>State strategy</h3>
 * <ul>
 *   <li>{@link AuthStore} — feature-local UI flags (`loading`, `error`).
 *       Pulled into the template via signals.</li>
 *   <li>{@link AuthService} — receives the resulting {@code AuthSession}
 *       and persists it. Guards / interceptors read from there.</li>
 *   <li>{@link AuthApiService} — does the actual HTTP. The mapper inside
 *       it adapts the backend's `AuthResponse` into our internal session.</li>
 * </ul>
 *
 * <h3>Error mapping</h3>
 * Backend codes (see {@code docs/modules/auth.md} §6.1) are localized to
 * Spanish via {@link mapHttpError} which reads from
 * {@link AUTH_ERROR_MESSAGES}.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    FormFieldComponent,
    PasswordFieldComponent,
    SubmitButtonComponent,
    GoogleSigninButtonComponent,
  ],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Iniciar sesión</h1>
        <p class="text-sm text-content-muted">Accede a tu workspace para continuar.</p>
      </header>

      @if (errorMessage(); as message) {
        <app-alert variant="error" [message]="message" />
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
        <app-form-field
          fieldId="tenantSlug"
          [control]="tenantSlugCtrl"
          label="Institución"
          icon="graduation-cap"
          placeholder="tecnosur"
          autocomplete="organization"
          [spellcheck]="false"
          autocapitalize="off"
          [error]="tenantSlugError()"
          hint="Identificador de tu colegio (slug). Ej: tecnosur, demo."
        />

        <app-form-field
          fieldId="email"
          [control]="emailCtrl"
          label="Correo"
          icon="mail"
          type="email"
          placeholder="tu@institucion.edu"
          autocomplete="email"
          [error]="emailError()"
        />

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <label for="password" class="block text-sm font-medium text-content">Contraseña</label>
            <a
              [routerLink]="forgotPasswordRoute"
              class="text-xs font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
            >
              ¿La olvidaste?
            </a>
          </div>
          <app-password-field
            fieldId="password"
            [control]="passwordCtrl"
            autocomplete="current-password"
            placeholder="••••••••"
            [error]="passwordError()"
          />
        </div>

        <label class="flex items-center gap-2 text-sm text-content-muted">
          <input
            type="checkbox"
            formControlName="remember"
            class="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500/30 focus:ring-offset-0"
          />
          <span>Recordarme en este dispositivo</span>
        </label>

        <app-submit-button
          [loading]="loading()"
          [disabled]="googleBusy()"
          label="Iniciar sesión"
          loadingLabel="Verificando…"
        />

        @if (googleEnabled()) {
          <div class="relative my-2 flex items-center" aria-hidden="true">
            <div class="grow border-t border-border"></div>
            <span class="shrink-0 px-3 text-xs uppercase tracking-wide text-content-subtle">
              o
            </span>
            <div class="grow border-t border-border"></div>
          </div>

          <app-google-signin-button
            [loading]="googleBusy()"
            [disabled]="loading()"
            (googleSigninClick)="onGoogleSignIn()"
          />
        }

        <p class="pt-1 text-center text-xs text-content-muted">
          ¿No tienes cuenta?
          <a
            [routerLink]="registerRoute"
            class="font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
          >
            Crea tu institución
          </a>
        </p>
      </form>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly googleAuth = inject(GoogleAuthService);

  readonly forgotPasswordRoute = ROUTES.AUTH.FORGOT_PASSWORD;
  readonly registerRoute = ROUTES.AUTH.REGISTER;

  readonly googleEnabled = computed(() => environment.google.enabled);
  readonly googleBusy = this.googleAuth.busy;

  readonly form: FormGroup = this.fb.nonNullable.group({
    tenantSlug: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(64),
      Validators.pattern(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i),
    ]),
    email: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.email,
      Validators.maxLength(254),
    ]),
    password: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(128),
    ]),
    remember: this.fb.nonNullable.control(true),
  });

  readonly loading = this.store.loading;
  readonly errorMessage = this.store.error;

  readonly tenantSlugCtrl = this.form.get('tenantSlug') as FormControl<string>;
  readonly emailCtrl = this.form.get('email') as FormControl<string>;
  readonly passwordCtrl = this.form.get('password') as FormControl<string>;

  tenantSlugError(): string | null {
    const ctrl = this.form.get('tenantSlug');
    if (!ctrl || !ctrl.touched || !ctrl.errors) return null;
    if (ctrl.hasError('required')) return 'Ingresa el identificador de tu institución.';
    if (ctrl.hasError('pattern')) return 'Solo letras, números y guiones (3-64 caracteres).';
    if (ctrl.hasError('maxlength')) return 'El identificador es demasiado largo.';
    return null;
  }

  emailError(): string | null {
    const ctrl = this.form.get('email');
    if (!ctrl || !ctrl.touched || !ctrl.errors) return null;
    if (ctrl.hasError('required')) return 'El correo es obligatorio.';
    if (ctrl.hasError('email')) return 'Ingresa un correo válido.';
    if (ctrl.hasError('maxlength')) return 'El correo es demasiado largo.';
    return null;
  }

  passwordError(): string | null {
    const ctrl = this.form.get('password');
    if (!ctrl || !ctrl.touched || !ctrl.errors) return null;
    if (ctrl.hasError('required')) return 'La contraseña es obligatoria.';
    if (ctrl.hasError('maxlength')) return 'La contraseña es demasiado larga.';
    return null;
  }

  /**
   * Open the Google account chooser, ship the resulting {@code id_token}
   * to {@code POST /v1/auth/google}, then run the same boot chain as
   * the password flow ({@code setSession → me → navigate}).
   */
  async onGoogleSignIn(): Promise<void> {
    if (this.loading() || this.googleBusy()) return;

    this.tenantSlugCtrl.markAsTouched();
    if (this.tenantSlugCtrl.invalid) {
      this.store.setError(
        'Ingresa el identificador de tu institución antes de continuar con Google.',
      );
      return;
    }

    const tenantSlug: string = this.tenantSlugCtrl.value.trim().toLowerCase();
    this.tenant.setSlug(tenantSlug);

    this.store.setError(null);
    try {
      const { idToken } = await this.googleAuth.signIn();
      if (!idToken) {
        this.store.setError('Google no devolvió un token válido. Inténtalo de nuevo.');
        return;
      }

      this.store.setLoading(true);
      this.authApi
        .loginWithGoogle({ idToken })
        .pipe(
          tap((session) => this.auth.setSession(session)),
          switchMap(() =>
            this.authApi.me().pipe(
              tap((user) => this.auth.setUser(user)),
              catchError(() => of(null)),
            ),
          ),
          finalize(() => this.store.setLoading(false)),
        )
        .subscribe({
          next: () => {
            const returnUrl =
              this.route.snapshot.queryParamMap.get('returnUrl') ?? ROUTES.DASHBOARD.ROOT;
            this.router.navigateByUrl(returnUrl);
          },
          error: (err: HttpErrorResponse) => {
            this.store.setError(mapHttpError(err));
          },
        });
    } catch (err) {
      console.warn('[google-signin] popup flow failed', err);
      const message = err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.';
      this.store.setError(message);
    }
  }

  onSubmit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const tenantSlug: string = this.tenantSlugCtrl.value.trim().toLowerCase();
    const payload: LoginRequest = {
      email: this.emailCtrl.value.trim().toLowerCase(),
      password: this.passwordCtrl.value,
    };

    this.tenant.clear();
    this.tenant.setSlug(tenantSlug);
    this.store.beginSubmit();

    this.authApi
      .login(payload)
      .pipe(finalize(() => this.store.setLoading(false)))
      .subscribe({
        next: (result) => {
          if (result.kind === 'mfa-required') {
            this.auth.setMfaToken(result.mfa.mfaToken, result.mfa.expiresInSec);
            this.store.setLoading(false);
            const returnUrl =
              this.route.snapshot.queryParamMap.get('returnUrl') ?? ROUTES.DASHBOARD.ROOT;
            this.router.navigate(['/auth/mfa-challenge'], {
              queryParams: { returnUrl },
            });
            return;
          }

          this.auth.setSession(result.session);
          this.authApi
            .me()
            .pipe(
              tap((user) => this.auth.setUser(user)),
              catchError(() => of(null)),
            )
            .subscribe(() => {
              const returnUrl =
                this.route.snapshot.queryParamMap.get('returnUrl') ?? ROUTES.DASHBOARD.ROOT;
              this.router.navigateByUrl(returnUrl);
            });
        },
        error: (err: HttpErrorResponse) => {
          this.store.failSubmit(err);
        },
      });
  }

  /**
   * Backwards-compatible wrapper preserved for the unit-test suite which
   * exercises this method directly via `(component as any).toMessage(err)`.
   * Production code should prefer {@link mapHttpError} + the store helpers.
   */
  private toMessage(err: HttpErrorResponse): string {
    return mapHttpError(err);
  }
}
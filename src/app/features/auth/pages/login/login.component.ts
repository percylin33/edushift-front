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

import { AuthApiService } from '../../services/auth-api.service';
import { AuthStore } from '../../store/auth.store';
import { LoginRequest } from '../../models';

// Google Sign-In is intentionally NOT imported here. The
// `@abacritt/angularx-social-login` SDK would otherwise be inlined
// into the login lazy chunk (esbuild's reachability analysis traces
// through `GoogleAuthService.signIn()` and `GoogleSigninWrapperComponent`'s
// input/output bindings). To re-enable Google, see the comment block
// in `main.ts` for the dynamic-import pattern documented inline.

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
    // GoogleSigninWrapperComponent was removed because the SDK it
    // statically imports (angularx-social-login) drags the SDK into the
    // login lazy chunk via esbuild's reachability analysis. The wrapper
    // stays as dead code at src/app/features/auth/components/google-signin-wrapper/.
    // Re-introduce it once the team implements the dynamic-import pattern
    // described in src/main.ts.
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
          label="Iniciar sesión"
          loadingLabel="Verificando…"
        />

        @if (googleEnabled()) {
          <!--
            Google Sign-In is temporarily disabled while we wait for a
            dynamic-import rewrite (see main.ts). The component stub
            GoogleSigninWrapperComponent is kept in the codebase but not
            imported here. When environment.google.enabled flips to true
            again, re-introduce the lazy wrapper and the onGoogleSignIn
            handler below.
          -->
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

  readonly forgotPasswordRoute = ROUTES.AUTH.FORGOT_PASSWORD;
  readonly registerRoute = ROUTES.AUTH.REGISTER;

  // Whether the Google Sign-In button should be rendered. While the
  // social-login SDK is excluded from the production bundle (see
  // `main.ts` for the re-enable recipe) this is intentionally a
  // no-op so the @if branch never executes.
  readonly googleEnabled = computed(() => false);

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

  // Google Sign-In handler has been removed together with the rest of
  // the Google flow while the social-login SDK is excluded from the
  // production bundle. See `main.ts` for the re-enable recipe.

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
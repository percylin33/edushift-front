import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, finalize, switchMap, tap } from 'rxjs/operators';

import { AuthService, TenantService } from '@core/services';
import { ROUTES } from '@core/constants';
import { ApiError, ApiResponse } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';
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
 * The backend emits stable {@code code}s in the {@link ApiError} payload
 * (see {@code docs/modules/auth.md} §6). We localize them to Spanish
 * messages here so the form can show actionable copy without coupling
 * components to the backend's English defaults.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    GoogleSigninButtonComponent,
  ],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Iniciar sesión</h1>
        <p class="text-sm text-content-muted">Accede a tu workspace para continuar.</p>
      </header>

      @if (errorMessage(); as message) {
        <div
          role="alert"
          class="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
        >
          <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
          <span>{{ message }}</span>
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
        <!-- Tenant slug (institución) -->
        <div class="space-y-1.5">
          <label for="tenantSlug" class="block text-sm font-medium text-content">Institución</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
            >
              <app-icon name="graduation-cap" [size]="16" />
            </span>
            <input
              id="tenantSlug"
              type="text"
              autocomplete="organization"
              formControlName="tenantSlug"
              spellcheck="false"
              autocapitalize="off"
              [attr.aria-invalid]="tenantSlugInvalid()"
              [attr.aria-describedby]="tenantSlugInvalid() ? 'tenant-error' : 'tenant-help'"
              placeholder="tecnosur"
              class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
            />
          </div>
          @if (tenantSlugInvalid()) {
            <p id="tenant-error" class="text-xs text-danger">{{ tenantSlugError() }}</p>
          } @else {
            <p id="tenant-help" class="text-xs text-content-subtle">
              Identificador de tu colegio (slug). Ej: <code>tecnosur</code>, <code>demo</code>.
            </p>
          }
        </div>

        <!-- Email -->
        <div class="space-y-1.5">
          <label for="email" class="block text-sm font-medium text-content">Correo</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
            >
              <app-icon name="mail" [size]="16" />
            </span>
            <input
              id="email"
              type="email"
              autocomplete="email"
              formControlName="email"
              spellcheck="false"
              [attr.aria-invalid]="emailInvalid()"
              [attr.aria-describedby]="emailInvalid() ? 'email-error' : null"
              placeholder="tu@institucion.edu"
              class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
            />
          </div>
          @if (emailInvalid()) {
            <p id="email-error" class="text-xs text-danger">{{ emailError() }}</p>
          }
        </div>

        <!-- Password -->
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
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
            >
              <app-icon name="lock" [size]="16" />
            </span>
            <input
              id="password"
              [type]="passwordVisible() ? 'text' : 'password'"
              autocomplete="current-password"
              formControlName="password"
              [attr.aria-invalid]="passwordInvalid()"
              [attr.aria-describedby]="passwordInvalid() ? 'password-error' : null"
              placeholder="••••••••"
              class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-10 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-content-subtle hover:text-content focus:outline-none"
              [attr.aria-label]="passwordVisible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              (click)="togglePasswordVisibility()"
            >
              <app-icon [name]="passwordVisible() ? 'eye-off' : 'eye'" [size]="16" />
            </button>
          </div>
          @if (passwordInvalid()) {
            <p id="password-error" class="text-xs text-danger">{{ passwordError() }}</p>
          }
        </div>

        <!-- Remember me -->
        <label class="flex items-center gap-2 text-sm text-content-muted">
          <input
            type="checkbox"
            formControlName="remember"
            class="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500/30 focus:ring-offset-0"
          />
          <span>Recordarme en este dispositivo</span>
        </label>

        <!-- Submit -->
        <button
          type="submit"
          [disabled]="loading() || googleBusy() || form.invalid"
          class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          @if (loading()) {
            <app-spinner [size]="16" label="Verificando…" />
            <span>Verificando…</span>
          } @else {
            <span>Iniciar sesión</span>
            <app-icon name="arrow-right" [size]="16" />
          }
        </button>

        @if (googleEnabled()) {
          <!--
            Divider + Google button are only rendered when the deployment
            has the provider configured. Keeps the UI clean for tenants
            that have not opted in.
          -->
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

  /**
   * The Google Sign-in button is only shown when the deployment has
   * `environment.google.enabled === true`. We compute it from the env
   * so a future hot-reload of the env file flips the UI without
   * requiring a code change.
   */
  readonly googleEnabled = computed(() => environment.google.enabled);

  /** Busy flag mirrored from {@link GoogleAuthService.busy}. */
  readonly googleBusy = this.googleAuth.busy;

  /* Pre-fill the institución field with the tenant resolved by
   * {@link TenantService} (subdomain in production, query param if present,
   * cached slug otherwise). The user can override before submitting — that's
   * the whole point of surfacing the field instead of trusting the cache
   * silently (#bug 2026-06-14: cached slug from a previous login was sent
   * to /auth/login when switching tenants, producing BAD_CREDENTIALS). */
  readonly form: FormGroup = this.fb.nonNullable.group({
    tenantSlug: [
      this.tenant.tenantSlug() ?? '',
      [
        Validators.required,
        Validators.maxLength(64),
        Validators.pattern(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/i),
      ],
    ],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(128)]],
    remember: [true],
  });

  /* Pulled out so the template can show errors with `aria-invalid` and a
   * leading visual marker the moment the user starts typing. We use
   * `signal()` rather than `toSignal()` to keep this synchronous — the
   * template runs in `OnPush` and these computeds re-evaluate on every CD. */
  private readonly _passwordVisible = signal(false);
  readonly passwordVisible = this._passwordVisible.asReadonly();

  readonly loading = this.store.loading;
  readonly errorMessage = this.store.error;

  readonly tenantSlugInvalid = computed(() => {
    const ctrl = this.form.get('tenantSlug');
    return !!ctrl && ctrl.touched && ctrl.invalid;
  });
  readonly tenantSlugError = computed(() => {
    const ctrl = this.form.get('tenantSlug');
    if (!ctrl) return '';
    if (ctrl.hasError('required')) return 'Ingresa el identificador de tu institución.';
    if (ctrl.hasError('pattern')) return 'Solo letras, números y guiones (3-64 caracteres).';
    if (ctrl.hasError('maxlength')) return 'El identificador es demasiado largo.';
    return '';
  });

  readonly emailInvalid = computed(() => {
    const ctrl = this.form.get('email');
    return !!ctrl && ctrl.touched && ctrl.invalid;
  });
  readonly emailError = computed(() => {
    const ctrl = this.form.get('email');
    if (!ctrl) return '';
    if (ctrl.hasError('required')) return 'El correo es obligatorio.';
    if (ctrl.hasError('email')) return 'Ingresa un correo válido.';
    if (ctrl.hasError('maxlength')) return 'El correo es demasiado largo.';
    return '';
  });

  readonly passwordInvalid = computed(() => {
    const ctrl = this.form.get('password');
    return !!ctrl && ctrl.touched && ctrl.invalid;
  });
  readonly passwordError = computed(() => {
    const ctrl = this.form.get('password');
    if (!ctrl) return '';
    if (ctrl.hasError('required')) return 'La contraseña es obligatoria.';
    if (ctrl.hasError('maxlength')) return 'La contraseña es demasiado larga.';
    return '';
  });

  togglePasswordVisibility(): void {
    this._passwordVisible.update((v) => !v);
  }

  /**
   * Open the Google account chooser, ship the resulting {@code id_token}
   * to {@code POST /v1/auth/google}, then run the same boot chain as
   * the password flow ({@code setSession → me → navigate}).
   *
   * <p>The tenant slug must already be present in {@link TenantService}
   * (the user typed it in the institution field above the button), so
   * the {@code tenantInterceptor} forwards it correctly. If the field is
   * empty or invalid we surface a validation message instead of opening
   * the popup — no point authenticating an identity into an unknown
   * tenant.
   */
  async onGoogleSignIn(): Promise<void> {
    if (this.loading() || this.googleBusy()) return;

    // Make sure the institution field is valid before we bounce the
    // user through the Google popup. Otherwise they could end up
    // authenticated with no clear idea where they're being logged into.
    this.form.controls['tenantSlug'].markAsTouched();
    if (this.form.controls['tenantSlug'].invalid) {
      this.store.setError(
        'Ingresa el identificador de tu institución antes de continuar con Google.',
      );
      return;
    }

    const tenantSlug: string = this.form.controls['tenantSlug'].value.trim().toLowerCase();
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
            this.store.setError(this.toMessage(err));
          },
        });
    } catch (err) {
      // User closed the popup, denied consent, or Google itself errored.
      // We log the raw error so it's visible in dev tools, but we keep
      // the user-facing copy friendly.
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

    const tenantSlug: string = this.form.controls['tenantSlug'].value.trim().toLowerCase();
    const payload: LoginRequest = {
      email: this.form.controls['email'].value.trim().toLowerCase(),
      password: this.form.controls['password'].value,
    };

    /* Push the user-provided slug into TenantService BEFORE firing /login so
     * the tenant.interceptor reads it instead of the stale cached value. */
    this.tenant.setSlug(tenantSlug);

    this.store.setLoading(true);
    this.store.setError(null);

    this.authApi
      .login(payload)
      .pipe(finalize(() => this.store.setLoading(false)))
      .subscribe({
        next: (result) => {
          // Sprint 17 / BE-17.2: the same endpoint can return either a
          // full session (the user can be logged in immediately) or an
          // MFA challenge (the password is correct but the user has 2FA
          // enabled). The sealed LoginResult discriminates — we pattern-
          // match here and route accordingly.
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

          // Full session path: stash it, enrich with /me, navigate.
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
          this.store.setError(this.toMessage(err));
        },
      });
  }

  /**
   * Map backend error codes to Spanish UI messages. Codes catalogued in
   * `docs/modules/auth.md` §6.1.
   */
  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }

    const apiError = this.firstApiError(err);
    const code = apiError?.code;
    const fallback = apiError?.message;

    switch (code) {
      case 'BAD_CREDENTIALS':
        return 'Correo o contraseña incorrectos.';
      case 'TENANT_REQUIRED':
        return 'No se identificó la institución. Recarga la página e inténtalo de nuevo.';
      case 'TENANT_INACTIVE':
        return 'Tu institución está inactiva. Contacta al administrador.';
      case 'USER_LOCKED':
        return 'Tu cuenta está bloqueada. Contacta al administrador.';
      case 'USER_SUSPENDED':
        return 'Tu cuenta está suspendida. Contacta al administrador.';
      case 'USER_INACTIVE':
        return 'Tu cuenta está deshabilitada. Contacta al administrador.';
      case 'EMAIL_NOT_VERIFIED':
        return 'Verifica tu correo antes de iniciar sesión.';
      case 'USER_NOT_AUTHENTICATABLE':
        return 'No es posible autenticar tu cuenta en este momento.';
      case 'VALIDATION_ERROR':
        return fallback ?? 'Revisa los datos ingresados.';
      // Sprint 11 / PR-1 — Google Sign-in error catalogue. The BE is
      // the source of truth; these cases mirror `docs/api/endpoints.md`
      // §"POST /v1/auth/google".
      case 'GOOGLE_PROVIDER_DISABLED':
        return 'El inicio de sesión con Google no está disponible en este momento.';
      case 'INVALID_GOOGLE_TOKEN':
        return 'La sesión con Google expiró o es inválida. Vuelve a intentarlo.';
      case 'TENANT_NOT_FOUND':
        return 'No se encontró la institución solicitada.';
    }

    if (err.status === 404) {
      return 'No se encontró la institución solicitada.';
    }
    if (err.status === 401) {
      return fallback ?? 'No se pudo iniciar sesión. Revisa tus credenciales.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }

    return fallback ?? 'No se pudo iniciar sesión.';
  }

  private firstApiError(err: HttpErrorResponse): ApiError | null {
    /* Backend errors come either as a wrapped `ApiResponse` (newer style
     * with `errors: [...]`) or as a flat `ApiError` (older style). We try
     * both shapes here so we don't have to care about the boundary. */
    const body = err.error as
      (ApiResponse<unknown> & { errors?: ApiError[] }) | ApiError | null | undefined;

    if (body && typeof body === 'object') {
      if ('errors' in body && Array.isArray(body.errors) && body.errors.length > 0) {
        return body.errors[0];
      }
      if ('code' in body || 'message' in body) {
        return body as ApiError;
      }
    }
    return null;
  }
}

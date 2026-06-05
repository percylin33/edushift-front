import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';

import { AuthService, TenantService } from '@core/services';
import { ROUTES } from '@core/constants';
import { ApiError, ApiResponse } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';

import { RegisterTenantRequest, TenantApiService } from '@features/tenants';
import { AuthApiService } from '../../services/auth-api.service';
import { AuthStore } from '../../store/auth.store';

/**
 * Self-signup screen. Creates a tenant + its first admin in one shot
 * via {@code POST /v1/tenants/register}, persists the resulting session
 * with {@link AuthService#setSession}, hydrates the tenant context, and
 * drops the new owner into the onboarding flow.
 *
 * <h3>Why one component, not a feature</h3>
 * Same rationale as {@code LoginComponent}: small surface, no
 * persistence beyond the session that already lands in {@code AuthService},
 * shared layout shell ({@code AuthLayoutComponent}). Nesting it under
 * a dedicated feature would inflate the file tree without buying any
 * test seam — the only branching is field-level error mapping, which
 * is already centralized in {@link #toFieldError} / {@link #toMessage}.
 *
 * <h3>Slug auto-derivation</h3>
 * Typing the tenant name is enough to populate the slug field too, until
 * the user manually edits the slug — {@link #_slugTouchedByUser} flips
 * once and we then leave the slug alone. This keeps the form fast for
 * 95% of signups while still letting power users pick a vanity slug
 * (e.g. {@code colegio-san-jose-2026}) different from the display name.
 *
 * <h3>What happens after success</h3>
 * The backend's {@code TenantService.register} returns an
 * {@code AuthResponse} (mirrors {@code /auth/login}) so we can:
 * <ol>
 *   <li>Persist the session immediately ({@code AuthService#setSession}).
 *   <li>Re-fetch the freshly-created tenant via {@code GET /tenants/me}
 *       to hydrate {@code TenantService} with authoritative data
 *       (status, plan, branding) — the register response intentionally
 *       does not include the tenant payload, mirroring {@code /login}'s
 *       slim shape.</li>
 *   <li>Navigate to {@code /onboarding/welcome}. A failure during the
 *       hydration step is non-fatal — guards will retry on the next
 *       request — so we log it and proceed.</li>
 * </ol>
 */
@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, SpinnerComponent],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Crear institución</h1>
        <p class="text-sm text-content-muted">
          Empieza tu prueba gratuita de 14 días. No pediremos tarjeta.
        </p>
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
        <!-- Nombre de la institución -->
        <div class="space-y-1.5">
          <label for="tenantName" class="block text-sm font-medium text-content"
            >Nombre de la institución</label
          >
          <input
            id="tenantName"
            type="text"
            autocomplete="organization"
            formControlName="tenantName"
            [attr.aria-invalid]="invalid('tenantName')"
            [attr.aria-describedby]="invalid('tenantName') ? 'tenantName-error' : null"
            placeholder="Colegio San José"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content
                   placeholder:text-content-subtle
                   focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30
                   disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
          />
          @if (invalid('tenantName')) {
            <p id="tenantName-error" class="text-xs text-danger">{{ errorOf('tenantName') }}</p>
          }
        </div>

        <!-- Slug -->
        <div class="space-y-1.5">
          <label for="tenantSlug" class="block text-sm font-medium text-content"
            >Identificador de tu workspace</label
          >
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
            >
              <app-icon name="globe" [size]="16" />
            </span>
            <input
              id="tenantSlug"
              type="text"
              autocomplete="off"
              spellcheck="false"
              formControlName="tenantSlug"
              (input)="markSlugAsTouched()"
              [attr.aria-invalid]="invalid('tenantSlug')"
              [attr.aria-describedby]="invalid('tenantSlug') ? 'tenantSlug-error' : 'tenantSlug-hint'"
              placeholder="colegio-san-jose"
              class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-content
                     placeholder:text-content-subtle
                     focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30
                     disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
            />
          </div>
          @if (invalid('tenantSlug')) {
            <p id="tenantSlug-error" class="text-xs text-danger">{{ errorOf('tenantSlug') }}</p>
          } @else {
            <p id="tenantSlug-hint" class="text-xs text-content-muted">
              Solo minúsculas, números y guiones. Ejemplo:
              <span class="font-mono">{{ slugPreview() || 'colegio-san-jose' }}</span>
            </p>
          }
        </div>

        <!-- Nombre + Apellido del admin -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label for="adminFirstName" class="block text-sm font-medium text-content"
              >Tu nombre</label
            >
            <input
              id="adminFirstName"
              type="text"
              autocomplete="given-name"
              formControlName="adminFirstName"
              [attr.aria-invalid]="invalid('adminFirstName')"
              [attr.aria-describedby]="invalid('adminFirstName') ? 'adminFirstName-error' : null"
              placeholder="María"
              class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content
                     placeholder:text-content-subtle
                     focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30
                     disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
            />
            @if (invalid('adminFirstName')) {
              <p id="adminFirstName-error" class="text-xs text-danger">
                {{ errorOf('adminFirstName') }}
              </p>
            }
          </div>
          <div class="space-y-1.5">
            <label for="adminLastName" class="block text-sm font-medium text-content"
              >Apellido</label
            >
            <input
              id="adminLastName"
              type="text"
              autocomplete="family-name"
              formControlName="adminLastName"
              [attr.aria-invalid]="invalid('adminLastName')"
              [attr.aria-describedby]="invalid('adminLastName') ? 'adminLastName-error' : null"
              placeholder="García"
              class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content
                     placeholder:text-content-subtle
                     focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30
                     disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
            />
            @if (invalid('adminLastName')) {
              <p id="adminLastName-error" class="text-xs text-danger">
                {{ errorOf('adminLastName') }}
              </p>
            }
          </div>
        </div>

        <!-- Email -->
        <div class="space-y-1.5">
          <label for="adminEmail" class="block text-sm font-medium text-content">Correo</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
            >
              <app-icon name="mail" [size]="16" />
            </span>
            <input
              id="adminEmail"
              type="email"
              autocomplete="email"
              spellcheck="false"
              formControlName="adminEmail"
              [attr.aria-invalid]="invalid('adminEmail')"
              [attr.aria-describedby]="invalid('adminEmail') ? 'adminEmail-error' : null"
              placeholder="tu@institucion.edu"
              class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-content
                     placeholder:text-content-subtle
                     focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30
                     disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
            />
          </div>
          @if (invalid('adminEmail')) {
            <p id="adminEmail-error" class="text-xs text-danger">{{ errorOf('adminEmail') }}</p>
          }
        </div>

        <!-- Password -->
        <div class="space-y-1.5">
          <label for="adminPassword" class="block text-sm font-medium text-content"
            >Contraseña</label
          >
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
            >
              <app-icon name="lock" [size]="16" />
            </span>
            <input
              id="adminPassword"
              [type]="passwordVisible() ? 'text' : 'password'"
              autocomplete="new-password"
              formControlName="adminPassword"
              [attr.aria-invalid]="invalid('adminPassword')"
              [attr.aria-describedby]="invalid('adminPassword') ? 'adminPassword-error' : 'adminPassword-hint'"
              placeholder="Mínimo 8 caracteres"
              class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-10 text-sm text-content
                     placeholder:text-content-subtle
                     focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30
                     disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
            />
            <button
              type="button"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-content-subtle
                     hover:text-content focus:outline-none"
              [attr.aria-label]="passwordVisible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              (click)="togglePasswordVisibility()"
            >
              <app-icon [name]="passwordVisible() ? 'eye-off' : 'eye'" [size]="16" />
            </button>
          </div>
          @if (invalid('adminPassword')) {
            <p id="adminPassword-error" class="text-xs text-danger">
              {{ errorOf('adminPassword') }}
            </p>
          } @else {
            <p id="adminPassword-hint" class="text-xs text-content-muted">
              Entre 8 y 128 caracteres.
            </p>
          }
        </div>

        <!-- Submit -->
        <button
          type="submit"
          [disabled]="loading() || form.invalid"
          class="inline-flex w-full items-center justify-center gap-2 rounded-md
                 bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white
                 transition-colors hover:bg-primary-700 focus-visible:outline-none
                 focus-visible:ring-2 focus-visible:ring-primary-500/40
                 disabled:cursor-not-allowed disabled:opacity-60"
        >
          @if (loading()) {
            <app-spinner [size]="16" label="Creando…" />
            <span>Creando institución…</span>
          } @else {
            <span>Crear institución</span>
            <app-icon name="arrow-right" [size]="16" />
          }
        </button>

        <p class="pt-1 text-center text-xs text-content-muted">
          ¿Ya tienes una cuenta?
          <a
            [routerLink]="loginRoute"
            class="font-medium text-primary-700 hover:text-primary-800
                   dark:text-primary-300 dark:hover:text-primary-200"
          >
            Inicia sesión
          </a>
        </p>
      </form>
    </div>
  `
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tenantApi = inject(TenantApiService);
  private readonly authApi = inject(AuthApiService);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly store = inject(AuthStore);
  private readonly router = inject(Router);

  readonly loginRoute = ROUTES.AUTH.LOGIN;

  /**
   * Validators mirror the backend constraints in
   * {@code RegisterTenantRequest.java} / {@code Tenant.java}. Sources of truth:
   * <ul>
   *   <li>Slug regex: V4__create_tenants_table.sql {@code chk_tenants_slug_format}.</li>
   *   <li>Length bounds: bean validation annotations on the record.</li>
   * </ul>
   */
  readonly form: FormGroup = this.fb.nonNullable.group({
    tenantName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    tenantSlug: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(80),
        Validators.pattern(/^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/)
      ]
    ],
    adminFirstName: ['', [Validators.required, Validators.maxLength(100)]],
    adminLastName: ['', [Validators.required, Validators.maxLength(100)]],
    adminEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    adminPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]]
  });

  private readonly _passwordVisible = signal(false);
  readonly passwordVisible = this._passwordVisible.asReadonly();

  /**
   * Tracks whether the user has manually typed in the slug field. Once
   * true, name → slug syncing is suspended for the lifetime of the form
   * — even if the user re-edits the name afterwards. Avoids the classic
   * "I customized my slug and you reverted it" frustration.
   */
  private _slugTouchedByUser = false;

  readonly loading = this.store.loading;
  readonly errorMessage = this.store.error;

  /** Live preview of what the user is typing once it normalizes. Same algorithm as backend slug check (lower / strip). */
  readonly slugPreview = computed(() => {
    const value = (this.form.controls['tenantSlug'].value ?? '').trim();
    return value.toLowerCase();
  });

  constructor() {
    /* Keep the slug in lockstep with the tenant name until the user
     * decides otherwise. We do this via valueChanges (not effect) so
     * the slug field's own valueChanges don't loop. */
    this.form.controls['tenantName'].valueChanges.subscribe((name: string) => {
      if (this._slugTouchedByUser) return;
      const generated = this.toSlug(name);
      this.form.controls['tenantSlug'].setValue(generated, { emitEvent: false });
    });
  }

  togglePasswordVisibility(): void {
    this._passwordVisible.update((v) => !v);
  }

  markSlugAsTouched(): void {
    this._slugTouchedByUser = true;
  }

  invalid(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }

  errorOf(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl) return '';
    if (ctrl.hasError('required')) return 'Este campo es obligatorio.';
    if (ctrl.hasError('email')) return 'Ingresa un correo válido.';
    if (ctrl.hasError('minlength')) {
      const min = ctrl.getError('minlength').requiredLength;
      return `Mínimo ${min} caracteres.`;
    }
    if (ctrl.hasError('maxlength')) {
      const max = ctrl.getError('maxlength').requiredLength;
      return `Máximo ${max} caracteres.`;
    }
    if (ctrl.hasError('pattern')) {
      if (name === 'tenantSlug') {
        return 'Solo letras minúsculas, números y guiones (sin espacios ni acentos).';
      }
      return 'Formato inválido.';
    }
    if (ctrl.hasError('serverField')) {
      return ctrl.getError('serverField') as string;
    }
    return '';
  }

  onSubmit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: RegisterTenantRequest = {
      tenantName: raw.tenantName.trim(),
      tenantSlug: raw.tenantSlug.trim().toLowerCase(),
      adminEmail: raw.adminEmail.trim().toLowerCase(),
      adminPassword: raw.adminPassword,
      adminFirstName: raw.adminFirstName.trim(),
      adminLastName: raw.adminLastName.trim()
    };

    this.store.setLoading(true);
    this.store.setError(null);

    /* Two-step flow:
     *   register  → AuthSession (auth state hydrated, bearer ready)
     *   findCurrent → Tenant (theme + layout sourced from authoritative DTO)
     * Hydrating the tenant is best-effort: if it fails we still log the
     * user in and let route guards / interceptors retry on the next call. */
    this.tenantApi
      .register(payload)
      .pipe(
        tap((session) => this.auth.setSession(session)),
        /* `register` returns a lean {@code UserSummary}; chain {@code /auth/me}
         * so role-gated guards see the freshly-minted {@code TENANT_ADMIN}
         * instead of an empty role set. */
        switchMap(() =>
          this.authApi.me().pipe(
            tap((user) => this.auth.setUser(user)),
            catchError(() => of(null))
          )
        ),
        switchMap(() =>
          this.tenantApi.findCurrent().pipe(
            tap((tenant) => this.tenant.setTenant(tenant, 'header')),
            catchError(() => of(null))
          )
        ),
        finalize(() => this.store.setLoading(false))
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(ROUTES.ONBOARDING.WELCOME);
        },
        error: (err: HttpErrorResponse) => {
          this.applyServerErrors(err);
        }
      });
  }

  /** Lower-case, ASCII-fold, replace runs of non-alphanumerics with `-`, trim leading/trailing dashes. */
  private toSlug(name: string): string {
    if (!name) return '';
    return name
      .normalize('NFKD') // decomposed accents
      .replace(/[\u0300-\u036f]/g, '') // strip combining marks
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  /**
   * Map backend errors to either field-level form errors or a top-level
   * banner. Codes mirror {@code TenantServiceImpl.register} +
   * Spring's standard {@code VALIDATION_ERROR} envelope.
   */
  private applyServerErrors(err: HttpErrorResponse): void {
    if (err.status === 0) {
      this.store.setError('No se pudo conectar con el servidor. Verifica tu conexión.');
      return;
    }

    const apiError = this.firstApiError(err);
    const code = apiError?.code;
    const fallback = apiError?.message;

    switch (code) {
      case 'TENANT_SLUG_TAKEN':
        this.form.controls['tenantSlug'].setErrors({
          serverField: 'Este identificador ya está en uso. Elige otro.'
        });
        this.form.controls['tenantSlug'].markAsTouched();
        this.store.setError('Revisa el identificador del workspace.');
        return;
      case 'CUSTOM_DOMAIN_TAKEN':
        this.store.setError(fallback ?? 'El dominio personalizado ya está en uso.');
        return;
      case 'EMAIL_TAKEN':
      case 'USER_EMAIL_TAKEN':
        this.form.controls['adminEmail'].setErrors({
          serverField: 'Ya existe una cuenta con este correo.'
        });
        this.form.controls['adminEmail'].markAsTouched();
        this.store.setError('Revisa el correo.');
        return;
      case 'VALIDATION_ERROR':
        this.store.setError(fallback ?? 'Revisa los datos ingresados.');
        return;
    }

    if (err.status === 409) {
      this.store.setError(fallback ?? 'Ya existe una institución con esos datos.');
      return;
    }
    if (err.status === 400) {
      this.store.setError(fallback ?? 'Revisa los datos ingresados.');
      return;
    }
    if (err.status >= 500) {
      this.store.setError('Ocurrió un error inesperado. Intenta nuevamente en unos minutos.');
      return;
    }

    this.store.setError(fallback ?? 'No se pudo crear la institución.');
  }

  private firstApiError(err: HttpErrorResponse): ApiError | null {
    const body = err.error as
      | (ApiResponse<unknown> & { errors?: ApiError[] })
      | ApiError
      | null
      | undefined;
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

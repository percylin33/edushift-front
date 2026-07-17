import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of, switchMap, tap } from 'rxjs';

import { AuthService, TenantService } from '@core/services';
import { ROUTES } from '@core/constants';
import {
  AlertComponent,
  FormFieldComponent,
  PasswordFieldComponent,
  SubmitButtonComponent,
} from '@shared/components';
import { slugify } from '@shared/utils';

import { RegisterTenantRequest, TenantApiService } from '@features/tenants';
import { AuthApiService } from '../../services/auth-api.service';
import { AuthStore } from '../../store/auth.store';

/**
 * Self-signup screen. Creates a tenant + its first admin in one shot
 * via {@code POST /v1/tenants/register}, persists the resulting session
 * with {@link AuthService#setSession}, hydrates the tenant context, and
 * drops the new owner into the onboarding flow.
 *
 * <h3>Slug auto-derivation</h3>
 * Typing the tenant name is enough to populate the slug field too, until
 * the user manually edits the slug — {@link #_slugTouchedByUser} flips
 * once and we then leave the slug alone. This keeps the form fast for
 * 95% of signups while still letting power users pick a vanity slug
 * (e.g. {@code colegio-san-jose-2026}) different from the display name.
 */
@Component({
  selector: 'app-register',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    FormFieldComponent,
    PasswordFieldComponent,
    SubmitButtonComponent,
  ],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Crear institución</h1>
        <p class="text-sm text-content-muted">
          Empieza tu prueba gratuita de 14 días. No pediremos tarjeta.
        </p>
      </header>

      @if (errorMessage(); as message) {
        <app-alert variant="error" [message]="message" />
      }

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
        <app-form-field
          fieldId="tenantName"
          [control]="tenantNameCtrl"
          label="Nombre de la institución"
          placeholder="Colegio San José"
          autocomplete="organization"
          [error]="errorOf('tenantName')"
        />

        <app-form-field
          fieldId="tenantSlug"
          [control]="tenantSlugCtrl"
          label="Identificador de tu workspace"
          icon="globe"
          placeholder="colegio-san-jose"
          autocomplete="off"
          [spellcheck]="false"
          (input)="markSlugAsTouched()"
          [error]="errorOf('tenantSlug')"
          [hint]="slugHint()"
        />

        <div class="grid grid-cols-2 gap-3">
          <app-form-field
            fieldId="adminFirstName"
            [control]="adminFirstNameCtrl"
            label="Tu nombre"
            placeholder="María"
            autocomplete="given-name"
            [error]="errorOf('adminFirstName')"
          />
          <app-form-field
            fieldId="adminLastName"
            [control]="adminLastNameCtrl"
            label="Apellido"
            placeholder="García"
            autocomplete="family-name"
            [error]="errorOf('adminLastName')"
          />
        </div>

        <app-form-field
          fieldId="adminEmail"
          [control]="adminEmailCtrl"
          label="Correo"
          icon="mail"
          type="email"
          placeholder="tu@institucion.edu"
          autocomplete="email"
          [spellcheck]="false"
          [error]="errorOf('adminEmail')"
        />

        <app-password-field
          fieldId="adminPassword"
          [control]="adminPasswordCtrl"
          label="Contraseña"
          autocomplete="new-password"
          placeholder="Mínimo 8 caracteres"
          [error]="errorOf('adminPassword')"
          hint="Entre 8 y 128 caracteres."
        />

        <app-submit-button
          [loading]="loading()"
          label="Crear institución"
          loadingLabel="Creando institución…"
        />

        <p class="pt-1 text-center text-xs text-content-muted">
          ¿Ya tienes una cuenta?
          <a
            [routerLink]="loginRoute"
            class="font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
          >
            Inicia sesión
          </a>
        </p>
      </form>
    </div>
  `,
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

  readonly form: FormGroup = this.fb.nonNullable.group({
    tenantName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    tenantSlug: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(80),
        Validators.pattern(/^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/),
      ],
    ],
    adminFirstName: ['', [Validators.required, Validators.maxLength(100)]],
    adminLastName: ['', [Validators.required, Validators.maxLength(100)]],
    adminEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    adminPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  readonly tenantNameCtrl = this.form.get('tenantName') as FormControl<string>;
  readonly tenantSlugCtrl = this.form.get('tenantSlug') as FormControl<string>;
  readonly adminFirstNameCtrl = this.form.get('adminFirstName') as FormControl<string>;
  readonly adminLastNameCtrl = this.form.get('adminLastName') as FormControl<string>;
  readonly adminEmailCtrl = this.form.get('adminEmail') as FormControl<string>;
  readonly adminPasswordCtrl = this.form.get('adminPassword') as FormControl<string>;

  /**
   * Tracks whether the user has manually typed in the slug field. Once
   * true, name → slug syncing is suspended for the lifetime of the form.
   */
  private _slugTouchedByUser = false;

  readonly loading = this.store.loading;
  readonly errorMessage = this.store.error;

  readonly slugHint = computed(
    () =>
      `Solo minúsculas, números y guiones. Ejemplo: ${(this.tenantSlugCtrl.value || '').trim().toLowerCase() || 'colegio-san-jose'}`,
  );

  constructor() {
    this.tenantNameCtrl.valueChanges.subscribe((name: string) => {
      if (this._slugTouchedByUser) return;
      this.tenantSlugCtrl.setValue(slugify(name).slice(0, 80), { emitEvent: false });
    });
  }

  markSlugAsTouched(): void {
    this._slugTouchedByUser = true;
  }

  invalid(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }

  errorOf(name: string): string | null {
    const ctrl = this.form.get(name);
    if (!ctrl || !ctrl.touched || !ctrl.errors) return null;
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
    return null;
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
      adminLastName: raw.adminLastName.trim(),
    };

    this.store.beginSubmit();

    this.tenantApi
      .register(payload)
      .pipe(
        tap((session) => this.auth.setSession(session)),
        switchMap(() =>
          this.authApi.me().pipe(
            tap((user) => this.auth.setUser(user)),
            catchError(() => of(null)),
          ),
        ),
        switchMap(() =>
          this.tenantApi.findCurrent().pipe(
            tap((t) => this.tenant.setTenant(t, 'header')),
            catchError(() => of(null)),
          ),
        ),
        finalize(() => this.store.setLoading(false)),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(ROUTES.ONBOARDING.WELCOME);
        },
        error: (err: HttpErrorResponse) => {
          this.applyServerErrors(err);
        },
      });
  }

  /**
   * Map backend errors to either field-level form errors or a top-level
   * banner. Codes mirror {@code TenantServiceImpl.register} +
   * Spring's standard {@code VALIDATION_ERROR} envelope.
   *
   * <p>The Spring {@code ApiError} envelope returns a list of
   * {@code FieldError { field, code, message }} under {@code errors[]}.
   * Each entry is bound to the matching {@link FormControl} via
   * {@code serverField}, so the same code path that renders
   * client-side validation messages in {@link #errorOf} also surfaces
   * server-side rules like {@code WEAK_PASSWORD}.
   */
  private applyServerErrors(err: HttpErrorResponse): void {
    if (err.status === 0) {
      this.store.setError('No se pudo conectar con el servidor. Verifica tu conexión.');
      return;
    }

    const body = err.error as
      | {
          code?: string;
          message?: string;
          errors?: Array<{ field?: string; code?: string; message?: string }>;
        }
      | null
      | undefined;
    const fallback = body?.message;

    // 1) Map every FieldError from the envelope onto the matching control.
    const fieldErrors = body?.errors ?? [];
    if (fieldErrors.length > 0) {
      const messages: string[] = [];
      for (const fe of fieldErrors) {
        const ctrl = fe.field ? this.form.get(fe.field) : null;
        const msg = this.translateServerFieldError(fe.field ?? '', fe.code, fe.message);
        if (ctrl) {
          ctrl.setErrors({ serverField: msg });
          ctrl.markAsTouched();
        }
        if (msg) messages.push(msg);
      }
      this.store.setError(
        messages.length === 1
          ? messages[0]
          : 'Hay datos inválidos en el formulario. Revisa los campos marcados.',
      );
      return;
    }

    // 2) Top-level business codes (slug taken, email taken, etc.).
    switch (body?.code) {
      case 'TENANT_SLUG_TAKEN':
        this.tenantSlugCtrl.setErrors({
          serverField: 'Este identificador ya está en uso. Elige otro.',
        });
        this.tenantSlugCtrl.markAsTouched();
        this.store.setError('Revisa el identificador del workspace.');
        return;
      case 'CUSTOM_DOMAIN_TAKEN':
        this.store.setError(fallback ?? 'El dominio personalizado ya está en uso.');
        return;
      case 'EMAIL_TAKEN':
      case 'USER_EMAIL_TAKEN':
        this.adminEmailCtrl.setErrors({
          serverField: 'Ya existe una cuenta con este correo.',
        });
        this.adminEmailCtrl.markAsTouched();
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

  /**
   * Translate a backend {@code FieldError} into a user-facing Spanish
   * string. Falls back to the raw {@code message} when no known mapping
   * exists so the UI still surfaces server detail instead of swallowing it.
   */
  private translateServerFieldError(
    field: string,
    code: string | undefined,
    message: string | undefined,
  ): string {
    if (code === 'WEAK_PASSWORD') {
      return 'Debe tener 8-72 caracteres con mayúscula, minúscula, dígito y carácter especial.';
    }
    if (code === 'NotBlank' || code === 'NotNull') {
      return 'Este campo es obligatorio.';
    }
    if (code === 'Email') {
      return 'Ingresa un correo válido.';
    }
    if (code === 'Size' || code === 'Length') {
      return message ?? 'Longitud fuera del rango permitido.';
    }
    if (code === 'Pattern' && field === 'tenantSlug') {
      return 'Solo letras minúsculas, números y guiones (sin espacios ni acentos).';
    }
    return message ?? 'Valor inválido.';
  }
}
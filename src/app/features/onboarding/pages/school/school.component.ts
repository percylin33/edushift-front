import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { TenantService } from '@core/services';
import { ApiError, ApiResponse } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { OnboardingService } from '@layout/services';

import { TenantApiService, UpdateTenantRequest } from '@features/tenants';
import { OnboardingStore } from '../../store';
import { ONBOARDING_STEPS } from '../../onboarding.steps';

/**
 * School step — the single data-entry page in the onboarding wizard.
 * Sends a {@code PATCH /v1/tenants/me} with the tenant's display name
 * and branding (primary color, logo URL).
 *
 * <h3>Pre-fill strategy</h3>
 * The form is hydrated from {@link TenantService} on init: the user
 * already provided a name + slug at register time, and any branding
 * the backend may have inferred (none today, but a future "starter
 * theme by industry" feature can populate it). The user only types
 * what they want to override.
 *
 * <h3>What we send vs what we leave alone</h3>
 * The PATCH body uses {@link UpdateTenantRequest}'s field-level merge
 * semantics for {@code branding}: sending {@code logoUrl: null} would
 * clear an existing logo. To avoid surprises we only include keys for
 * which the user actually provided a value — empty strings become
 * {@code undefined} and the backend keeps the prior value.
 *
 * <h3>Why not activate here</h3>
 * Activation is the {@code complete} step's job. Splitting them keeps
 * the contract explicit (PATCH = data, POST /activate = lifecycle) and
 * leaves room for future branching (e.g. a "review billing plan" step
 * between school and complete).
 */
@Component({
  selector: 'app-onboarding-school',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SpinnerComponent],
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight">Datos de la institución</h1>
      <p class="mt-1 text-sm text-content-muted">
        Personaliza el nombre y el branding que verán tus usuarios.
      </p>
    </header>

    @if (errorMessage(); as message) {
      <div
        role="alert"
        class="mb-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      >
        <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
        <span>{{ message }}</span>
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="grid gap-4 sm:grid-cols-2" novalidate>
      <div class="field sm:col-span-2">
        <label class="label" for="ob-name">Nombre de la institución</label>
        <input
          id="ob-name"
          class="input"
          type="text"
          autocomplete="organization"
          formControlName="name"
          [attr.aria-invalid]="invalid('name')"
          placeholder="Colegio EduShift"
        />
        @if (invalid('name')) {
          <p class="hint text-danger">{{ errorOf('name') }}</p>
        }
      </div>

      <div class="field sm:col-span-2">
        <label class="label" for="ob-color">Color principal</label>
        <div class="flex items-center gap-3">
          <input
            id="ob-color"
            class="h-10 w-14 cursor-pointer rounded-md border border-border bg-surface p-1"
            type="color"
            formControlName="primaryColor"
          />
          <input
            class="input flex-1 font-mono"
            type="text"
            spellcheck="false"
            formControlName="primaryColor"
            [attr.aria-invalid]="invalid('primaryColor')"
            placeholder="#0F62FE"
          />
        </div>
        @if (invalid('primaryColor')) {
          <p class="hint text-danger">{{ errorOf('primaryColor') }}</p>
        } @else {
          <p class="hint">Hex CSS (ej. <span class="font-mono">#0F62FE</span>).</p>
        }
      </div>

      <div class="field sm:col-span-2">
        <label class="label" for="ob-logo">URL del logo (opcional)</label>
        <input
          id="ob-logo"
          class="input"
          type="url"
          spellcheck="false"
          formControlName="logoUrl"
          [attr.aria-invalid]="invalid('logoUrl')"
          placeholder="https://cdn.tu-dominio.com/logo.svg"
        />
        @if (invalid('logoUrl')) {
          <p class="hint text-danger">{{ errorOf('logoUrl') }}</p>
        } @else {
          <p class="hint">
            Recomendado: SVG o PNG transparente, mínimo 256×256. Lo podrás cambiar luego.
          </p>
        }
      </div>

      <div class="card-footer -mx-5 -mb-5 mt-2 px-5 sm:col-span-2">
        <button type="button" class="btn btn-ghost" [disabled]="loading()" (click)="back()">
          Atrás
        </button>
        <button type="submit" class="btn btn-primary" [disabled]="loading() || form.invalid">
          @if (loading()) {
            <app-spinner [size]="16" label="Guardando…" />
            <span>Guardando…</span>
          } @else {
            <span>Continuar</span>
            <app-icon name="arrow-right" [size]="16" />
          }
        </button>
      </div>
    </form>
  `,
})
export class OnboardingSchoolComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tenantApi = inject(TenantApiService);
  private readonly tenantService = inject(TenantService);
  private readonly store = inject(OnboardingStore);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);

  readonly loading = this.store.loading;
  readonly errorMessage = this.store.error;

  /**
   * Validators here are slightly more forgiving than the backend's
   * {@code BrandingDto}: we accept either 3-digit ({@code #fff}) or
   * 6-digit hex on the color field, and we let the URL field be empty
   * (the backend treats null as "leave alone").
   */
  readonly form: FormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    primaryColor: [
      '',
      [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/)],
    ],
    logoUrl: ['', [Validators.maxLength(2048), Validators.pattern(/^(https?:\/\/.+)?$/)]],
  });

  /**
   * Tracks whether the form has been hydrated from the tenant signal at
   * least once. Without this, switching {@code TenantService.tenant}
   * from the placeholder to the real DTO mid-onboarding would clobber
   * what the user typed.
   */
  private readonly _hydrated = signal(false);

  /** Live-preview the chosen color in the right side of the form (as a small swatch). */
  readonly currentColor = computed(() => this.form.controls['primaryColor'].value || '#0F62FE');

  constructor() {
    /* Hydrate the form when (and only when) we first see a real tenant.
     * A bare effect() with `_hydrated` as a guard keeps the patch
     * idempotent: if a follow-up findCurrent() arrives while the user
     * is editing, we don't overwrite their work. */
    effect(() => {
      const tenant = this.store.tenant();
      if (!tenant || this._hydrated()) return;
      this.form.patchValue(
        {
          name: tenant.name,
          primaryColor: tenant.branding?.primaryColor ?? '#0F62FE',
          logoUrl: tenant.branding?.logo?.light ?? '',
        },
        { emitEvent: false },
      );
      this._hydrated.set(true);
    });
  }

  ngOnInit(): void {
    this.onboarding.setSteps(ONBOARDING_STEPS, 'school');
    this.onboarding.markCompleted('welcome');
  }

  invalid(name: string): boolean {
    const ctrl = this.form.get(name);
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }

  errorOf(name: string): string {
    const ctrl = this.form.get(name);
    if (!ctrl) return '';
    if (ctrl.hasError('required')) return 'Este campo es obligatorio.';
    if (ctrl.hasError('minlength')) {
      return `Mínimo ${ctrl.getError('minlength').requiredLength} caracteres.`;
    }
    if (ctrl.hasError('maxlength')) {
      return `Máximo ${ctrl.getError('maxlength').requiredLength} caracteres.`;
    }
    if (ctrl.hasError('pattern')) {
      if (name === 'primaryColor') return 'Usa un valor hex como #0F62FE.';
      if (name === 'logoUrl') return 'Debe ser una URL https válida.';
      return 'Formato inválido.';
    }
    return '';
  }

  back(): void {
    void this.router.navigate(['/onboarding/welcome']);
  }

  onSubmit(): void {
    if (this.loading()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    /* Field-level merge semantics: only include the keys we actually
     * want to write. An empty logo URL becomes "undefined", not "null",
     * so the backend keeps the existing value (see UpdateTenantRequest). */
    const branding: UpdateTenantRequest['branding'] = {
      primaryColor: raw.primaryColor.trim(),
    };
    const logo = (raw.logoUrl ?? '').trim();
    if (logo) branding.logoUrl = logo;

    const payload: UpdateTenantRequest = {
      name: raw.name.trim(),
      branding,
    };

    this.store.setLoading(true);
    this.store.setError(null);

    this.tenantApi
      .updateCurrent(payload)
      .pipe(finalize(() => this.store.setLoading(false)))
      .subscribe({
        next: (tenant) => {
          this.tenantService.setTenant(tenant, 'header');
          this.onboarding.markCompleted('school');
          void this.router.navigate(['/onboarding/complete']);
        },
        error: (err: HttpErrorResponse) => {
          this.store.setError(this.toMessage(err));
        },
      });
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    const apiError = this.firstApiError(err);
    if (err.status === 403) {
      return 'No tienes permisos para editar esta institución.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }
    return apiError?.message ?? 'No se pudieron guardar los datos.';
  }

  private firstApiError(err: HttpErrorResponse): ApiError | null {
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

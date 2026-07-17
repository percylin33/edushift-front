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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of, switchMap } from 'rxjs';

import { TenantService } from '@core/services';
import { ApiError, ApiResponse } from '@core/models';
import { environment } from '@env/environment';
import { FileUploadComponent, IconComponent, SpinnerComponent } from '@shared/components';
import { OnboardingService } from '@layout/services';

import { TenantApiService, UpdateTenantRequest } from '@features/tenants';
import { OnboardingStore } from '../../store';
import { ONBOARDING_STEPS } from '../../onboarding.steps';

/**
 * School step — the single data-entry page in the onboarding wizard.
 * Sends a {@code PATCH /v1/tenants/me} with the tenant's display name,
 * branding color, and logo image.
 *
 * <h3>Logo upload flow (Firebase via signed URL)</h3>
 * <ol>
 *   <li>{@link FileUploadComponent} runs the standard
 *       {@code POST /v1/files/upload-requests} → signed PUT → confirm
 *       dance (V50, see docs/infra/firebase.md). The storage provider is
 *       FIREBASE in prod and LOCAL_FS in dev; both yield a
 *       {@code FileMetadata} carrying a {@code publicUuid} + {@code url}.</li>
 *   <li>On {@code uploaded} we PATCH the tenant with
 *       {@code branding.logoUrl = <download-url>}; the backend merges
 *       {@code branding} field-by-field so {@code primaryColor} survives.</li>
 *   <li>To "remove the logo" we PATCH with {@code logoUrl: null}, which the
 *       mapper interprets as "delete the key", then issue a best-effort
 *       {@code DELETE /v1/files/{publicUuid}} to drop the bytes.</li>
 * </ol>
 *
 * <h3>Pre-fill strategy</h3>
 * The form is hydrated from {@link TenantService} on init: the user
 * already provided a name + slug at register time, and any branding
 * the backend may have inferred (none today, but a future "starter
 * theme by industry" feature can populate it). The user only types
 * what they want to override.
 */
@Component({
  selector: 'app-onboarding-school',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SpinnerComponent, FileUploadComponent],
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
        <label class="label">Logo de la institución</label>
        <div class="flex items-start gap-4">
          <div
            class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2"
            [attr.aria-label]="currentLogoUrl() ? 'Logo actual' : 'Sin logo'"
          >
            @if (currentLogoUrl(); as logo) {
              <img [src]="logo" alt="Logo actual" class="h-full w-full object-contain" />
            } @else {
              <app-icon name="image" [size]="32" class="text-content-muted" />
            }
          </div>
          <div class="flex-1 space-y-2">
            <app-file-upload
              module="branding"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              [maxSizeMb]="5"
              (uploaded)="onLogoUploaded($event)"
              (uploadError)="onLogoUploadError($event)"
            />
            <p class="hint">
              PNG, JPEG, WebP o SVG transparente. Recomendado mínimo 256×256. Tamaño máx. 5 MB.
            </p>
            @if (logoBusy()) {
              <p class="hint text-content-muted">Guardando logo en la institución…</p>
            }
            @if (currentLogoUrl()) {
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                [disabled]="logoBusy() || saving()"
                (click)="removeLogo()"
              >
                Quitar logo
              </button>
            }
          </div>
        </div>
      </div>

      <div class="card-footer -mx-5 -mb-5 mt-2 px-5 sm:col-span-2">
        <button type="button" class="btn btn-ghost" [disabled]="saving()" (click)="back()">
          Atrás
        </button>
        <button type="submit" class="btn btn-primary" [disabled]="saving() || form.invalid">
          @if (saving()) {
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
  private readonly http = inject(HttpClient);

  readonly saving = this.store.loading;
  readonly errorMessage = this.store.error;
  readonly logoBusy = signal(false);
  readonly currentLogoUrl = signal<string | null>(null);

  /**
   * Validators here are slightly more forgiving than the backend's
   * {@code BrandingDto}: we accept either 3-digit ({@code #fff}) or
   * 6-digit hex on the color field.
   */
  readonly form: FormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    primaryColor: [
      '',
      [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/)],
    ],
  });

  /**
   * Tracks whether the form has been hydrated from the tenant signal at
   * least once. Without this, switching {@code TenantService.tenant}
   * from the placeholder to the real DTO mid-onboarding would clobber
   * what the user typed.
   */
  private readonly _hydrated = signal(false);

  /**
   * PublicUuid of the currently rendered logo (if any), kept around so
   * {@link #removeLogo} can issue the matching {@code DELETE /v1/files/{uuid}}
   * after the tenant PATCH clears the {@code branding.logoUrl} key.
   */
  private currentLogoPublicUuid: string | null = null;

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
        },
        { emitEvent: false },
      );
      const logoLight = tenant.branding?.logo?.light ?? null;
      this.currentLogoUrl.set(logoLight);
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
      return 'Formato inválido.';
    }
    return '';
  }

  back(): void {
    void this.router.navigate(['/onboarding/welcome']);
  }

  // -------------------------------------------------------------------------
  // Logo upload
  // -------------------------------------------------------------------------

  /**
   * Invoked by {@link FileUploadComponent} after a successful upload.
   * The metadata's {@code url} is the absolute Firebase/LOCAL_FS path —
   * the BE serves that path through {@code TenantMapper} as the
   * {@code branding.logoUrl}. We also remember the publicUuid so a later
   * {@link #removeLogo} can drop the bytes from storage.
   */
  onLogoUploaded(meta: { publicUuid: string; url: string; contentType?: string }): void {
    this.currentLogoPublicUuid = meta.publicUuid;
    this.logoBusy.set(true);
    this.store.setError(null);

    const payload: UpdateTenantRequest = {
      branding: { logoUrl: meta.url },
    };

    this.tenantApi
      .updateCurrent(payload)
      .pipe(finalize(() => this.logoBusy.set(false)))
      .subscribe({
        next: (tenant) => {
          this.tenantService.setTenant(tenant, 'header');
          this.currentLogoUrl.set(tenant.branding?.logo?.light ?? meta.url);
        },
        error: (err: HttpErrorResponse) => {
          // Surface the error but keep the uploaded bytes — the user
          // can retry the PATCH without re-uploading.
          this.store.setError(this.toMessage(err));
        },
      });
  }

  onLogoUploadError(message: string): void {
    this.store.setError(message || 'No se pudo subir el logo.');
  }

  removeLogo(): void {
    if (this.logoBusy()) return;
    this.logoBusy.set(true);
    this.store.setError(null);

    const payload: UpdateTenantRequest = {
      branding: { logoUrl: null },
    };

    this.tenantApi
      .updateCurrent(payload)
      .pipe(
        switchMap((tenant) => {
          this.tenantService.setTenant(tenant, 'header');
          this.currentLogoUrl.set(null);
          const uuidToDelete = this.currentLogoPublicUuid;
          this.currentLogoPublicUuid = null;
          if (!uuidToDelete) return of(null);
          // Best-effort: drop the bytes from storage. If the BE
          // 404s (e.g. the file was already cleaned up) swallow it —
          // the tenant row is already cleared.
          const base = `${environment.apiUrl}/${environment.apiVersion}/files/${uuidToDelete}`;
          return this.http.delete(base).pipe(catchError(() => of(null)));
        }),
        finalize(() => this.logoBusy.set(false)),
      )
      .subscribe({
        error: (err: HttpErrorResponse) => this.store.setError(this.toMessage(err)),
      });
  }

  // -------------------------------------------------------------------------
  // Submit (name + color only)
  // -------------------------------------------------------------------------

  onSubmit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    /* Field-level merge semantics: only include the keys we actually
     * want to write. primaryColor is always sent; logoUrl is managed
     * by the upload widget above and never sent from here, so the BE
     * keeps the current value (see UpdateTenantRequest). */
    const payload: UpdateTenantRequest = {
      name: raw.name.trim(),
      branding: { primaryColor: raw.primaryColor.trim() },
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

  // -------------------------------------------------------------------------
  // Error mapping
  // -------------------------------------------------------------------------

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    const apiError = this.firstApiError(err);
    if (err.status === 403) {
      return 'No tienes permisos para editar esta institución.';
    }
    if (err.status === 413) {
      return 'La imagen excede el tamaño máximo permitido (5 MB).';
    }
    if (err.status === 415) {
      return 'Formato no soportado. Usa PNG, JPEG, WebP o SVG.';
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
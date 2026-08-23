import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, finalize, of } from 'rxjs';

import { AuthService, TenantService } from '@core/services';
import { TenantStatus, UserRole } from '@core/enums';
import { ApiError, Tenant } from '@core/models';
import { environment } from '@env/environment';
import {
  toSameOriginAssetUrl,
  PLATFORM_DEFAULT_LOGO_URL,
  PLATFORM_DEFAULT_LOGIN_BG_URL,
} from '@core/theming/tenant-assets.service';
import { FileUploadComponent, IconComponent, SpinnerComponent } from '@shared/components';

import { TenantApiService as TenantsApiService } from '@features/tenants/services/tenant-api.service';

/**
 * /settings/tenant — TENANT_ADMIN only (Sprint 17 / FE-17.4).
 *
 * Branding: colors + logo / login background uploaded through the shared
 * files pipeline ({@code module=branding} → LOCAL_FS or Firebase). The BE
 * returns a stable public URL ({@code /v1/files/public/{uuid}}) so the
 * unauthenticated login page can render the assets.
 */
@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SpinnerComponent, FileUploadComponent],
  template: `
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight text-content">Institución</h1>
        <p class="mt-1 text-sm text-content-muted">
          Branding y configuración del tenant. Visible para todos los usuarios.
        </p>
      </header>

      @if (loading()) {
        <div class="flex items-center gap-2 text-sm text-content-muted">
          <app-spinner [size]="14" />
          Cargando…
        </div>
      } @else {
        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="space-y-4 rounded-lg border border-border bg-surface-raised p-6"
          novalidate
        >
          <section class="space-y-3">
            <h2 class="text-base font-semibold text-content">Identidad</h2>
            <div class="space-y-1.5">
              <label for="name" class="block text-sm font-medium text-content">Nombre del colegio</label>
              <input
                id="name"
                type="text"
                formControlName="name"
                maxlength="200"
                placeholder="Colegio Técnico Tecnosur"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle"
              />
              <p class="text-xs text-content-subtle">
                Se muestra en el login, el menú y el resto de la plataforma.
              </p>
            </div>
            <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt class="text-xs uppercase tracking-wide text-content-subtle">Slug</dt>
                <dd class="mt-1 font-mono text-sm text-content">{{ tenant()?.slug ?? '—' }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-content-subtle">Plan</dt>
                <dd class="mt-1 text-sm text-content">{{ planLabel() }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wide text-content-subtle">Estado</dt>
                <dd class="mt-1 text-sm text-content">{{ statusLabel() }}</dd>
              </div>
            </dl>
          </section>

          <section class="space-y-3 border-t border-border pt-4">
            <h2 class="text-base font-semibold text-content">Texto del login</h2>
            <p class="text-xs text-content-subtle">
              Título y descripción del panel de bienvenida. Si los dejas vacíos se usa el texto
              por defecto.
            </p>
            <div class="space-y-1.5">
              <label for="loginTitle" class="block text-sm font-medium text-content"
                >Título de bienvenida</label
              >
              <input
                id="loginTitle"
                type="text"
                formControlName="loginTitle"
                maxlength="120"
                placeholder="Bienvenido a tu colegio"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle"
              />
            </div>
            <div class="space-y-1.5">
              <label for="loginDescription" class="block text-sm font-medium text-content"
                >Descripción</label
              >
              <textarea
                id="loginDescription"
                formControlName="loginDescription"
                rows="3"
                maxlength="500"
                placeholder="Ingresa con tu cuenta institucional para continuar."
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle"
              ></textarea>
            </div>
          </section>

          <section class="space-y-3 border-t border-border pt-4">
            <h2 class="text-base font-semibold text-content">Branding</h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="space-y-1.5">
                <label for="primaryColor" class="block text-sm font-medium text-content"
                  >Color primario</label
                >
                <div class="flex items-center gap-2">
                  <input
                    id="primaryColor"
                    type="color"
                    formControlName="primaryColor"
                    class="h-9 w-12 cursor-pointer rounded-md border border-border"
                  />
                  <input
                    type="text"
                    formControlName="primaryColorHex"
                    placeholder="#0066ff"
                    class="w-32 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm text-content"
                  />
                </div>
              </div>
              <div class="space-y-1.5">
                <label for="accentColor" class="block text-sm font-medium text-content"
                  >Color de acento</label
                >
                <div class="flex items-center gap-2">
                  <input
                    id="accentColor"
                    type="color"
                    formControlName="accentColor"
                    class="h-9 w-12 cursor-pointer rounded-md border border-border"
                  />
                  <input
                    type="text"
                    formControlName="accentColorHex"
                    placeholder="#22c55e"
                    class="w-32 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm text-content"
                  />
                </div>
              </div>
            </div>

            <div class="space-y-2 pt-2">
              <label class="block text-sm font-medium text-content">Logo de la institución</label>
              <div class="flex items-start gap-4">
                <div
                  class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted"
                >
                  <img
                    [src]="logoPreview() ?? defaultLogoUrl"
                    alt="Logo actual"
                    class="h-full w-full object-contain"
                  />
                </div>
                <div class="min-w-0 flex-1 space-y-2">
                  <app-file-upload
                    module="branding"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    [maxSizeMb]="5"
                    [disabled]="logoBusy() || saving()"
                    (uploaded)="onLogoUploaded($event)"
                    (uploadError)="onUploadError($event)"
                  />
                  <p class="text-xs text-content-subtle">
                    PNG, JPEG, WebP o SVG. Máx. 5 MB. Si no subes uno, se usa el emblema genérico
                    de EduShift.
                  </p>
                  @if (!logoPreview()) {
                    <p class="text-xs text-content-muted">Mostrando el logo predeterminado.</p>
                  }
                  @if (logoBusy()) {
                    <p class="text-xs text-content-muted">Guardando logo…</p>
                  }
                  @if (logoPreview()) {
                    <button
                      type="button"
                      class="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                      [disabled]="logoBusy() || saving()"
                      (click)="removeLogo()"
                    >
                      Quitar logo
                    </button>
                  }
                </div>
              </div>
            </div>

            <div class="space-y-2 pt-2">
              <label class="block text-sm font-medium text-content">Fondo de login</label>
              <div
                class="h-28 overflow-hidden rounded-md border border-border bg-surface-muted bg-cover bg-center"
                [style.background-image]="'url(' + (loginBgPreview() ?? defaultLoginBgUrl) + ')'"
                role="img"
                aria-label="Vista previa del fondo de login"
              ></div>
              <app-file-upload
                module="branding"
                accept="image/png,image/jpeg,image/webp"
                [maxSizeMb]="8"
                [disabled]="loginBgBusy() || saving()"
                (uploaded)="onLoginBgUploaded($event)"
                (uploadError)="onUploadError($event)"
              />
              <p class="text-xs text-content-subtle">
                Imagen full-bleed del login institucional. PNG/JPEG/WebP, máx. 8 MB. Si no subes
                una, se usa el fondo genérico de campus.
              </p>
              @if (!loginBgPreview()) {
                <p class="text-xs text-content-muted">Mostrando el fondo predeterminado.</p>
              }
              @if (loginBgBusy()) {
                <p class="text-xs text-content-muted">Guardando fondo de login…</p>
              }
              @if (loginBgPreview()) {
                <button
                  type="button"
                  class="text-xs font-medium text-danger hover:underline disabled:opacity-50"
                  [disabled]="loginBgBusy() || saving()"
                  (click)="removeLoginBg()"
                >
                  Quitar fondo
                </button>
              }
            </div>
          </section>

          <section class="space-y-3 border-t border-border pt-4">
            <h2 class="text-base font-semibold text-content">Feature flags (read-only)</h2>
            <p class="text-xs text-content-subtle">
              El backend controla el rollout de cada feature. Esta lista se recalcula en cada GET
              /v1/tenants/me.
            </p>
            <pre
              class="overflow-x-auto rounded-md border border-border-subtle bg-surface-muted p-3 text-xs text-content"
              >{{ featureFlagsText() }}</pre
            >
          </section>

          @if (successMessage(); as msg) {
            <p
              role="status"
              class="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-2 text-sm text-success"
            >
              <app-icon name="check" [size]="14" />
              <span>{{ msg }}</span>
            </p>
          }
          @if (errorMessage(); as msg) {
            <p
              role="alert"
              class="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger"
            >
              <app-icon name="alert-circle" [size]="14" />
              <span>{{ msg }}</span>
            </p>
          }

          <button
            type="submit"
            [disabled]="saving() || form.invalid || !form.dirty"
            class="inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            @if (saving()) {
              <app-spinner [size]="14" />
              Guardando…
            } @else {
              Guardar cambios
            }
          </button>
        </form>
      }
    </div>
  `,
})
export class TenantSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly tenantsApi = inject(TenantsApiService);
  private readonly http = inject(HttpClient);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly logoBusy = signal(false);
  protected readonly loginBgBusy = signal(false);
  protected readonly tenant = signal<Tenant | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly logoPreview = signal<string | null>(null);
  protected readonly loginBgPreview = signal<string | null>(null);
  protected readonly defaultLogoUrl = PLATFORM_DEFAULT_LOGO_URL;
  protected readonly defaultLoginBgUrl = PLATFORM_DEFAULT_LOGIN_BG_URL;

  private logoPublicUuid: string | null = null;
  private loginBgPublicUuid: string | null = null;

  protected readonly form: FormGroup = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    loginTitle: ['', [Validators.maxLength(120)]],
    loginDescription: ['', [Validators.maxLength(500)]],
    primaryColor: ['#0066ff', [Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    primaryColorHex: ['', []],
    accentColor: ['#22c55e', [Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    accentColorHex: ['', []],
  });

  private readonly _syncColors = effect(() => {
    const form = this.form;
    form
      .get('primaryColor')
      ?.valueChanges.subscribe((v: string) =>
        form.get('primaryColorHex')?.setValue(v, { emitEvent: false }),
      );
    form
      .get('accentColor')
      ?.valueChanges.subscribe((v: string) =>
        form.get('accentColorHex')?.setValue(v, { emitEvent: false }),
      );
    form.get('primaryColorHex')?.valueChanges.subscribe((v: string) => {
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        form.get('primaryColor')?.setValue(v, { emitEvent: false });
      }
    });
    form.get('accentColorHex')?.valueChanges.subscribe((v: string) => {
      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        form.get('accentColor')?.setValue(v, { emitEvent: false });
      }
    });
  });

  ngOnInit(): void {
    if (!this.auth.hasRole(UserRole.TenantAdmin) && !this.auth.hasRole(UserRole.SuperAdmin)) {
      this.errorMessage.set('No tienes permisos para editar la configuración de la institución.');
      this.loading.set(false);
      return;
    }
    this.load();
  }

  private load(): void {
    this.tenantsApi.findCurrent().subscribe({
      next: (t) => {
        this.applyTenant(t);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la configuración del tenant.');
        this.loading.set(false);
      },
    });
  }

  private applyTenant(t: Tenant): void {
    this.tenant.set(t);
    this.tenantService.setTenant(t);
    this.form.patchValue(
      {
        name: t.name ?? '',
        loginTitle: t.branding?.loginTitle ?? '',
        loginDescription: t.branding?.loginDescription ?? '',
        primaryColor: t.branding?.primaryColor ?? '#0066ff',
        primaryColorHex: t.branding?.primaryColor ?? '#0066ff',
        accentColor: t.branding?.accentColor ?? '#22c55e',
        accentColorHex: t.branding?.accentColor ?? '#22c55e',
      },
      { emitEvent: false },
    );
    this.logoPreview.set(toSameOriginAssetUrl(t.branding?.logo?.light));
    this.loginBgPreview.set(toSameOriginAssetUrl(t.branding?.loginBgUrl));
    this.logoPublicUuid = this.extractPublicUuid(t.branding?.logo?.light ?? null);
    this.loginBgPublicUuid = this.extractPublicUuid(t.branding?.loginBgUrl ?? null);
    this.form.markAsPristine();
  }

  protected planLabel(): string {
    return this.tenant()?.plan ?? '—';
  }

  protected statusLabel(): string {
    const t = this.tenant();
    if (!t?.status) return '—';
    switch (t.status) {
      case TenantStatus.Active:
        return 'Activo';
      case TenantStatus.Pending:
        return 'Pendiente de activación';
      case TenantStatus.Suspended:
        return 'Suspendido';
      case TenantStatus.Inactive:
        return 'Inactivo';
      default:
        return t.status;
    }
  }

  protected featureFlagsText(): string {
    const t = this.tenant();
    const flags = t?.featureFlags;
    if (!flags || Object.keys(flags).length === 0) return '(ninguno)';
    return Object.entries(flags)
      .map(([k, v]) => `• ${k}${v === true ? '' : ` = ${JSON.stringify(v)}`}`)
      .join('\n');
  }

  protected onLogoUploaded(meta: { publicUuid: string; url: string }): void {
    this.patchBrandingAsset('logo', meta);
  }

  protected onLoginBgUploaded(meta: { publicUuid: string; url: string }): void {
    this.patchBrandingAsset('loginBg', meta);
  }

  protected onUploadError(message: string): void {
    this.errorMessage.set(message || 'No se pudo subir la imagen.');
    this.successMessage.set(null);
  }

  private patchBrandingAsset(
    kind: 'logo' | 'loginBg',
    meta: { publicUuid: string; url: string },
  ): void {
    const url = this.toPublicBrandingUrl(meta);
    const busy = kind === 'logo' ? this.logoBusy : this.loginBgBusy;
    busy.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (kind === 'logo') {
      this.logoPublicUuid = meta.publicUuid;
      this.logoPreview.set(toSameOriginAssetUrl(url));
    } else {
      this.loginBgPublicUuid = meta.publicUuid;
      this.loginBgPreview.set(toSameOriginAssetUrl(url));
    }

    this.tenantsApi
      .updateCurrent({
        branding: kind === 'logo' ? { logoUrl: url } : { loginBgUrl: url },
      })
      .pipe(finalize(() => busy.set(false)))
      .subscribe({
        next: (t) => {
          this.applyTenant(t);
          this.successMessage.set(
            kind === 'logo' ? 'Logo actualizado.' : 'Fondo de login actualizado.',
          );
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(this.toMessage(err));
        },
      });
  }

  protected removeLogo(): void {
    if (this.logoBusy()) return;
    this.logoBusy.set(true);
    this.errorMessage.set(null);
    const uuid = this.logoPublicUuid;
    this.tenantsApi
      .updateCurrent({ branding: { logoUrl: null } })
      .pipe(
        finalize(() => this.logoBusy.set(false)),
        catchError((err: HttpErrorResponse) => {
          this.errorMessage.set(this.toMessage(err));
          return of(null);
        }),
      )
      .subscribe((t) => {
        if (!t) return;
        this.applyTenant(t);
        this.successMessage.set('Logo eliminado.');
        this.deleteFileBestEffort(uuid);
      });
  }

  protected removeLoginBg(): void {
    if (this.loginBgBusy()) return;
    this.loginBgBusy.set(true);
    this.errorMessage.set(null);
    const uuid = this.loginBgPublicUuid;
    this.tenantsApi
      .updateCurrent({ branding: { loginBgUrl: null } })
      .pipe(
        finalize(() => this.loginBgBusy.set(false)),
        catchError((err: HttpErrorResponse) => {
          this.errorMessage.set(this.toMessage(err));
          return of(null);
        }),
      )
      .subscribe((t) => {
        if (!t) return;
        this.applyTenant(t);
        this.successMessage.set('Fondo de login eliminado.');
        this.deleteFileBestEffort(uuid);
      });
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.saving() || !this.form.dirty) {
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.tenantsApi
      .updateCurrent({
        name: v.name?.trim(),
        branding: {
          primaryColor: v.primaryColor || undefined,
          loginTitle: v.loginTitle?.trim() ?? '',
          loginDescription: v.loginDescription?.trim() ?? '',
        },
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (t) => {
          this.applyTenant(t);
          this.successMessage.set('Datos de la institución actualizados.');
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(this.toMessage(err));
        },
      });
  }

  /**
   * Prefer the BE public absolute URL; fall back to constructing it from the
   * file publicUuid so BrandingDto validation ({@code https?://…}) always passes.
   */
  private toPublicBrandingUrl(meta: { publicUuid: string; url: string }): string {
    if (/^https?:\/\//i.test(meta.url)) {
      return meta.url;
    }
    const base = environment.apiUrl.replace(/\/+$/, '');
    const version = environment.apiVersion ? `/${environment.apiVersion}` : '';
    return `${base}${version}/files/public/${meta.publicUuid}`;
  }

  private extractPublicUuid(url: string | null): string | null {
    if (!url) return null;
    const match = /\/files\/public\/([0-9a-fA-F-]{36})(?:\b|$)/.exec(url);
    return match?.[1] ?? null;
  }

  private deleteFileBestEffort(publicUuid: string | null): void {
    if (!publicUuid) return;
    const base = environment.apiUrl.replace(/\/+$/, '');
    const version = environment.apiVersion ? `/${environment.apiVersion}` : '';
    this.http
      .delete(`${base}${version}/files/${publicUuid}`)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) return 'No se pudo conectar con el servidor.';
    if (err.status === 403) return 'No tienes permiso para editar la institución.';
    if (err.status === 400) {
      const body = err.error as ApiError | null | undefined;
      return body?.message ?? 'Los datos de branding no son válidos.';
    }
    if (err.status >= 500) return 'Ocurrió un error inesperado. Intenta nuevamente.';
    return 'No se pudo guardar la configuración.';
  }
}

import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { AuthService, TenantService } from '@core/services';
import { TenantStatus, UserRole } from '@core/enums';
import { ApiError, Tenant } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';

import { TenantApiService as TenantsApiService } from '@features/tenants/services/tenant-api.service';

/**
 * /settings/tenant — TENANT_ADMIN only (Sprint 17 / FE-17.4).
 *
 * <h3>What this page covers</h3>
 * Tenant branding — primary color, accent color, logo URL. The full
 * image upload flow is part of the upcoming branding-sprint (the
 * `files` module will own it); for now we accept a logo URL.
 *
 * <h3>Why we don't try to edit plan / feature flags / settings here</h3>
 * <ul>
 *   <li>{@code plan} is billing-managed (B2B portal, future).</li>
 *   <li>{@code featureFlags} are read-only on the FE (the BE controls
 *       rollout via a separate admin tool).</li>
 *   <li>{@code settings} is the open-ended JSONB blob; we surface
 *       it as a read-only JSON dump for transparency until the
 *       schema for individual knobs lands.</li>
 * </ul>
 */
@Component({
  selector: 'app-tenant-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SpinnerComponent],
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
            <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <dt class="text-xs uppercase tracking-wide text-content-subtle">Nombre</dt>
                <dd class="mt-1 text-sm text-content">{{ tenant()?.name ?? '—' }}</dd>
              </div>
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
            <div class="space-y-1.5">
              <label for="logoUrl" class="block text-sm font-medium text-content">Logo (URL)</label>
              <input
                id="logoUrl"
                type="url"
                formControlName="logoUrl"
                placeholder="https://cdn.ejemplo.com/logo.svg"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle"
              />
              <p class="text-xs text-content-subtle">
                En un sprint próximo reemplazaremos este campo por un upload directo desde el panel.
              </p>
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
              >{{ featureFlagsText() }}</pre>
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
              Guardar branding
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

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly tenant = signal<Tenant | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  // The form has paired controls (color picker + hex text) so the
  // user can pick visually OR type the hex. We keep them in sync
  // via a single value accessor — the form value is always the
  // canonical hex string.
  protected readonly form: FormGroup = this.fb.nonNullable.group({
    primaryColor: ['#0066ff', [Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    primaryColorHex: ['', []],
    accentColor: ['#22c55e', [Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    accentColorHex: ['', []],
    logoUrl: ['', []],
  });

  // Sync the color picker ↔ hex input in real time.
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
    // Block the page if the caller isn't an admin — the route is
    // also server-side guarded, this is just a UX shortcut.
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
        this.tenant.set(t);
        this.tenantService.setTenant(t);
        this.form.patchValue(
          {
            primaryColor: t.branding?.primaryColor ?? '#0066ff',
            primaryColorHex: t.branding?.primaryColor ?? '#0066ff',
            accentColor: t.branding?.accentColor ?? '#22c55e',
            accentColorHex: t.branding?.accentColor ?? '#22c55e',
            logoUrl: t.branding?.logo?.light ?? '',
          },
          { emitEvent: false },
        );
        this.form.markAsPristine();
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la configuración del tenant.');
        this.loading.set(false);
      },
    });
  }

  protected planLabel(): string {
    const t = this.tenant();
    if (!t?.plan) return '—';
    // The BE returns the plan enum as a string. We keep the
    // display copy minimal until the plans list is shipped.
    return t.plan;
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
        branding: {
          primaryColor: v.primaryColor || undefined,
          logoUrl: v.logoUrl?.trim() || undefined,
        },
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (t) => {
          this.tenant.set(t);
          this.tenantService.setTenant(t);
          this.form.markAsPristine();
          this.successMessage.set('Branding actualizado.');
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(this.toMessage(err));
        },
      });
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

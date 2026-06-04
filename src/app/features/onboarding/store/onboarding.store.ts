import { Injectable, computed, inject, signal } from '@angular/core';
import { TenantService } from '@core/services';
import { TenantStatus } from '@core/enums';
import { Tenant } from '@core/models';

/**
 * Local UI state for the onboarding wizard.
 *
 * <h3>What lives here vs in {@code OnboardingService}</h3>
 * <ul>
 *   <li>{@code OnboardingService} (layout/services): wizard <em>topology</em>
 *       — list of steps, which is current, which are completed. Drives the
 *       visual stepper in {@code OnboardingLayoutComponent}.</li>
 *   <li>This store: wizard <em>data</em> — the in-flight tenant patch the
 *       admin is composing in the school step + the loading / error
 *       flags. Survives across step navigation; cleared on logout via
 *       {@link #reset}.</li>
 * </ul>
 *
 * <h3>Why a feature-local store and not just signals on the service</h3>
 * Component-level state would die when the user clicks "Atrás" → "Continuar"
 * (the route component is destroyed and recreated). A {@code root}-scoped
 * store keeps the user-typed branding alive across that round-trip and
 * lets the {@code complete} step read what the {@code school} step
 * persisted without coupling components to each other.
 *
 * <h3>Source of truth for the tenant</h3>
 * The authoritative tenant is in {@link TenantService}. This store keeps
 * a derived signal {@link #tenant} that proxies it; the wizard does not
 * own a separate copy. After a successful PATCH, callers should:
 * <ol>
 *   <li>Pass the response to {@code TenantService.setTenant} (which
 *       re-applies branding via {@code TenantThemeService}).</li>
 *   <li>This store will reflect the change automatically through the
 *       {@code tenant} computed.</li>
 * </ol>
 */
@Injectable({ providedIn: 'root' })
export class OnboardingStore {
  private readonly tenantService = inject(TenantService);

  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  /** Re-export of the tenant signal so wizard pages don't have to inject `TenantService`. */
  readonly tenant = computed<Tenant | null>(() => this.tenantService.tenant());

  /** True once the school step has produced an ACTIVE tenant. Used by the complete page to short-circuit re-activation. */
  readonly tenantIsActive = computed(() => this.tenant()?.status === TenantStatus.Active);

  setLoading(value: boolean): void {
    this._loading.set(value);
  }

  setError(error: string | null): void {
    this._error.set(error);
  }

  reset(): void {
    this._loading.set(false);
    this._error.set(null);
  }
}

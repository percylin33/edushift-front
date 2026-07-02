import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { ROUTES } from '@core/constants';
import { TenantStatus } from '@core/enums';
import { ApiError, ApiResponse } from '@core/models';
import { TenantService } from '@core/services';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { OnboardingService } from '@layout/services';

import { TenantApiService } from '@features/tenants';
import { OnboardingStore } from '../../store';
import { ONBOARDING_STEPS } from '../../onboarding.steps';

/**
 * Final step. Promotes the tenant from {@code PENDING} → {@code ACTIVE}
 * via {@code POST /v1/tenants/me/activate} and drops the user into the
 * dashboard. The activation call is idempotent server-side, so a user
 * who reaches this page on an already-{@code ACTIVE} tenant (e.g. via
 * back/forward navigation) sees no error and proceeds normally.
 *
 * <h3>Why activation lives in the wizard's last step</h3>
 * Two reasons:
 * <ol>
 *   <li><strong>Auth gating.</strong> The backend's
 *       {@code AuthService.login} rejects non-{@code ACTIVE} tenants
 *       with {@code 401 TENANT_INACTIVE}. If the user logs out before
 *       activating, they cannot log back in. Forcing activation as the
 *       last visible step closes that gap and gives users a moment to
 *       review the data they entered.</li>
 *   <li><strong>Mental model.</strong> "I just configured my school,
 *       and now I'm activating it" is a clean narrative; activating
 *       silently in the school step would surprise users when something
 *       errors and they don't know which call failed.</li>
 * </ol>
 */
@Component({
  selector: 'app-onboarding-complete',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  template: `
    <div class="text-center">
      @if (tenantIsActive()) {
        <div
          class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success"
        >
          <app-icon name="check" [size]="28" />
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">¡Listo!</h1>
        <p class="mt-2 text-sm text-content-muted">
          <strong class="text-content">{{ tenantName() }}</strong> está activa. Ya puedes empezar a
          usar EduShift.
        </p>
      } @else {
        <div
          class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500/15 text-primary-600 dark:text-primary-300"
        >
          <app-icon name="sparkles" [size]="28" />
        </div>
        <h1 class="text-2xl font-semibold tracking-tight">Casi listo</h1>
        <p class="mt-2 text-sm text-content-muted">
          Activaremos <strong class="text-content">{{ tenantName() }}</strong> y te llevaremos al
          dashboard.
        </p>
      }
    </div>

    @if (errorMessage(); as message) {
      <div
        role="alert"
        class="mt-6 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
      >
        <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
        <span>{{ message }}</span>
      </div>
    }

    <div class="card-footer -mx-5 -mb-5 mt-8 px-5">
      <button
        type="button"
        class="btn btn-primary ml-auto"
        [disabled]="loading()"
        (click)="finish()"
      >
        @if (loading()) {
          <app-spinner [size]="16" label="Activando…" />
          <span>Activando…</span>
        } @else {
          <span>{{ tenantIsActive() ? 'Ir al dashboard' : 'Activar y entrar' }}</span>
        }
      </button>
    </div>
  `,
})
export class OnboardingCompleteComponent implements OnInit {
  private readonly tenantApi = inject(TenantApiService);
  private readonly tenantService = inject(TenantService);
  private readonly store = inject(OnboardingStore);
  private readonly onboarding = inject(OnboardingService);
  private readonly router = inject(Router);

  readonly loading = this.store.loading;
  readonly errorMessage = this.store.error;
  readonly tenantIsActive = this.store.tenantIsActive;
  readonly tenantName = computed(() => this.store.tenant()?.name ?? 'tu institución');

  ngOnInit(): void {
    this.onboarding.setSteps(ONBOARDING_STEPS, 'complete');
    this.onboarding.markCompleted('welcome');
    this.onboarding.markCompleted('school');
    this.store.setError(null);
  }

  finish(): void {
    if (this.loading()) return;

    /* Already-ACTIVE shortcut: skip the round-trip and go straight to
     * the dashboard. The backend would no-op anyway but avoiding the
     * call saves a few hundred ms on the back/forward navigation case. */
    if (this.tenantIsActive()) {
      this.onboarding.markCompleted('complete');
      void this.router.navigateByUrl(ROUTES.DASHBOARD.ROOT);
      return;
    }

    this.store.setLoading(true);
    this.store.setError(null);

    this.tenantApi
      .activateCurrent()
      .pipe(finalize(() => this.store.setLoading(false)))
      .subscribe({
        next: (tenant) => {
          this.tenantService.setTenant(tenant, 'header');
          this.onboarding.markCompleted('complete');
          /* Sanity log so future debugging can confirm the transition.
           * The signal-driven UI update happens automatically via
           * TenantService.setTenant. */
          if (tenant.status !== TenantStatus.Active) {
            this.store.setError(
              'La institución no quedó activa. Contacta a soporte si el problema persiste.',
            );
            return;
          }
          void this.router.navigateByUrl(ROUTES.DASHBOARD.ROOT);
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
    const code = apiError?.code;

    switch (code) {
      case 'TENANT_NOT_ACTIVATABLE':
        return 'Tu institución está suspendida. Contacta a soporte para reactivarla.';
      case 'FORBIDDEN':
        return 'No tienes permisos para activar esta institución.';
    }
    if (err.status === 403) {
      return 'No tienes permisos para activar esta institución.';
    }
    if (err.status === 409) {
      return apiError?.message ?? 'No se pudo activar la institución en su estado actual.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }
    return apiError?.message ?? 'No se pudo completar la activación.';
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

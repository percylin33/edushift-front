import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { IconComponent } from '@shared/components';

/**
 * /settings/security — sub-section (Sprint 17 / FE-17.4).
 *
 * <h3>Why these shortcuts live here</h3>
 * The actual flows (forgot-password, MFA enroll) live on dedicated
 * pages. This section exists so the user has a single place to find
 * security-related actions without having to dig into the user menu.
 *
 * <h3>What's here</h3>
 * <ul>
 *   <li>MFA toggle (Activate / Deactivate / Manage recovery codes).</li>
 *   <li>Change-password link (uses the canonical forgot-password flow).</li>
 *   <li>Active-sessions list placeholder (BE endpoint not yet shipped;
 *       we mark it as a near-future addition so the IA is set).</li>
 * </ul>
 */
@Component({
  selector: 'app-security-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight text-content">Seguridad</h1>
        <p class="mt-1 text-sm text-content-muted">
          Contraseña, verificación en dos pasos y sesiones activas.
        </p>
      </header>

      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-content">Verificación en dos pasos</h2>
            <p class="mt-1 text-sm text-content-muted">
              Códigos de un solo uso desde tu aplicación autenticadora.
            </p>
          </div>
          @if (mfaEnabled()) {
            <span
              class="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
            >
              <app-icon name="check" [size]="12" />
              Activado
            </span>
          } @else {
            <span
              class="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-content-muted"
            >
              Desactivado
            </span>
          }
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          @if (mfaEnabled()) {
            <a
              [routerLink]="mfaEnrollRoute"
              class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
            >
              Reconfigurar
            </a>
          } @else {
            <a
              [routerLink]="mfaEnrollRoute"
              class="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <app-icon name="lock" [size]="14" />
              Activar
            </a>
          }
        </div>
      </section>

      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <h2 class="text-base font-semibold text-content">Contraseña</h2>
        <p class="mt-1 text-sm text-content-muted">
          Para cambiar tu contraseña, te enviaremos un enlace por correo. Esto cierra tus otras
          sesiones como medida de seguridad.
        </p>
        <a
          [routerLink]="forgotPasswordRoute"
          class="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="mail" [size]="14" />
          Cambiar contraseña
        </a>
      </section>

      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <h2 class="text-base font-semibold text-content">Sesiones activas</h2>
        <p class="mt-1 text-sm text-content-muted">
          Aquí verás los dispositivos con tu sesión abierta. Podrás cerrar las que no reconozcas.
        </p>
        <div
          class="mt-4 rounded-md border border-dashed border-border-subtle bg-surface-muted p-4 text-sm text-content-subtle"
        >
          Próximamente — la API backend de sesiones activas se entrega en un sprint posterior.
        </div>
      </section>
    </div>
  `,
})
export class SecuritySettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mfaEnrollRoute = '/auth/mfa-enroll';
  protected readonly forgotPasswordRoute = ROUTES.AUTH.FORGOT_PASSWORD;

  protected readonly mfaEnabled = computed(() => !!this.auth.user()?.mfaEnabled);
}

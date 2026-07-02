import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { IconComponent } from '@shared/components';

/**
 * /settings — user account sub-section (Sprint 17 / FE-17.4).
 *
 * <h3>Why this is mostly read-only</h3>
 * Editable user fields (firstName / lastName / phone) live on the
 * Profile page (FE-17.2) — that is where the user expects to edit
 * their own data. The Settings page is the canonical place to review
 * the high-level security and account state (MFA on/off, last login,
 * roles, etc.) without having to scroll past an edit form.
 *
 * <h3>What's here</h3>
 * <ul>
 *   <li>Account identity (email, status, role).</li>
 *   <li>MFA state badge with a CTA to activate / manage.</li>
 *   <li>Last-login + member-since timestamps.</li>
 *   <li>A "Editar mi perfil" link that drops the user on /profile.</li>
 * </ul>
 */
@Component({
  selector: 'app-user-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-semibold tracking-tight text-content">Mi cuenta</h1>
        <p class="mt-1 text-sm text-content-muted">
          Información básica de tu cuenta. Para editar nombre o teléfono, abre
          <a [routerLink]="profileRoute" class="font-medium text-primary-600 hover:underline"
            >Mi perfil</a
          >.
        </p>
      </header>

      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <h2 class="text-base font-semibold text-content">Identidad</h2>
        <dl class="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">Correo</dt>
            <dd class="mt-1 text-sm text-content">{{ email() }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">Estado</dt>
            <dd class="mt-1 text-sm text-content">{{ statusLabel() }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">Rol principal</dt>
            <dd class="mt-1 text-sm text-content">{{ primaryRole() }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">MFA</dt>
            <dd class="mt-1 text-sm text-content">{{ mfaLabel() }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">Último acceso</dt>
            <dd class="mt-1 text-sm text-content">{{ lastLoginLabel() }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">Miembro desde</dt>
            <dd class="mt-1 text-sm text-content">{{ memberSinceLabel() }}</dd>
          </div>
        </dl>
        <div class="mt-6 flex flex-wrap gap-2">
          <a
            [routerLink]="profileRoute"
            class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
          >
            <app-icon name="user" [size]="14" />
            Editar mi perfil
          </a>
          <a
            [routerLink]="securityRoute"
            class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
          >
            <app-icon name="lock" [size]="14" />
            Seguridad
          </a>
        </div>
      </section>
    </div>
  `,
})
export class UserSettingsComponent {
  private readonly auth = inject(AuthService);

  protected readonly profileRoute = ROUTES.PROFILE.ROOT;
  protected readonly securityRoute = ['/settings', 'security'];

  protected readonly email = computed(() => this.auth.user()?.email ?? '—');

  protected readonly statusLabel = computed(() => {
    const u = this.auth.user();
    if (!u) return '—';
    switch (u.status) {
      case 'ACTIVE':
        return 'Activo';
      case 'PENDING_VERIFICATION':
        return 'Pendiente de verificación';
      case 'LOCKED':
        return 'Bloqueado';
      case 'SUSPENDED':
        return 'Suspendido';
      case 'INACTIVE':
        return 'Inactivo';
      default:
        return u.status;
    }
  });

  protected readonly primaryRole = computed(() => {
    const u = this.auth.user();
    if (!u?.roles?.length) return '—';
    return u.roles[0];
  });

  protected readonly mfaLabel = computed(() =>
    this.auth.user()?.mfaEnabled ? 'Activado' : 'Desactivado',
  );

  protected readonly lastLoginLabel = computed(() => {
    const u = this.auth.user();
    if (!u?.lastLoginAt) return 'Nunca';
    const d = new Date(u.lastLoginAt);
    return Number.isNaN(d.getTime()) ? 'Nunca' : d.toLocaleString();
  });

  protected readonly memberSinceLabel = computed(() => {
    const u = this.auth.user();
    if (!u?.createdAt) return '—';
    const d = new Date(u.createdAt);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
  });
}

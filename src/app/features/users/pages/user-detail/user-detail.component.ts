import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { UserRole, UserStatus } from '@core/enums';
import { AuthService } from '@core/services';
import {
  ConfirmDialogService,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { UserRoleBadgeComponent, UserStatusBadgeComponent } from '../../components';
import { UpdateUserRequest, UserDetail, AdminPasswordResetDelivery } from '../../models';
import { UsersStore } from '../../store';

/**
 * `/users/:id` — admin page for one specific user.
 *
 * <h3>Sections</h3>
 * <ol>
 *   <li><b>Header</b> — name + email + status, plus quick lifecycle
 *       actions (disable / enable / reset password).</li>
 *   <li><b>Profile form</b> — partial-update form for first/last name,
 *       phone and avatar URL. Only sends fields the admin actually
 *       changed (mirrors the backend's "null = no change" contract by
 *       omitting unchanged keys from the JSON body).</li>
 *   <li><b>Roles</b> — checkbox grid that maps directly to the
 *       wholesale-replace endpoint. Disabling all roles is blocked
 *       client-side because the backend would reject it with 422
 *       INVALID_ROLE / LAST_ADMIN_PROTECTION; we surface the rule
 *       upfront instead of letting the user bounce off a server error.</li>
 *   <li><b>Audit</b> — read-only timestamps & ids.</li>
 * </ol>
 *
 * <h3>Self-action guards</h3>
 * The page reads the currently authenticated user from {@link AuthService}
 * and disables the {@code disable} button + {@code remove TENANT_ADMIN}
 * checkbox when the target is the current admin. The backend enforces
 * the same rules; the UI signals them so admins know why a button is
 * dimmed.
 */
@Component({
  selector: 'app-user-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
    UserRoleBadgeComponent,
    UserStatusBadgeComponent,
  ],
  template: `
    <app-page-container size="default">
      @if (user(); as u) {
        <app-page-header
          [eyebrow]="'Usuario · ' + u.email"
          [title]="u.fullName || u.email"
          [subtitle]="rolesSubtitle(u)"
        >
          <a [routerLink]="usersLink" class="btn btn-ghost btn-sm" aria-label="Volver">
            <app-icon name="chevron-left" [size]="16" />
            <span class="hidden sm:inline" aria-hidden="true">Volver</span>
          </a>
          @if (u.status === Active) {
            <button
              type="button"
              class="btn btn-outline btn-sm"
              [disabled]="saving() || isSelf()"
              [title]="isSelf() ? 'No puedes deshabilitar tu propia cuenta.' : null"
              (click)="onDisable()"
            >
              Suspender
            </button>
          } @else {
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="saving()"
              (click)="onEnable()"
            >
              Reactivar
            </button>
          }
          <button
            type="button"
            class="btn btn-outline btn-sm"
            [disabled]="saving()"
            (click)="onResetPassword()"
          >
            <app-icon name="lock" [size]="16" />
            <span class="hidden sm:inline">Reset contraseña</span>
          </button>
        </app-page-header>

        <!-- Inline error banner (sticky across sections) -->
        @if (saveError(); as err) {
          <div class="alert alert-danger mb-4">
            <app-icon name="alert-circle" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">No pudimos guardar los cambios.</p>
              <p class="mt-1 text-xs opacity-80">{{ err }}</p>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" (click)="store.clearError()">
              Cerrar
            </button>
          </div>
        }

        @if (resetSent()) {
          <div class="alert alert-info mb-4">
            <app-icon name="mail" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">Se envió el correo de restablecimiento.</p>
              <p class="mt-1 text-xs opacity-80">
                Si no llega, el usuario puede usar «Olvidé mi contraseña» en el login. El mensaje es el mismo si el envío falló internamente.
              </p>
            </div>
          </div>
        }

        @if (tempPassword(); as temp) {
          <div class="alert alert-warning mb-4">
            <app-icon name="lock" [size]="18" />
            <div class="flex-1">
              <p class="font-medium">Contraseña temporal generada (cópiala ahora)</p>
              <p class="mt-2 font-mono text-sm break-all select-all">{{ temp }}</p>
              <p class="mt-2 text-xs opacity-80">
                Entrégala en persona o por un canal seguro del colegio. Al ingresar, el usuario deberá elegir una nueva. No se volverá a mostrar.
              </p>
              <button
                type="button"
                class="btn btn-outline btn-sm mt-3"
                (click)="copyTempPassword()"
              >
                Copiar contraseña
              </button>
            </div>
            <button type="button" class="btn btn-ghost btn-sm" (click)="tempPassword.set(null)">
              Cerrar
            </button>
          </div>
        }

        <div class="grid gap-6 lg:grid-cols-3">
          <!-- ============ Profile (col 1-2) ============ -->
          <section class="card lg:col-span-2">
            <header class="card-header">
              <div>
                <h2 class="card-title">Perfil</h2>
                <p class="card-description">Información básica del usuario.</p>
              </div>
              <app-user-status-badge [status]="u.status" />
            </header>
            <div class="card-body grid gap-4 sm:grid-cols-2">
              <div class="field">
                <label class="label" for="user-firstName">Nombre</label>
                <input id="user-firstName" type="text" class="input" [(ngModel)]="firstName" />
              </div>
              <div class="field">
                <label class="label" for="user-lastName">Apellido</label>
                <input id="user-lastName" type="text" class="input" [(ngModel)]="lastName" />
              </div>
              <div class="field">
                <label class="label" for="user-email">Email</label>
                <input id="user-email" type="email" class="input" [value]="u.email" disabled />
                <p class="hint">Los cambios de email tienen su propio flujo (Sprint 9).</p>
              </div>
              <div class="field">
                <label class="label" for="user-phone">Teléfono</label>
                <input
                  id="user-phone"
                  type="tel"
                  class="input"
                  placeholder="+51 999 999 999"
                  [(ngModel)]="phone"
                />
              </div>
              <div class="field sm:col-span-2">
                <label class="label" for="user-avatar">URL de avatar</label>
                <input
                  id="user-avatar"
                  type="url"
                  class="input"
                  placeholder="https://…"
                  [(ngModel)]="avatarUrl"
                />
              </div>
            </div>
            <footer class="card-footer">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                [disabled]="!isProfileDirty() || saving()"
                (click)="resetProfile()"
              >
                Descartar
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="!isProfileDirty() || saving()"
                (click)="onSaveProfile()"
              >
                @if (saving()) {
                  <app-spinner [size]="14" label="Guardando" />
                }
                Guardar perfil
              </button>
            </footer>
          </section>

          <!-- ============ Roles (col 3) ============ -->
          <section class="card">
            <header class="card-header">
              <div>
                <h2 class="card-title">Roles</h2>
                <p class="card-description">El conjunto se reemplaza por completo al guardar.</p>
              </div>
            </header>
            <div class="card-body grid gap-2">
              @for (option of roleOptions; track option.value) {
                <label
                  class="flex items-center gap-3 rounded-md border border-border-subtle px-3 py-2 hover:bg-surface-muted"
                  [class.opacity-60]="isRoleLocked(option.value)"
                >
                  <input
                    type="checkbox"
                    class="checkbox"
                    [checked]="hasRole(option.value)"
                    [disabled]="saving() || isRoleLocked(option.value)"
                    (change)="onToggleRole(option.value, $event)"
                  />
                  <div class="flex-1">
                    <p class="text-sm font-medium text-content">{{ option.label }}</p>
                    <p class="text-xs text-content-muted">{{ option.description }}</p>
                  </div>
                  <app-user-role-badge [role]="option.value" />
                </label>
              }

              @if (isSelf()) {
                <p class="mt-1 text-xs text-content-muted">
                  No puedes quitarte el rol de Administrador a ti mismo.
                </p>
              }
            </div>
            <footer class="card-footer">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                [disabled]="!isRolesDirty() || saving()"
                (click)="resetRoles()"
              >
                Descartar
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="!isRolesDirty() || saving() || pendingRoles().length === 0"
                (click)="onSaveRoles()"
              >
                @if (saving()) {
                  <app-spinner [size]="14" label="Guardando" />
                }
                Guardar roles
              </button>
            </footer>
          </section>

          <!-- ============ Audit (col 1-3) ============ -->
          <section class="card lg:col-span-3">
            <header class="card-header">
              <div>
                <h2 class="card-title">Auditoría</h2>
                <p class="card-description">Identificadores y timestamps del usuario.</p>
              </div>
            </header>
            <dl class="card-body grid gap-4 sm:grid-cols-3">
              <div>
                <dt class="text-xs uppercase tracking-wider text-content-subtle">Estado</dt>
                <dd class="mt-1 flex items-center gap-2">
                  <app-user-status-badge [status]="u.status" />
                  @if (u.emailVerified) {
                    <span class="badge badge-info">Email verificado</span>
                  }
                  @if (u.mfaEnabled) {
                    <span class="badge badge-success">MFA activo</span>
                  }
                </dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wider text-content-subtle">Último acceso</dt>
                <dd class="mt-1 text-sm text-content-muted">{{ formatDate(u.lastLoginAt) }}</dd>
              </div>
              <div>
                <dt class="text-xs uppercase tracking-wider text-content-subtle">Creado</dt>
                <dd class="mt-1 text-sm text-content-muted">{{ formatDate(u.createdAt) }}</dd>
              </div>
              <div class="sm:col-span-3">
                <dt class="text-xs uppercase tracking-wider text-content-subtle">Public UUID</dt>
                <dd class="mt-1 font-mono text-xs text-content-muted">{{ u.publicUuid }}</dd>
              </div>
            </dl>
          </section>
        </div>
      } @else if (loading()) {
        <div class="flex items-center justify-center py-24">
          <app-spinner [size]="28" label="Cargando usuario…" />
        </div>
      } @else {
        <div class="card">
          <div class="card-body text-center">
            <app-icon name="alert-circle" [size]="32" class="mx-auto text-danger" />
            <h2 class="mt-3 text-lg font-semibold text-content">No pudimos abrir el usuario</h2>
            <p class="mt-1 text-sm text-content-muted">
              {{
                loadError() ?? 'Es posible que ya no exista o que no tengas permisos para verlo.'
              }}
            </p>
            <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button type="button" class="btn btn-outline btn-sm" (click)="retry()">
                Reintentar
              </button>
              <a [routerLink]="usersLink" class="btn btn-ghost btn-sm">Volver al listado</a>
            </div>
          </div>
        </div>
      }
    </app-page-container>

    @if (resetModalOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-access-title"
        (click)="closeResetModal()"
      >
        <div class="card w-full max-w-md shadow-lg" (click)="$event.stopPropagation()">
          <header class="card-header">
            <div>
              <h2 id="reset-access-title" class="card-title">Restablecer acceso</h2>
              <p class="card-description">
                Elige cómo entregar la nueva credencial a
                {{ user()?.fullName || user()?.email }}.
              </p>
            </div>
          </header>
          <div class="card-body grid gap-3">
            <button
              type="button"
              class="btn btn-outline w-full justify-start text-left"
              [disabled]="saving() || isSyntheticEmail()"
              [title]="
                isSyntheticEmail()
                  ? 'Correo sintético: no hay buzón real. Usa contraseña temporal.'
                  : null
              "
              (click)="confirmReset('EMAIL')"
            >
              <app-icon name="mail" [size]="18" />
              <span class="flex flex-col items-start gap-0.5">
                <span class="font-medium">Enviar enlace por email</span>
                <span class="text-xs font-normal text-content-muted">
                  Mismo flujo que «Olvidé mi contraseña» (válido ~1 h).
                </span>
              </span>
            </button>
            <button
              type="button"
              class="btn btn-primary w-full justify-start text-left"
              [disabled]="saving()"
              (click)="confirmReset('TEMPORARY')"
            >
              <app-icon name="lock" [size]="18" />
              <span class="flex flex-col items-start gap-0.5">
                <span class="font-medium">Generar contraseña temporal</span>
                <span class="text-xs font-normal opacity-90">
                  Se muestra una sola vez. Al entrar deberá elegir una nueva.
                </span>
              </span>
            </button>
            @if (isSyntheticEmail()) {
              <p class="text-xs text-content-muted">
                Este usuario tiene correo sintético
                <span class="font-mono">(*.accounts.edushift.local)</span>;
                el envío por email no está disponible.
              </p>
            }
          </div>
          <footer class="card-footer">
            <button type="button" class="btn btn-ghost btn-sm" (click)="closeResetModal()">
              Cancelar
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class UserDetailComponent implements OnInit {
  protected readonly store = inject(UsersStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly Active = UserStatus.Active;
  protected readonly usersLink = ROUTES.USERS.LIST;

  protected readonly user = this.store.selected;
  protected readonly loading = this.store.loadingDetail;
  protected readonly saving = this.store.saving;
  protected readonly saveError = this.store.error;

  /** Distinguishes a fatal load error (no user yet) from a save error. */
  protected readonly loadError = computed(() =>
    this.user() === null && !this.loading() ? this.saveError() : null,
  );

  // ---- profile form state ----
  protected firstName = '';
  protected lastName = '';
  protected phone = '';
  protected avatarUrl = '';

  // ---- roles form state ----
  protected readonly pendingRoles = signal<UserRole[]>([]);
  protected readonly resetSent = signal(false);
  protected readonly resetModalOpen = signal(false);
  protected readonly tempPassword = signal<string | null>(null);

  /** Manageable role catalog. SUPER_ADMIN / GUEST are intentionally hidden. */
  protected readonly roleOptions: ReadonlyArray<{
    value: UserRole;
    label: string;
    description: string;
  }> = [
    {
      value: UserRole.TenantAdmin,
      label: 'Administrador',
      description: 'Acceso total al workspace y a la gestión de usuarios.',
    },
    {
      value: UserRole.Staff,
      label: 'Staff',
      description: 'Personal administrativo del colegio sin acceso de admin.',
    },
    {
      value: UserRole.Teacher,
      label: 'Profesor',
      description: 'Carga académica, asistencia y notas.',
    },
    {
      value: UserRole.Student,
      label: 'Estudiante',
      description: 'Acceso al portal del alumno (lectura).',
    },
    {
      value: UserRole.Parent,
      label: 'Tutor',
      description: 'Tutor o apoderado de uno o más estudiantes.',
    },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate([ROUTES.USERS.LIST]);
      return;
    }
    void this.refresh(id);
  }

  // ===========================================================================
  // Profile form
  // ===========================================================================

  protected isProfileDirty(): boolean {
    const u = this.user();
    if (!u) return false;
    return (
      this.firstName !== (u.firstName ?? '') ||
      this.lastName !== (u.lastName ?? '') ||
      this.phone !== (u.phone ?? '') ||
      this.avatarUrl !== (u.avatarUrl ?? '')
    );
  }

  protected resetProfile(): void {
    const u = this.user();
    if (!u) return;
    this.hydrateProfile(u);
  }

  protected async onSaveProfile(): Promise<void> {
    const u = this.user();
    if (!u) return;

    const patch: UpdateUserRequest = {};
    if (this.firstName !== (u.firstName ?? ''))
      patch.firstName = this.firstName.trim() || undefined;
    if (this.lastName !== (u.lastName ?? '')) patch.lastName = this.lastName.trim() || undefined;
    if (this.phone !== (u.phone ?? '')) patch.phone = this.phone.trim() || undefined;
    if (this.avatarUrl !== (u.avatarUrl ?? ''))
      patch.avatarUrl = this.avatarUrl.trim() || undefined;

    if (Object.keys(patch).length === 0) return;

    const updated = await this.store.update(u.publicUuid, patch);
    if (updated) this.hydrateProfile(updated);
  }

  // ===========================================================================
  // Roles form
  // ===========================================================================

  protected hasRole(role: UserRole): boolean {
    return this.pendingRoles().includes(role);
  }

  /**
   * The current user cannot remove their own TENANT_ADMIN role —
   * that's the same self-lockout guard the backend enforces. Locking
   * the checkbox client-side avoids a confusing 409 round-trip.
   */
  protected isRoleLocked(role: UserRole): boolean {
    return this.isSelf() && role === UserRole.TenantAdmin;
  }

  protected onToggleRole(role: UserRole, event: Event): void {
    if (this.isRoleLocked(role)) return;
    const checked = (event.target as HTMLInputElement).checked;
    this.pendingRoles.update((roles) => {
      const without = roles.filter((r) => r !== role);
      return checked ? [...without, role] : without;
    });
  }

  protected isRolesDirty(): boolean {
    const u = this.user();
    if (!u) return false;
    return !this.sameSet(u.roles, this.pendingRoles());
  }

  protected resetRoles(): void {
    const u = this.user();
    if (!u) return;
    this.pendingRoles.set([...u.roles]);
  }

  protected async onSaveRoles(): Promise<void> {
    const u = this.user();
    if (!u) return;

    /* Backend refuses an empty role array (422 INVALID_ROLE) — the
     * intent of "no roles" is expressed via {@code disable} instead. */
    const roles = this.pendingRoles();
    if (roles.length === 0) return;

    const updated = await this.store.assignRoles(u.publicUuid, { roles });
    if (updated) this.pendingRoles.set([...updated.roles]);
  }

  // ===========================================================================
  // Lifecycle actions
  // ===========================================================================

  protected async onDisable(): Promise<void> {
    const u = this.user();
    if (!u || this.isSelf()) return;
    const ok = await this.confirmDialog.open({
      title: 'Suspender cuenta',
      message: `¿Suspender la cuenta de ${u.fullName || u.email}?`,
      confirmLabel: 'Suspender',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    await this.store.disable(u.publicUuid);
  }

  protected async onEnable(): Promise<void> {
    const u = this.user();
    if (!u) return;
    await this.store.enable(u.publicUuid);
  }

  protected onResetPassword(): void {
    if (!this.user()) return;
    this.tempPassword.set(null);
    this.resetSent.set(false);
    this.resetModalOpen.set(true);
  }

  protected closeResetModal(): void {
    if (this.saving()) return;
    this.resetModalOpen.set(false);
  }

  protected isSyntheticEmail(): boolean {
    return this.user()?.emailSource === 'SYNTHETIC';
  }

  protected async confirmReset(delivery: AdminPasswordResetDelivery): Promise<void> {
    const u = this.user();
    if (!u) return;
    if (delivery === 'EMAIL' && this.isSyntheticEmail()) return;

    const result = await this.store.resetPassword(u.publicUuid, delivery);
    if (!result) return;

    this.resetModalOpen.set(false);
    if (result.delivery === 'TEMPORARY' && result.temporaryPassword) {
      this.tempPassword.set(result.temporaryPassword);
      this.resetSent.set(false);
    } else {
      this.tempPassword.set(null);
      this.resetSent.set(true);
      setTimeout(() => this.resetSent.set(false), 6000);
    }
  }

  protected async copyTempPassword(): Promise<void> {
    const value = this.tempPassword();
    if (!value || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* ignore — admin can still select-all */
    }
  }

  protected retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.refresh(id);
  }

  protected isSelf(): boolean {
    const me = this.auth.user()?.publicUuid;
    return !!me && me === this.user()?.publicUuid;
  }

  protected rolesSubtitle(u: UserDetail): string {
    if (u.roles.length === 0) return 'Sin rol asignado';
    return `${u.roles.length} rol${u.roles.length === 1 ? '' : 'es'} asignado${u.roles.length === 1 ? '' : 's'}`;
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async refresh(publicUuid: string): Promise<void> {
    const detail = await this.store.loadDetail(publicUuid);
    if (detail) this.hydrateProfile(detail);
  }

  /** Mirror the latest detail into the form fields + role checkboxes. */
  private hydrateProfile(detail: UserDetail): void {
    this.firstName = detail.firstName ?? '';
    this.lastName = detail.lastName ?? '';
    this.phone = detail.phone ?? '';
    this.avatarUrl = detail.avatarUrl ?? '';
    this.pendingRoles.set([...detail.roles]);
  }

  private sameSet(a: UserRole[], b: UserRole[]): boolean {
    if (a.length !== b.length) return false;
    const aSet = new Set(a);
    return b.every((r) => aSet.has(r));
  }
}

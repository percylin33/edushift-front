import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
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
import {
  AdminPasswordResetDelivery,
  ReplaceStaffAccessRequest,
  StaffPermissionOption,
  StaffAccessState,
  StaffProfileCode,
  UpdateUserRequest,
  UserDetail,
} from '../../models';
import { UsersApiService } from '../../services';
import { UsersStore } from '../../store';

type StaffPermissionFilter = 'all' | 'inherited' | 'exceptions' | 'denied';

interface StaffPermissionGroup {
  category: string;
  permissions: StaffPermissionOption[];
  allowedCount: number;
}

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
                <label class="label" for="user-secondLastName">Apellido materno</label>
                <input id="user-secondLastName" type="text" class="input" [(ngModel)]="secondLastName" />
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
              @if (isStaffAccessDirty()) {
                <p class="mt-1 text-xs text-content-muted">
                  Guarda o descarta los cambios de accesos STAFF antes de guardar los roles.
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
                [disabled]="!isRolesDirty() || saving() || pendingRoles().length === 0 || isStaffAccessDirty()"
                (click)="onSaveRoles()"
              >
                @if (saving()) {
                  <app-spinner [size]="14" label="Guardando" />
                }
                Guardar roles
              </button>
            </footer>
          </section>

          @if (u.roles.includes(StaffRole)) {
            <section class="card lg:col-span-3 overflow-hidden" aria-labelledby="staff-access-title">
              <header class="flex flex-col gap-4 border-b border-border-subtle bg-surface-muted/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div class="flex min-w-0 items-center gap-4">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm">
                    {{ staffInitials(u.fullName || u.email) }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 id="staff-access-title" class="text-base font-semibold text-content">
                        Perfiles y permisos del personal
                      </h2>
                      <app-user-status-badge [status]="u.status" />
                      @if (u.emailVerified) {
                        <span class="badge badge-info">Email verificado</span>
                      }
                    </div>
                    <p class="mt-1 truncate text-sm text-content-muted">
                      {{ u.fullName || u.email }} · {{ u.email }}
                    </p>
                    <p class="mt-1 text-xs text-content-subtle">
                      Combina perfiles y ajusta permisos puntuales para esta persona.
                    </p>
                  </div>
                </div>
                @if (staffAccess(); as summaryAccess) {
                  <div class="flex shrink-0 items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-2.5">
                    <div>
                      <p class="text-[11px] font-medium uppercase tracking-wide text-content-subtle">
                        Permisos efectivos
                      </p>
                      <p class="text-lg font-bold text-primary">
                        {{ staffPermissionMetricsSignal().permitted }}
                        <span class="text-xs font-medium text-content-muted">
                          / {{ summaryAccess.permissionCatalog.length }}
                        </span>
                      </p>
                    </div>
                    <app-icon name="shield-check" [size]="20" class="text-primary" />
                  </div>
                }
              </header>

              @if (staffAccessLoading()) {
                <div class="flex items-center gap-3 p-6 text-sm text-content-muted">
                  <app-spinner [size]="18" label="Cargando accesos" />
                  Cargando perfiles y permisos…
                </div>
              } @else {
                @if (staffAccess(); as access) {
                  <div class="space-y-6 p-4 sm:p-6">
                    @if (staffAccessError()) {
                      <div class="alert alert-danger" role="alert">{{ staffAccessError() }}</div>
                    }
                    @if (isStaffAccessDirty()) {
                      <div class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200" role="status">
                        <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
                        <p>
                          Hay {{ pendingStaffAccessChangeCount() }} cambio(s) sin guardar. La selección
                          se aplicará cuando pulses «Guardar permisos».
                        </p>
                      </div>
                    } @else if (staffAccessSaved()) {
                      <div class="alert alert-success" role="status">
                        Accesos guardados y confirmados por el servidor.
                      </div>
                    }

                    <section aria-labelledby="staff-profiles-title">
                      <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <h3 id="staff-profiles-title" class="text-sm font-semibold text-content">
                            Perfiles de trabajo asignados
                          </h3>
                          <p class="mt-1 max-w-3xl text-xs text-content-muted">
                            Puedes asignar varios perfiles a una persona. En colegios pequeños,
                            una secretaria puede combinar tareas; en equipos grandes, puedes repartirlas.
                          </p>
                        </div>
                        <span class="badge badge-info">
                          {{ staffProfiles().length }} perfil{{ staffProfiles().length === 1 ? '' : 'es' }} activo{{ staffProfiles().length === 1 ? '' : 's' }}
                        </span>
                      </div>
                      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        @for (profile of access.availableProfiles; track profile.code) {
                          <label
                            class="group relative flex min-h-40 cursor-pointer flex-col rounded-xl border bg-surface p-4 transition hover:-translate-y-0.5 hover:shadow-md"
                            [class.border-primary]="staffProfiles().includes(profile.code)"
                            [class.bg-primary-50]="staffProfiles().includes(profile.code)"
                            [class.ring-1]="staffProfiles().includes(profile.code)"
                            [class.ring-primary]="staffProfiles().includes(profile.code)"
                            [class.border-border-subtle]="!staffProfiles().includes(profile.code)"
                          >
                            <input
                              type="checkbox"
                              class="checkbox absolute right-3 top-3"
                              [checked]="staffProfiles().includes(profile.code)"
                              [disabled]="staffAccessSaving()"
                              [attr.aria-label]="'Asignar perfil ' + profile.label"
                              (change)="onToggleStaffProfile(profile.code, $event)"
                            />
                            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-100 text-sm font-bold text-primary dark:bg-primary-900/40 dark:text-primary-200">
                              {{ profile.label.charAt(0) }}
                            </span>
                            <span class="mt-3 flex flex-wrap items-center gap-2 pr-6 text-sm font-semibold text-content">
                              {{ profile.label }}
                              @if (profile.legacy) {
                                <span class="badge badge-warning">Revisar</span>
                              }
                            </span>
                            <span class="mt-1 flex-1 text-xs leading-relaxed text-content-muted">
                              {{ profile.description }}
                            </span>
                            <span class="mt-3 flex items-center justify-between border-t border-border-subtle pt-2 text-[11px]">
                              <span class="text-content-subtle">
                                {{ profile.authorities.length }} permiso{{ profile.authorities.length === 1 ? '' : 's' }} base
                              </span>
                              <span
                                class="font-medium"
                                [class.text-success]="staffProfiles().includes(profile.code)"
                                [class.text-content-muted]="!staffProfiles().includes(profile.code)"
                              >
                                {{ staffProfiles().includes(profile.code) ? 'Activo' : 'Inactivo' }}
                              </span>
                            </span>
                          </label>
                        }
                      </div>
                    </section>

                    <section aria-labelledby="staff-permissions-title">
                      <div class="mb-3">
                        <h3 id="staff-permissions-title" class="text-sm font-semibold text-content">
                          Permisos detallados del sistema
                        </h3>
                        <p class="mt-1 text-xs text-content-muted">
                          Cada ajuste es individual. «Heredar» respeta los perfiles; «Permitir» o «Denegar» crea una excepción para esta persona.
                        </p>
                      </div>
                      <div class="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <label class="relative block w-full xl:max-w-sm">
                          <span class="sr-only">Filtrar permisos</span>
                          <app-icon name="search" [size]="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" />
                          <input
                            type="search"
                            class="input w-full pl-9"
                            placeholder="Filtrar permisos…"
                            [ngModel]="staffPermissionQuerySignal()"
                            [ngModelOptions]="{ standalone: true }"
                            (ngModelChange)="staffPermissionQuerySignal.set($event)"
                          />
                        </label>
                        <div class="flex flex-wrap gap-1 rounded-xl bg-surface-muted p-1" role="group" aria-label="Filtrar permisos por estado">
                          @for (filter of staffPermissionFilters; track filter.value) {
                            <button
                              type="button"
                              class="rounded-lg px-3 py-2 text-xs font-medium transition"
                              [class.bg-surface]="staffPermissionFilterSignal() === filter.value"
                              [class.text-primary]="staffPermissionFilterSignal() === filter.value"
                              [class.shadow-sm]="staffPermissionFilterSignal() === filter.value"
                              [class.text-content-muted]="staffPermissionFilterSignal() !== filter.value"
                              [attr.aria-pressed]="staffPermissionFilterSignal() === filter.value"
                              (click)="staffPermissionFilterSignal.set(filter.value)"
                            >
                              {{ filter.label }}
                              <span class="ml-1 opacity-70">{{ staffPermissionMetricsSignal()[filter.countKey] }}</span>
                            </button>
                          }
                        </div>
                      </div>

                      @if (staffPermissionGroupsSignal().length) {
                        <div class="space-y-4">
                          @for (group of staffPermissionGroupsSignal(); track group.category) {
                            <section class="overflow-hidden rounded-xl border border-border-subtle" [attr.aria-label]="'Permisos del módulo ' + group.category">
                              <header class="flex flex-wrap items-center justify-between gap-2 bg-primary-50/70 px-4 py-3 dark:bg-primary-950/30">
                                <div class="flex flex-wrap items-center gap-2">
                                  <app-icon name="layers" [size]="16" class="text-primary" />
                                  <h4 class="text-xs font-semibold uppercase tracking-wide text-content">
                                    Módulo: {{ group.category }}
                                  </h4>
                                  <span class="badge badge-info">{{ group.permissions.length }} permisos</span>
                                </div>
                                <span class="text-[11px] font-medium text-content-muted">
                                  {{ group.allowedCount === group.permissions.length ? 'Todos permitidos' : group.allowedCount + ' de ' + group.permissions.length + ' permitidos' }}
                                </span>
                              </header>
                              <div class="divide-y divide-border-subtle">
                                @for (permission of group.permissions; track permission.authority) {
                                  <div
                                    class="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                                    [class.border-l-2]="staffPermissionChoice(permission.authority) === 'revoke'"
                                    [class.border-l-danger]="staffPermissionChoice(permission.authority) === 'revoke'"
                                    [class.bg-rose-50]="staffPermissionChoice(permission.authority) === 'revoke'"
                                  >
                                    <div class="min-w-0">
                                      <div class="flex flex-wrap items-center gap-2">
                                        <app-icon name="shield-check" [size]="15" class="shrink-0 text-primary" />
                                        <h5 class="text-sm font-medium text-content">{{ permission.label }}</h5>
                                        <span
                                          class="badge"
                                          [class.badge-success]="previewIncludes(permission.authority)"
                                          [class.badge-danger]="!previewIncludes(permission.authority)"
                                        >
                                          {{ previewIncludes(permission.authority) ? 'Permitido' : 'Denegado' }}
                                        </span>
                                        @if (permission.sensitive) {
                                          <span class="badge badge-warning">Sensible</span>
                                        }
                                        @if (staffPermissionChoice(permission.authority) !== 'inherit') {
                                          <span class="badge badge-info">Excepción individual</span>
                                        }
                                      </div>
                                      <p class="mt-1 pl-6 text-xs text-content-muted">
                                        {{ permissionOrigin(access, permission.authority) }}
                                      </p>
                                    </div>
                                    <div class="inline-flex w-fit rounded-lg bg-surface-muted p-1" role="group" [attr.aria-label]="'Definir acceso para ' + permission.label">
                                      <button
                                        type="button"
                                        class="rounded-md px-2.5 py-1.5 text-[11px] font-medium transition"
                                        [class.bg-surface]="staffPermissionChoice(permission.authority) === 'inherit'"
                                        [class.text-primary]="staffPermissionChoice(permission.authority) === 'inherit'"
                                        [class.shadow-sm]="staffPermissionChoice(permission.authority) === 'inherit'"
                                        [class.text-content-muted]="staffPermissionChoice(permission.authority) !== 'inherit'"
                                        [attr.aria-pressed]="staffPermissionChoice(permission.authority) === 'inherit'"
                                        [disabled]="staffAccessSaving()"
                                        (click)="setStaffPermissionChoice(permission.authority, 'inherit')"
                                      >Heredar</button>
                                      <button
                                        type="button"
                                        class="rounded-md px-2.5 py-1.5 text-[11px] font-medium transition"
                                        [class.bg-surface]="staffPermissionChoice(permission.authority) === 'grant'"
                                        [class.text-primary]="staffPermissionChoice(permission.authority) === 'grant'"
                                        [class.shadow-sm]="staffPermissionChoice(permission.authority) === 'grant'"
                                        [class.text-content-muted]="staffPermissionChoice(permission.authority) !== 'grant'"
                                        [attr.aria-pressed]="staffPermissionChoice(permission.authority) === 'grant'"
                                        [disabled]="staffAccessSaving()"
                                        (click)="setStaffPermissionChoice(permission.authority, 'grant')"
                                      >Permitir</button>
                                      <button
                                        type="button"
                                        class="rounded-md px-2.5 py-1.5 text-[11px] font-medium transition"
                                        [class.bg-danger]="staffPermissionChoice(permission.authority) === 'revoke'"
                                        [class.text-white]="staffPermissionChoice(permission.authority) === 'revoke'"
                                        [class.shadow-sm]="staffPermissionChoice(permission.authority) === 'revoke'"
                                        [class.text-content-muted]="staffPermissionChoice(permission.authority) !== 'revoke'"
                                        [attr.aria-pressed]="staffPermissionChoice(permission.authority) === 'revoke'"
                                        [disabled]="staffAccessSaving()"
                                        (click)="setStaffPermissionChoice(permission.authority, 'revoke')"
                                      >Denegar</button>
                                    </div>
                                  </div>
                                }
                              </div>
                            </section>
                          }
                        </div>
                      } @else {
                        <div class="rounded-xl border border-dashed border-border-subtle px-4 py-10 text-center">
                          <app-icon name="search" [size]="24" class="mx-auto text-content-subtle" />
                          <p class="mt-2 text-sm font-medium text-content">No hay permisos para mostrar</p>
                          <p class="mt-1 text-xs text-content-muted">Prueba otra búsqueda o cambia el filtro.</p>
                        </div>
                      }
                    </section>

                    <footer class="sticky bottom-3 z-10 flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 class="text-sm font-semibold text-content">Capacidades efectivas</h3>
                        <div class="mt-2 flex flex-wrap gap-2">
                          <span class="badge badge-success">{{ staffPermissionMetricsSignal().permitted }} permitidos</span>
                          <span class="badge badge-info">{{ staffPermissionMetricsSignal().exceptions }} excepciones</span>
                          <span class="badge badge-warning">{{ staffPermissionMetricsSignal().denied }} denegados</span>
                        </div>
                      </div>
                      <div class="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          class="btn btn-ghost btn-sm"
                          [disabled]="!isStaffAccessDirty() || staffAccessSaving()"
                          (click)="resetStaffAccess()"
                        >
                          Descartar cambios
                        </button>
                        <button
                          type="button"
                          class="btn btn-primary btn-sm"
                          [disabled]="!isStaffAccessDirty() || staffAccessSaving()"
                          (click)="saveStaffAccess()"
                        >
                          @if (staffAccessSaving()) {
                            <app-spinner [size]="14" label="Guardando permisos" />
                          }
                          Guardar permisos
                          @if (isStaffAccessDirty()) {
                            <span class="ml-1">({{ pendingStaffAccessChangeCount() }})</span>
                          }
                        </button>
                      </div>
                    </footer>
                  </div>
                } @else {
                  <div class="p-6 text-sm text-content-muted">
                    {{ staffAccessError() || 'No se pudieron cargar los accesos de esta persona.' }}
                    <button type="button" class="btn btn-ghost btn-sm ml-2" (click)="reloadStaffAccess()">
                      Reintentar
                    </button>
                  </div>
                }
              }
            </section>
          }

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
  private readonly usersApi = inject(UsersApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly Active = UserStatus.Active;
  protected readonly StaffRole = UserRole.Staff;
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
  protected secondLastName = '';
  protected phone = '';
  protected avatarUrl = '';

  // ---- roles form state ----
  protected readonly pendingRoles = signal<UserRole[]>([]);
  protected readonly resetSent = signal(false);
  protected readonly resetModalOpen = signal(false);
  protected readonly tempPassword = signal<string | null>(null);
  protected readonly staffAccess = signal<StaffAccessState | null>(null);
  protected readonly staffAccessLoading = signal(false);
  protected readonly staffAccessSaving = signal(false);
  protected readonly staffAccessError = signal<string | null>(null);
  protected readonly staffAccessSaved = signal(false);
  protected readonly staffProfiles = signal<StaffProfileCode[]>([]);
  private readonly staffPermissionOverrides = signal<Record<string, boolean>>({});
  protected readonly staffPermissionFilterSignal = signal<StaffPermissionFilter>('all');
  protected readonly staffPermissionQuerySignal = signal('');
  protected readonly staffPermissionFilters = [
    { value: 'all', label: 'Todos', countKey: 'all' },
    { value: 'inherited', label: 'Heredados', countKey: 'inherited' },
    { value: 'exceptions', label: 'Excepciones', countKey: 'exceptions' },
    { value: 'denied', label: 'Denegados', countKey: 'denied' },
  ] as const;

  protected readonly staffPermissionMetricsSignal = computed(() => {
    const access = this.staffAccess();
    if (!access) return { all: 0, inherited: 0, exceptions: 0, denied: 0, permitted: 0 };

    const effective = new Set(this.staffAccessPreview());
    const overrides = this.staffPermissionOverrides();
    const hasOverride = (authority: string) =>
      Object.prototype.hasOwnProperty.call(overrides, authority);
    const permissions = access.permissionCatalog;

    return {
      all: permissions.length,
      inherited: permissions.filter((permission) =>
        effective.has(permission.authority) && !hasOverride(permission.authority),
      ).length,
      exceptions: permissions.filter((permission) => hasOverride(permission.authority)).length,
      denied: permissions.filter((permission) => !effective.has(permission.authority)).length,
      permitted: permissions.filter((permission) => effective.has(permission.authority)).length,
    };
  });

  protected readonly staffPermissionGroupsSignal = computed<StaffPermissionGroup[]>(() => {
    const access = this.staffAccess();
    if (!access) return [];

    const query = this.staffPermissionQuerySignal().trim().toLocaleLowerCase();
    const filter = this.staffPermissionFilterSignal();
    const effective = new Set(this.staffAccessPreview());
    const overrides = this.staffPermissionOverrides();
    const hasOverride = (authority: string) =>
      Object.prototype.hasOwnProperty.call(overrides, authority);
    const groups = new Map<string, StaffPermissionOption[]>();

    for (const permission of access.permissionCatalog) {
      const allowed = effective.has(permission.authority);
      const overridden = hasOverride(permission.authority);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'inherited' && allowed && !overridden) ||
        (filter === 'exceptions' && overridden) ||
        (filter === 'denied' && !allowed);
      const searchText =
        `${permission.label} ${permission.category} ${permission.authority}`.toLocaleLowerCase();

      if (!matchesFilter || (query && !searchText.includes(query))) continue;
      const category = permission.category.trim() || 'Otros permisos';
      const categoryPermissions = groups.get(category) ?? [];
      categoryPermissions.push(permission);
      groups.set(category, categoryPermissions);
    }

    return [...groups.entries()].map(([category, permissions]) => ({
      category,
      permissions,
      allowedCount: permissions.filter((permission) =>
        effective.has(permission.authority),
      ).length,
    }));
  });

  /** Manageable role catalog. SUPER_ADMIN / GUEST are intentionally hidden. */
  protected readonly roleOptions: ReadonlyArray<{
    value: UserRole;
    label: string;
    description: string;
  }> = [
    {
      value: UserRole.TenantAdmin,
      label: 'Administrador',
      description: 'Acceso total a la institución y a la gestión de usuarios.',
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
      this.secondLastName !== (u.secondLastName ?? '') ||
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
    if (this.secondLastName !== (u.secondLastName ?? ''))
      patch.secondLastName = this.secondLastName.trim();
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
    if (!u || this.isStaffAccessDirty()) return;

    /* Backend refuses an empty role array (422 INVALID_ROLE) — the
     * intent of "no roles" is expressed via {@code disable} instead. */
    const roles = this.pendingRoles();
    if (roles.length === 0) return;

    const updated = await this.store.assignRoles(u.publicUuid, { roles });
    if (updated) {
      this.pendingRoles.set([...updated.roles]);
      if (updated.roles.includes(UserRole.Staff)) {
        await this.loadStaffAccess(updated.publicUuid);
      } else {
        this.staffAccess.set(null);
        this.staffProfiles.set([]);
        this.staffPermissionOverrides.set({});
      }
    }
  }

  protected onToggleStaffProfile(profile: StaffProfileCode, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.staffAccessSaved.set(false);
    this.staffAccessError.set(null);
    this.staffProfiles.update((profiles) => {
      const without = profiles.filter((item) => item !== profile);
      return checked ? [...without, profile] : without;
    });
  }

  protected staffPermissionChoice(authority: string): 'inherit' | 'grant' | 'revoke' {
    const value = this.staffPermissionOverrides()[authority];
    return value === true ? 'grant' : value === false ? 'revoke' : 'inherit';
  }

  protected setStaffPermissionChoice(authority: string, choice: string): void {
    this.staffAccessSaved.set(false);
    this.staffAccessError.set(null);
    this.staffPermissionOverrides.update((current) => {
      const next = { ...current };
      if (choice === 'grant') next[authority] = true;
      else if (choice === 'revoke') next[authority] = false;
      else delete next[authority];
      return next;
    });
  }

  protected staffInitials(name: string): string {
    const initials = name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toLocaleUpperCase();
    return initials || 'ST';
  }

  protected permissionOrigin(access: StaffAccessState, authority: string): string {
    const override = this.staffPermissionOverrides()[authority];
    if (override === true) return 'Otorgado mediante una excepción individual.';
    if (override === false) return 'Denegado mediante una excepción individual.';

    const profiles = this.permissionSources(access, authority);
    if (profiles.length) return `Heredado de: ${profiles.join(', ')}.`;
    if (access.baseAuthorities.includes(authority)) {
      return 'Incluido en los permisos base del colegio o del rol.';
    }
    return 'No lo concede ningún perfil asignado.';
  }

  protected pendingStaffAccessChangeCount(): number {
    const access = this.staffAccess();
    if (!access) return 0;

    const originalProfiles = new Set(access.profiles);
    const selectedProfiles = new Set(this.staffProfiles());
    let changes = [...new Set([...originalProfiles, ...selectedProfiles])].filter(
      (profile) => originalProfiles.has(profile) !== selectedProfiles.has(profile),
    ).length;

    const originalOverrides = access.overrides;
    const selectedOverrides = this.staffPermissionOverrides();
    const authorities = new Set([
      ...Object.keys(originalOverrides),
      ...Object.keys(selectedOverrides),
    ]);
    for (const authority of authorities) {
      const wasOverridden = Object.prototype.hasOwnProperty.call(originalOverrides, authority);
      const isOverridden = Object.prototype.hasOwnProperty.call(selectedOverrides, authority);
      if (
        wasOverridden !== isOverridden ||
        (wasOverridden && originalOverrides[authority] !== selectedOverrides[authority])
      ) {
        changes++;
      }
    }
    return changes;
  }

  protected permissionSources(access: StaffAccessState, authority: string): string[] {
    return access.availableProfiles
      .filter((profile) => this.staffProfiles().includes(profile.code))
      .filter((profile) => profile.authorities.includes(authority))
      .map((profile) => profile.label);
  }

  protected previewIncludes(authority: string): boolean {
    return this.staffAccessPreview().includes(authority);
  }

  protected staffAccessPreview(): string[] {
    const state = this.staffAccess();
    if (!state) return [];
    const effective = new Set(state.baseAuthorities);
    for (const profile of state.availableProfiles) {
      if (!this.staffProfiles().includes(profile.code)) continue;
      profile.authorities.forEach((authority) => effective.add(authority));
    }
    for (const [authority, granted] of Object.entries(this.staffPermissionOverrides())) {
      if (granted) effective.add(authority);
      else effective.delete(authority);
    }
    return [...effective].sort();
  }

  protected isStaffAccessDirty(): boolean {
    const state = this.staffAccess();
    if (!state) return false;
    return (
      this.sorted(this.staffProfiles()) !== this.sorted(state.profiles) ||
      this.sortedEntries(this.staffPermissionOverrides()) !== this.sortedEntries(state.overrides)
    );
  }

  protected resetStaffAccess(): void {
    const state = this.staffAccess();
    if (!state) return;
    this.staffProfiles.set([...state.profiles]);
    this.staffPermissionOverrides.set({ ...state.overrides });
    this.staffAccessError.set(null);
    this.staffAccessSaved.set(false);
  }

  protected async saveStaffAccess(): Promise<void> {
    const user = this.user();
    if (!user || !this.staffAccess() || this.staffAccessSaving()) return;
    const request: ReplaceStaffAccessRequest = {
      profiles: [...this.staffProfiles()],
      overrides: { ...this.staffPermissionOverrides() },
    };
    this.staffAccessSaving.set(true);
    this.staffAccessError.set(null);
    this.staffAccessSaved.set(false);
    try {
      const savedState = await firstValueFrom(
        this.usersApi.replaceStaffAccess(user.publicUuid, request),
      );
      this.applyStaffAccess(savedState);
      const profilesMatch =
        this.sorted(request.profiles) === this.sorted(savedState.profiles);
      const overridesMatch =
        this.sortedEntries(request.overrides) === this.sortedEntries(savedState.overrides);
      if (!profilesMatch || !overridesMatch) {
        this.staffAccessError.set(
          'El servidor devolvió accesos distintos de los seleccionados. Recarga la sección y vuelve a intentarlo.',
        );
        return;
      }
      this.staffAccessSaved.set(true);
    } catch (error) {
      this.staffAccessError.set(this.errorMessage(error));
    } finally {
      this.staffAccessSaving.set(false);
    }
  }

  protected reloadStaffAccess(): void {
    const user = this.user();
    if (user?.roles.includes(UserRole.Staff)) void this.loadStaffAccess(user.publicUuid);
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
    if (detail) {
      this.hydrateProfile(detail);
      if (detail.roles.includes(UserRole.Staff)) await this.loadStaffAccess(detail.publicUuid);
    }
  }

  private async loadStaffAccess(publicUuid: string): Promise<void> {
    this.staffAccessLoading.set(true);
    this.staffAccessError.set(null);
    try {
      this.applyStaffAccess(await firstValueFrom(this.usersApi.getStaffAccess(publicUuid)));
    } catch (error) {
      this.staffAccess.set(null);
      this.staffAccessError.set(this.errorMessage(error));
    } finally {
      this.staffAccessLoading.set(false);
    }
  }

  private applyStaffAccess(state: StaffAccessState): void {
    this.staffAccess.set(state);
    this.staffProfiles.set([...state.profiles]);
    this.staffPermissionOverrides.set({ ...state.overrides });
    this.staffAccessSaved.set(false);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  }

  private sorted(values: string[]): string {
    return [...values].sort().join('|');
  }

  private sortedEntries(values: Record<string, boolean>): string {
    return Object.entries(values)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
  }

  /** Mirror the latest detail into the form fields + role checkboxes. */
  private hydrateProfile(detail: UserDetail): void {
    this.firstName = detail.firstName ?? '';
    this.lastName = detail.lastName ?? '';
    this.secondLastName = detail.secondLastName ?? '';
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

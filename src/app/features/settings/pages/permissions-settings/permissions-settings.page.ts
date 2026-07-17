import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserRole } from '@core/enums';
import { IconComponent } from '@shared/components';
import { PermissionOverridesStore } from '../../store/permission-overrides.store';

/**
 * D1 / F0.5 — Custom role permissions matrix.
 *
 * <p>Renders one checkbox per (role, authority) intersection. The
 * checkbox tri-state semantics are explained in {@code RolePermission
 * OverrideDto.platformDefault} / {@code isOverride}. A "Restablecer"
 * button below the matrix clears every override for the tenant
 * (TODO: backend endpoint POST /permission-overrides/reset-all —
 * pending FE-X.X).</p>
 *
 * <p>The role columns are TENANT_ADMIN, TEACHER, STUDENT, PARENT,
 * STAFF. SUPER_ADMIN is intentionally absent — it cannot be
 * customised per tenant (see {@code RolePermissionOverride}
 * class-level javadoc and the BE controller for the tenant guard).</p>
 *
 * <p>Authorities are read from
 * {@code LmsAuthorities} via the {@code Permission} enum on the
 * FE side. We render only those that the BE whitelist accepts
 * (the GET endpoint surfaces whatever is currently active).</p>
 *
 * @see docs/qa/12-custom-permissions-feature.md §G.3 for the original
 *      mockup and tri-state UX rationale.
 */
@Component({
  selector: 'app-permissions-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent],
  template: `
    <section class="space-y-6" data-testid="permissions-page">
      <header>
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Permisos por rol
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Personaliza qué authorities (LMS_*) recibe cada rol dentro
          de tu colegio. Los cambios se aplican a las nuevas sesiones;
          los usuarios conectados deben volver a iniciar sesión.
        </p>
      </header>

      @if (store.loading()) {
        <p class="flex items-center gap-2 text-sm text-slate-500">
          <app-icon name="rotate-cw" /> Cargando matriz…
        </p>
      } @else if (store.error()) {
        <div
          role="alert"
          class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
        >
          {{ store.error() }}
        </div>
      } @else {
        <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-slate-600 dark:text-slate-300">
                  Authority
                </th>
                @for (r of ROLES; track r) {
                  <th
                    class="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-300"
                  >
                    {{ roleLabel(r) }}
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (a of AUTHORITIES; track a) {
                <tr class="border-t border-slate-200 dark:border-slate-700">
                  <td class="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                    {{ a }}
                  </td>
                  @for (r of ROLES; track r) {
                    <td class="px-3 py-2 text-center">
                      <label class="inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                          [checked]="cellGranted(r, a)"
                          [attr.aria-label]="
                            'Conceder ' + a + ' a ' + roleLabel(r)
                          "
                          (change)="onToggle(r, a, $event)"
                          data-testid="perm-cell"
                          [attr.data-role]="r"
                          [attr.data-authority]="a"
                        />
                      </label>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <p class="text-xs text-slate-500 dark:text-slate-400">
          Las casillas marcadas indican grants explícitos del colegio.
          Para volver a los defaults de plataforma espera la próxima
          iteración (POST /permission-overrides/reset-all).
        </p>
      }
    </section>
  `,
})
export class PermissionsSettingsPageComponent implements OnInit {
  protected readonly store = inject(PermissionOverridesStore);

  // Roles rendered as columns (intentional subset — SUPER_ADMIN immutable).
  protected readonly ROLES: UserRole[] = [
    UserRole.TenantAdmin,
    UserRole.Teacher,
    UserRole.Student,
    UserRole.Parent,
    UserRole.Staff,
  ];

  // Authorities we can render as rows. Matches the BE whitelist in
  // LmsAuthorities.java — adding a constant here without updating the
  // BE is a no-op (the BE will return an empty cell for unknown strings).
  protected readonly AUTHORITIES: readonly string[] = [
    'LMS_TASK_READ',
    'LMS_TASK_CREATE',
    'LMS_TASK_GRADE',
    'LMS_TASK_SUBMIT',
    'LMS_MATERIAL_READ',
    'LMS_MATERIAL_WRITE',
    'LMS_MATERIAL_DELETE',
    'LMS_QUIZ_READ',
    'LMS_QUIZ_CREATE',
    'LMS_QUIZ_GRADE',
    'LMS_QUIZ_SUBMIT',
    'LMS_AI_GENERATE',
    'LMS_AI_USAGE',
    'LMS_PAYMENT_ADMIN',
    'LMS_ANNOUNCEMENTS_CREATE',
    'LMS_NOTIFICATIONS_MANAGE',
  ];

  /** Override rows ready for the table. */
  protected readonly cells = computed(() => this.store.indexedByRole());

  ngOnInit(): void {
    this.store.load();
  }

  /**
   * Tri-state reading:
   * <ul>
   *   <li>Cell has an explicit override → use its `granted` value.</li>
   *   <li>Cell has no override → fall back to the platform default
   *       declared in {@code LmsRoleAuthorityMapper}. We approximate
   *       that by checking against a hard-coded defaults map mirroring
   *       the BE.</li>
   * </ul>
   * The platform default map below is intentionally a copy of
   * {@code LmsRoleAuthorityMapper.DEFAULTS}; any drift between this
   * and the BE will surface here as a wrong checkbox state and is
   * acceptable as a UX-only issue (the source of truth is the BE).
   */
  protected cellGranted(role: UserRole, authority: string): boolean {
    const overrides = this.cells().get(role);
    if (overrides && overrides.has(authority)) {
      return overrides.get(authority)!.granted;
    }
    return PLATFORM_DEFAULTS[role].has(authority);
  }

  protected onToggle(
    role: UserRole,
    authority: string,
    ev: Event,
  ): void {
    const checked = (ev.target as HTMLInputElement).checked;
    this.store.toggle({ role, authority, granted: checked });
  }

  protected roleLabel(role: UserRole): string {
    return ROLE_LABELS[role];
  }
}

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SuperAdmin]: 'SA',
  [UserRole.TenantAdmin]: 'Admin',
  [UserRole.Staff]: 'Staff',
  [UserRole.Teacher]: 'Teacher',
  [UserRole.Student]: 'Student',
  [UserRole.Parent]: 'Parent',
  [UserRole.Guest]: 'Guest',
};

// Mirror of LmsRoleAuthorityMapper.DEFAULTS on the BE. Source of truth is
// the BE; this is a UX fallback only (when no override exists for a cell).
const PLATFORM_DEFAULTS: Record<UserRole, Set<string>> = {
  [UserRole.SuperAdmin]: new Set(),
  [UserRole.TenantAdmin]: new Set([
    'LMS_TASK_READ','LMS_TASK_CREATE','LMS_TASK_GRADE','LMS_TASK_SUBMIT',
    'LMS_MATERIAL_READ','LMS_MATERIAL_WRITE','LMS_MATERIAL_DELETE',
    'LMS_QUIZ_READ','LMS_QUIZ_CREATE','LMS_QUIZ_GRADE','LMS_QUIZ_SUBMIT',
    'LMS_AI_GENERATE','LMS_AI_USAGE','LMS_PAYMENT_ADMIN',
    'LMS_ANNOUNCEMENTS_CREATE','LMS_NOTIFICATIONS_MANAGE',
  ]),
  [UserRole.Staff]: new Set([
    'LMS_TASK_READ','LMS_MATERIAL_READ','LMS_QUIZ_READ','LMS_PAYMENT_ADMIN',
  ]),
  [UserRole.Teacher]: new Set([
    'LMS_TASK_READ','LMS_TASK_CREATE','LMS_TASK_GRADE',
    'LMS_MATERIAL_READ','LMS_MATERIAL_WRITE','LMS_MATERIAL_DELETE',
    'LMS_QUIZ_READ','LMS_QUIZ_CREATE','LMS_QUIZ_GRADE','LMS_AI_GENERATE',
  ]),
  [UserRole.Student]: new Set([
    'LMS_TASK_READ','LMS_TASK_SUBMIT',
    'LMS_MATERIAL_READ','LMS_QUIZ_READ','LMS_QUIZ_SUBMIT',
  ]),
  [UserRole.Parent]: new Set([
    'LMS_TASK_READ','LMS_TASK_SUBMIT',
    'LMS_MATERIAL_READ','LMS_QUIZ_READ','LMS_QUIZ_SUBMIT',
  ]),
  [UserRole.Guest]: new Set(),
};

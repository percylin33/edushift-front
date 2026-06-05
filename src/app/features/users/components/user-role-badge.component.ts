import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UserRole } from '@core/enums';

/**
 * Visual chip for a single {@link UserRole}.
 *
 * <p>Each role gets its own color tier so admins can scan a long list
 * at a glance: TENANT_ADMIN is the most prominent, GUEST the least.
 * Falls back to a neutral chip for forward-compat (unknown enum values
 * never crash the cell — they just render with the neutral palette).
 */
@Component({
  selector: 'app-user-role-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="badgeClass()">{{ label() }}</span>
  `
})
export class UserRoleBadgeComponent {
  readonly role = input.required<UserRole>();

  readonly label = computed(() => UserRoleBadgeComponent.LABELS[this.role()] ?? this.role());
  readonly badgeClass = computed(() => `badge ${UserRoleBadgeComponent.TIER[this.role()] ?? 'badge-neutral'}`);

  private static readonly LABELS: Readonly<Record<UserRole, string>> = {
    [UserRole.SuperAdmin]:  'Super Admin',
    [UserRole.TenantAdmin]: 'Administrador',
    [UserRole.Staff]:       'Staff',
    [UserRole.Teacher]:     'Profesor',
    [UserRole.Student]:     'Estudiante',
    [UserRole.Guardian]:    'Tutor',
    [UserRole.Guest]:       'Invitado'
  };

  private static readonly TIER: Readonly<Record<UserRole, string>> = {
    [UserRole.SuperAdmin]:  'badge-danger',
    [UserRole.TenantAdmin]: 'badge-primary',
    [UserRole.Staff]:       'badge-info',
    [UserRole.Teacher]:     'badge-success',
    [UserRole.Student]:     'badge-neutral',
    [UserRole.Guardian]:    'badge-warning',
    [UserRole.Guest]:       'badge-neutral'
  };
}

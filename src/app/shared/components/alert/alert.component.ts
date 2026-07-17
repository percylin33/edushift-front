import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '@shared/components/icon';
import { IconName } from '@shared/components/icon/icons.registry';

export type AlertVariant = 'error' | 'success' | 'warning' | 'info';

/**
 * Inline status banner used by forms to surface top-level feedback
 * (network errors, success confirmations, rate-limit warnings, etc.).
 *
 * <p>Replaces the duplicated `role="alert" + danger-bg + alert-circle icon`
 * pattern that used to live inline in every auth form.
 */
@Component({
  selector: 'app-alert',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div [class]="containerClass()" [attr.role]="roleAttr()" [attr.aria-live]="ariaLive()">
      <app-icon [name]="iconName()" [size]="18" class="mt-0.5 shrink-0" />
      <span>{{ message }}</span>
    </div>
  `,
})
export class AlertComponent {
  @Input({ required: true }) variant!: AlertVariant;
  @Input({ required: true }) message!: string;

  /** Override the default icon (e.g. for a custom success message). */
  @Input() icon?: IconName;

  /** ARIA role override. Defaults to `alert` for errors, `status` otherwise. */
  @Input() role?: 'alert' | 'status';

  iconName(): IconName {
    if (this.icon) return this.icon;
    switch (this.variant) {
      case 'error':
        return 'alert-circle';
      case 'success':
        return 'check';
      case 'warning':
        return 'alert-triangle';
      case 'info':
        return 'info';
    }
  }

  roleAttr(): 'alert' | 'status' {
    if (this.role) return this.role;
    return this.variant === 'error' ? 'alert' : 'status';
  }

  ariaLive(): 'assertive' | 'polite' {
    return this.roleAttr() === 'alert' ? 'assertive' : 'polite';
  }

  containerClass(): string {
    const base = 'flex items-start gap-2 rounded-md border p-3 text-sm';
    switch (this.variant) {
      case 'error':
        return `${base} border-danger/30 bg-danger/10 text-danger`;
      case 'success':
        return `${base} border-success/30 bg-success/10 text-success`;
      case 'warning':
        return `${base} border-warning/30 bg-warning/10 text-warning`;
      case 'info':
        return `${base} border-border bg-surface-muted text-content`;
    }
  }
}
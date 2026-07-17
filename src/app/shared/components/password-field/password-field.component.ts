import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon';
import { FormFieldTheme } from '@shared/components/form-field/form-field.component';

export type PasswordAutocomplete = 'current-password' | 'new-password';

/**
 * Password input with a leading lock icon, an eye toggle, and configurable
 * autocomplete. Eliminates the ~25 lines of inline markup + visibility
 * signal that lived in every password-bearing form.
 *
 * <p>Uses {@link fieldId} (not {@code id}) to avoid Angular's
 * auto-binding of an {@code id} input to the host element — see
 * {@link FormFieldComponent} for the rationale.</p>
 */
@Component({
  selector: 'app-password-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <div class="space-y-1.5">
      @if (label) {
        <label [attr.for]="fieldId" class="block text-sm font-medium text-content">
          {{ label }}
        </label>
      }
      <div class="relative">
        <span
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
          [class]="iconColorClass()"
        >
          <app-icon name="lock" [size]="16" />
        </span>
        <input
          [id]="fieldId"
          [type]="visible() ? 'text' : 'password'"
          [formControl]="control"
          [placeholder]="placeholder || null"
          [attr.autocomplete]="autocomplete"
          [attr.maxlength]="maxlength || null"
          [attr.aria-invalid]="hasError() ? 'true' : null"
          [attr.aria-describedby]="describedBy()"
          [class]="inputClass()"
        />
        <button
          type="button"
          (click)="toggle()"
          [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          [class]="toggleClass()"
        >
          <app-icon [name]="visible() ? 'eye-off' : 'eye'" [size]="16" />
        </button>
      </div>
      @if (hasError()) {
        <p [id]="fieldId + '-error'" class="text-xs text-danger">{{ error }}</p>
      } @else if (hint) {
        <p [id]="fieldId + '-hint'" class="text-xs text-content-subtle">{{ hint }}</p>
      }
    </div>
  `,
})
export class PasswordFieldComponent {
  @Input({ required: true }) fieldId!: string;
  @Input({ required: true }) control!: FormControl<string | null>;

  @Input() label?: string;
  @Input() placeholder?: string;
  @Input() autocomplete: PasswordAutocomplete = 'current-password';
  @Input() maxlength?: number;

  @Input() error: string | null = null;
  @Input() hint?: string;

  @Input() theme: FormFieldTheme = 'light';

  private readonly _visible = signal(false);
  readonly visible = this._visible.asReadonly();

  toggle(): void {
    this._visible.update((v) => !v);
  }

  hasError(): boolean {
    return !!this.error;
  }

  describedBy(): string | null {
    if (this.hasError()) return `${this.fieldId}-error`;
    if (this.hint) return `${this.fieldId}-hint`;
    return null;
  }

  iconColorClass(): string {
    return this.theme === 'dark' ? 'text-slate-500' : 'text-content-subtle';
  }

  inputClass(): string {
    const base = 'w-full rounded-md border py-2 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70';
    const light = 'bg-surface text-content border-border placeholder:text-content-subtle focus:border-primary-500 focus:ring-primary-500/30';
    const dark = 'bg-slate-800 text-white border-slate-700 placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500';
    if (this.theme === 'dark') {
      const disabled = this.control.disabled ? ' bg-slate-900' : '';
      return `${base} ${dark}${disabled}`;
    }
    const disabled = this.control.disabled ? ' bg-surface-muted' : '';
    return `${base} ${light}${disabled}`;
  }

  toggleClass(): string {
    const base = 'absolute inset-y-0 right-0 flex items-center pr-3 focus:outline-none';
    return this.theme === 'dark'
      ? `${base} text-slate-500 hover:text-slate-300`
      : `${base} text-content-subtle hover:text-content`;
  }
}
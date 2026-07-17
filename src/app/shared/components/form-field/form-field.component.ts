import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon';
import { IconName } from '@shared/components/icon/icons.registry';

export type FormFieldType = 'text' | 'email' | 'password' | 'tel' | 'number' | 'search';
export type FormFieldTheme = 'light' | 'dark';

/**
 * Generic labeled input with an optional leading icon, error/help text and
 * `aria-describedby` wiring. Replaces the ~30 lines of inline label+input+
 * icon+error that used to live in each auth form template.
 *
 * <p>Accepts an {@link AbstractControl} (commonly a
 * {@code FormControl<string>}) directly so the parent can keep using
 * `nonNullable.group({...})` without restructuring its form tree.
 * The {@link fieldId} is required so {@code <label for>} works.</p>
 *
 * <p><strong>Why {@code fieldId} and not {@code id}.</strong>
 * Angular auto-binds inputs named {@code id} to the host element's
 * {@code id} attribute, which would produce two elements with the same
 * id (the host + the rendered {@code <input>}) and break
 * {@code document.getElementById} / strict-mode test selectors. The
 * inner {@code <input>} still gets {@code id="<fieldId>"} via the
 * template's {@code [id]} binding.</p>
 */
@Component({
  selector: 'app-form-field',
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
        @if (icon) {
          <span
            class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
            [class]="iconColorClass()"
          >
            <app-icon [name]="icon" [size]="16" />
          </span>
        }
        <input
          [id]="fieldId"
          [type]="type"
          [formControl]="control"
          [placeholder]="placeholder || null"
          [attr.autocomplete]="autocomplete || null"
          [attr.inputmode]="inputmode || null"
          [attr.maxlength]="maxlength || null"
          [attr.spellcheck]="spellcheck === false ? 'false' : null"
          [attr.autocapitalize]="autocapitalize || null"
          [attr.aria-invalid]="hasError() ? 'true' : null"
          [attr.aria-describedby]="describedBy()"
          [class]="inputClass()"
        />
        @if (suffix) {
          <span class="absolute inset-y-0 right-0 flex items-center pr-3">
            <ng-content></ng-content>
          </span>
        }
      </div>
      @if (hasError()) {
        <p [id]="fieldId + '-error'" class="text-xs text-danger">{{ error }}</p>
      } @else if (hint) {
        <p [id]="fieldId + '-hint'" class="text-xs text-content-subtle">{{ hint }}</p>
      }
    </div>
  `,
})
export class FormFieldComponent {
  @Input({ required: true }) fieldId!: string;
  @Input({ required: true }) control!: FormControl<string | null>;

  @Input() label?: string;
  @Input() icon?: IconName;
  @Input() type: FormFieldType = 'text';
  @Input() placeholder?: string;
  @Input() autocomplete?: string;
  @Input() inputmode?: 'numeric' | 'text' | 'tel' | 'email' | 'search';
  @Input() maxlength?: number;
  @Input() spellcheck?: boolean;
  @Input() autocapitalize?: 'off' | 'on';

  @Input() error: string | null = null;
  @Input() hint?: string;

  @Input() theme: FormFieldTheme = 'light';

  /** Set true to reserve right padding for a projected child (e.g. eye toggle). */
  @Input() suffix = false;

  /** Extra classes appended to the input element (e.g. `text-center font-mono`). */
  @Input() extraInputClass = '';

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
    const base = 'w-full rounded-md border py-2 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70';
    const light = 'bg-surface text-content border-border placeholder:text-content-subtle focus:border-primary-500 focus:ring-primary-500/30';
    const dark = 'bg-slate-800 text-white border-slate-700 placeholder-slate-500 focus:border-indigo-500 focus:ring-indigo-500';
    const disabledLight = this.control.disabled ? 'bg-surface-muted' : '';
    const disabledDark = this.control.disabled ? 'bg-slate-900' : '';
    const padding = this.suffix ? 'pl-9 pr-10' : this.icon ? 'pl-9 pr-3' : 'px-3';
    const theme = this.theme === 'dark' ? `${dark} ${disabledDark}` : `${light} ${disabledLight}`;
    return `${base} ${padding} ${theme} ${this.extraInputClass}`.trim();
  }
}
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '@shared/components/icon';
import { SpinnerComponent } from '@shared/components/spinner/spinner.component';

export type SubmitButtonTheme = 'light' | 'dark';
export type SubmitButtonSize = 'md' | 'lg';

/**
 * Primary submit button with built-in loading state. Used in every auth form
 * to replace the inline `<button><app-spinner> Label…</button>` boilerplate.
 *
 * <p>The dark theme variant is for screens like {@code AdminLoginComponent}
 * which use the slate-800/slate-900 palette instead of the brand-primary
 * gradient used by the public auth flow.
 */
@Component({
  selector: 'app-submit-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  template: `
    <button
      type="submit"
      [disabled]="disabled || loading"
      [class]="buttonClass()"
    >
      @if (loading) {
        <app-spinner [size]="16" [label]="loadingLabel || label" />
        <span>{{ loadingLabel || label }}</span>
      } @else {
        <span>{{ label }}</span>
        @if (showArrow) {
          <app-icon name="arrow-right" [size]="16" />
        }
      }
    </button>
  `,
})
export class SubmitButtonComponent {
  @Input({ required: true }) loading!: boolean;
  @Input() disabled = false;
  @Input({ required: true }) label!: string;
  @Input() loadingLabel?: string;
  @Input() theme: SubmitButtonTheme = 'light';
  @Input() size: SubmitButtonSize = 'lg';
  @Input() showArrow = true;

  buttonClass(): string {
    const padding = this.size === 'lg' ? 'py-2.5' : 'py-2';
    const base = `inline-flex w-full items-center justify-center gap-2 rounded-md ${padding} px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60`;
    if (this.theme === 'dark') {
      return `${base} bg-indigo-600 hover:bg-indigo-500 focus-visible:ring-indigo-500/40`;
    }
    return `${base} bg-primary-600 hover:bg-primary-700 focus-visible:ring-primary-500/40`;
  }
}
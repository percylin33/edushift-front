import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  inject,
  input,
} from '@angular/core';
import { SpinnerComponent } from '@shared/components';

/**
 * "Sign in with Google" CTA button.
 *
 * <h3>Why a dedicated component</h3>
 * Keeping the markup in one place lets us:
 *   1. centralize Google's brand-style spec (white background, full-color
 *      "G" mark, neutral border) so every future page that surfaces the
 *      button looks identical,
 *   2. expose a single {@link googleSigninClick} output so the parent
 *      (currently {@code LoginComponent}) can stay agnostic about how the
 *      token is actually obtained, and
 *   3. own the {@code loading} flag locally without leaking it through
 *      `AuthStore` (which carries error/last-message, not UI progress).
 *
 * <h3>Why we do NOT embed the GSI library markup directly here</h3>
 * The actual OAuth popup is opened by {@code SocialAuthService} (provided
 * via {@code provideSocialAuthServiceConfig} in {@code core.providers.ts}).
 * This component only emits a signal; the wiring lives in
 * {@code LoginComponent} so the auth feature owns the side effects and we
 * stay consistent with the rest of the form.
 *
 * <h3>A11y</h3>
 * The button carries {@code type="button"} so it cannot accidentally
 * submit the parent form. We expose the same disabled state via
 * {@code aria-busy} so screen readers announce progress.
 */
@Component({
  selector: 'app-google-signin-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpinnerComponent],
  template: `
    <button
      type="button"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-label]="ariaLabel()"
      (click)="onClick()"
      class="group relative flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-content shadow-sm transition-all hover:bg-surface-muted hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-border dark:bg-surface dark:hover:bg-surface-muted"
    >
      <!--
        Google "G" mark. Inlined (not <app-icon>) because the IconComponent
        renders stroke="currentColor" + fill="none" which would erase the
        brand colors. The brand-guidelines SVG is small enough that
        duplicating it here costs nothing and avoids tweaking the global
        IconComponent contract for one filled icon.
      -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        class="shrink-0"
      >
        <path
          fill="#4285F4"
          d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-2 3.018v2.51h3.232c1.892-1.741 2.986-4.305 2.986-7.351z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.964-.895 6.614-2.422l-3.232-2.51c-.895.6-2.04.955-3.382.955-2.604 0-4.81-1.76-5.595-4.122H3.06v2.59A9.997 9.997 0 0 0 12 22z"
        />
        <path
          fill="#FBBC05"
          d="M6.405 13.9c-.2-.6-.314-1.24-.314-1.9s.114-1.3.314-1.9V7.51H3.06A9.97 9.97 0 0 0 2 12c0 1.614.386 3.14 1.06 4.49l3.345-2.59z"
        />
        <path
          fill="#EA4335"
          d="M12 5.977c1.468 0 2.786.505 3.823 1.495l2.868-2.868C16.96 2.99 14.695 2 12 2 8.118 2 4.755 4.222 3.06 7.51l3.345 2.59C7.19 7.737 9.396 5.977 12 5.977z"
        />
      </svg>

      @if (loading()) {
        <app-spinner [size]="16" label="Conectando con Google…" />
        <span>Conectando…</span>
      } @else {
        <span>{{ label() }}</span>
      }
    </button>
  `,
})
export class GoogleSigninButtonComponent {
  /** Optional CTA copy. Defaults to the canonical Google phrasing in Spanish. */
  readonly label = input<string>('Continuar con Google');

  /** Lock the button while a higher-priority form is busy. */
  readonly disabled = input<boolean>(false);

  /** Internal busy flag — emitted state from the parent doesn't need to re-enter. */
  readonly loading = input<boolean>(false);

  /** Emits when the user clicks. The parent fires {@code SocialAuthService.signIn}. */
  @Output() readonly googleSigninClick = new EventEmitter<void>();

  /** Friendly a11y label that hints at the action. */
  readonly ariaLabel = computed(
    () => `Iniciar sesión con Google${this.loading() ? ', procesando' : ''}`,
  );

  onClick(): void {
    if (this.disabled() || this.loading()) return;
    this.googleSigninClick.emit();
  }
}

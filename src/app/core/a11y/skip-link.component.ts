import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Skip-to-main-content link (cierre-D / a11y WCAG 2.4.1).
 *
 * <p>Hidden visually until focused, then visible at the top-left
 * of the viewport. Lets keyboard-only users bypass the sidebar /
 * navbar and jump directly to the main content.</p>
 *
 * <h3>Visual style</h3>
 * The element is positioned absolute with a negative top offset
 * (-translate-y-full) when not focused. On focus, transform
 * snaps to translate-y-0 and the link becomes visible with a
 * focus ring. The CSS lives in {@code styles.scss} so the
 * skip-link doesn't have to know about the design system.</p>
 */
@Component({
	selector: 'app-skip-link',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<a
			class="skip-link"
			[href]="mainContentId"
			(click)="onClick($event)"
			data-testid="skip-link"
		>
			Saltar al contenido principal
		</a>
	`,
	styles: [
		`
			:host { display: contents; }
			.skip-link {
				position: fixed;
				left: 1rem;
				top: 1rem;
				z-index: 100;
				padding: 0.75rem 1rem;
				background: #4f46e5;
				color: #ffffff;
				font-weight: 600;
				font-size: 0.875rem;
				border-radius: 0.5rem;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				transform: translateY(-200%);
				transition: transform 150ms ease;
			}
			.skip-link:focus,
			.skip-link:focus-visible {
				transform: translateY(0);
				outline: 2px solid #ffffff;
				outline-offset: 2px;
			}
		`,
	],
})
export class SkipLinkComponent {
	private readonly document = inject(DOCUMENT);

	/** ID of the main-content landmark the link jumps to. */
	readonly mainContentId = '#main-content';

	/**
	 * Move keyboard focus to the target element after the anchor
	 * navigation. Native browsers only move the URL hash on click
	 * — we also need to focus the target for screen readers /
	 * keyboard users to land inside the main region.
	 */
	onClick(event: Event): void {
		const target = this.document.querySelector(this.mainContentId) as HTMLElement | null;
		if (target) {
			event.preventDefault();
			target.setAttribute('tabindex', '-1');
			target.focus({ preventScroll: false });
			target.scrollIntoView({ block: 'start' });
		}
	}
}
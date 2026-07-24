import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS, IconName } from './icons.registry';

/**
 * Renders an icon from the inline SVG registry.
 *
 * <h3>Accessibility (WCAG)</h3>
 * <p>By default the icon is {@code aria-hidden="true"} (decorative) so
 * screen readers skip it. Set {@link #label} to a non-empty string when
 * the icon carries semantic meaning on its own (e.g. an icon-only
 * button); the host then exposes the label and drops the
 * {@code aria-hidden} attribute.</p>
 *
 * <h3>Why not external libs (heroicons/lucide-angular)</h3>
 * <ul>
 *   <li>Zero runtime + zero extra deps.</li>
 *   <li>One component reaches every SVG; tree-shaking happens at the
 *       IconComponent boundary (no consumer → no icons ship).</li>
 * </ul>
 *
 * <p>Colors via {@code currentColor}, sizing via the {@link #size} input.
 * Use as: <code><app-icon name="users" [size]="20" /></code></p>
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'inline-flex',
    '[attr.aria-hidden]': 'label() ? null : "true"',
    '[attr.aria-label]': 'label() || null',
    '[attr.role]': 'label() ? "img" : null',
  },
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      [innerHTML]="content()"
    ></svg>
  `,
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.75);
  /**
   * Non-empty value promotes the icon from {@code aria-hidden="true"}
   * to {@code role="img" aria-label="..."}. Use for icon-only buttons
   * / standalone glyphs that carry meaning on their own.
   */
  readonly label = input<string>('');

  readonly content = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''),
  );
}

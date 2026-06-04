import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS, IconName } from './icons.registry';

/**
 * Renders an icon from the inline SVG registry.
 *
 * Why not external libs (heroicons/lucide-angular):
 *   - Zero runtime + zero extra deps.
 *   - One component reaches every SVG; tree-shaking happens at the IconComponent
 *     boundary (if no consumer imports it, none of the icons ship).
 *
 * Colors via `currentColor`, sizing via the `size` input. Use as:
 *   <app-icon name="users" [size]="20" />
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', 'class': 'inline-flex' },
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
  `
})
export class IconComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly strokeWidth = input(1.75);

  readonly content = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? '')
  );
}

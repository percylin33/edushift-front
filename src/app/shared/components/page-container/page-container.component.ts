import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type PageContainerSize = 'narrow' | 'default' | 'wide' | 'full';

/**
 * Consistent horizontal padding + max-width for every routed page.
 *
 * Replaces the ad-hoc `<div class="page">` usage with a typed component so
 * size variants stay explicit and we can change the breakpoints in one place.
 *
 *   <app-page-container size="default">
 *     <app-page-header ... />
 *     <main>…</main>
 *   </app-page-container>
 *
 * Sizes:
 *   - `narrow`  → max-w-2xl  · forms, single-column flows
 *   - `default` → max-w-7xl  · standard pages
 *   - `wide`    → max-w-screen-2xl · data-heavy dashboards
 *   - `full`    → no max-width · edge-to-edge content (data tables, canvases)
 */
@Component({
  selector: 'app-page-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' },
  template: `
    <div [class]="containerClass()">
      <ng-content />
    </div>
  `,
})
export class PageContainerComponent {
  readonly size = input<PageContainerSize>('default');

  readonly containerClass = computed(() => {
    const base = 'mx-auto w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8';
    switch (this.size()) {
      case 'narrow':
        return `${base} max-w-2xl`;
      case 'wide':
        return `${base} max-w-screen-2xl`;
      case 'full':
        return `${base.replace('mx-auto ', '')} max-w-none`;
      default:
        return `${base} max-w-7xl`;
    }
  });
}

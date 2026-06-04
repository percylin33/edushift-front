import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Page header used by every feature page. Three composable slots:
 *
 *   - `eyebrow`  (optional) → small label above the title (status, count, …)
 *   - default            → primary actions on the right (use buttons)
 *   - `secondary`            → bottom row, full width (tabs / filters)
 *
 * Mobile-first layout:
 *   - on small viewports the title and actions stack vertically with a gap
 *   - from `sm` upwards they sit on one row with title left, actions right
 *   - the secondary row always lives below the main row, full bleed
 *
 *   <app-page-header title="Estudiantes" subtitle="Listado activo">
 *     <button class="btn btn-primary">Nuevo</button>
 *     <ng-container secondary>
 *       <app-tabs ... />
 *     </ng-container>
 *   </app-page-header>
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-6 space-y-4 border-b border-border-subtle pb-4 sm:mb-8 sm:pb-6">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          @if (eyebrow(); as e) {
            <p class="mb-1 text-2xs font-semibold uppercase tracking-wider text-content-subtle">
              {{ e }}
            </p>
          }
          <h1 class="truncate text-2xl font-semibold tracking-tight text-content sm:text-3xl">
            {{ title() }}
          </h1>
          @if (subtitle(); as s) {
            <p class="mt-1 text-sm text-content-muted">{{ s }}</p>
          }
        </div>

        <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
          <ng-content />
        </div>
      </div>

      <div class="empty:hidden">
        <ng-content select="[secondary]" />
      </div>
    </header>
  `
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
}

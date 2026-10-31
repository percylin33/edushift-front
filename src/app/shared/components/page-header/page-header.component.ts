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
 *   - from `sm` upwards the actions sit on the title row, vertically
 *     centered with the title. The subtitle stays below that row.
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
      <div class="space-y-1">
        @if (eyebrow(); as e) {
          <p class="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {{ e }}
          </p>
        }
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 class="min-w-0 truncate text-2xl font-semibold tracking-tight text-content sm:text-3xl">
            {{ title() }}
          </h1>
          <div class="flex flex-wrap items-center justify-end gap-2 sm:shrink-0 sm:flex-nowrap">
            <ng-content />
          </div>
        </div>
        @if (subtitle(); as s) {
          <p class="text-sm text-content-muted">{{ s }}</p>
        }
      </div>

      <div class="empty:hidden">
        <ng-content select="[secondary]" />
      </div>
    </header>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
}

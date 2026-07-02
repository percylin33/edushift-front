import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '@shared/components/icon';

export type StatTrend = 'up' | 'down' | 'flat';

/**
 * Metric card for dashboards / overview pages.
 *
 * Always renders a colored icon chip + label + big value, plus an optional
 * delta with trend coloring. Sizes adapt naturally — the component does not
 * declare a width; place inside a responsive grid:
 *
 *   <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
 *     <app-stat-card label="Alumnos" value="1,284" icon="users" trend="up" delta="+12 esta semana" />
 *   </div>
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <article class="card transition-shadow hover:shadow-soft" [attr.aria-label]="label()">
      <div class="card-body flex items-start gap-4">
        @if (icon(); as i) {
          <span
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-300"
          >
            <app-icon [name]="i" [size]="20" />
          </span>
        }
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-content-muted">{{ label() }}</p>
          <p class="mt-1 text-2xl font-semibold tracking-tight text-content sm:text-3xl">
            {{ value() }}
          </p>
          @if (delta(); as d) {
            <p class="mt-2 inline-flex items-center gap-1 text-xs" [class]="deltaClass()">
              @if (trend() === 'up') {
                <span aria-hidden="true">▲</span>
              } @else if (trend() === 'down') {
                <span aria-hidden="true">▼</span>
              }
              <span>{{ d }}</span>
            </p>
          }
        </div>
      </div>
    </article>
  `,
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input<IconName | null>(null);
  readonly delta = input<string | null>(null);
  readonly trend = input<StatTrend>('flat');

  readonly deltaClass = computed(() => {
    switch (this.trend()) {
      case 'up':
        return 'text-success';
      case 'down':
        return 'text-danger';
      default:
        return 'text-content-subtle';
    }
  });
}

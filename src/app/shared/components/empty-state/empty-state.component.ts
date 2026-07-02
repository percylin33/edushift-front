import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from '@shared/components/icon';

/**
 * Friendly empty state for lists, search results, and unfinished features.
 * Drop-in inside any container; sizing comes from the parent.
 *
 *   <app-empty-state
 *     icon="users"
 *     title="Aún no hay estudiantes"
 *     description="Empieza creando el primero o impórtalos desde un CSV.">
 *     <button class="btn btn-primary">Nuevo estudiante</button>
 *   </app-empty-state>
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
      @if (icon(); as i) {
        <div
          class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-content-subtle"
        >
          <app-icon [name]="i" [size]="28" [strokeWidth]="1.5" />
        </div>
      }
      <h3 class="text-base font-semibold text-content">{{ title() }}</h3>
      @if (description(); as d) {
        <p class="mt-1 max-w-md text-sm text-content-muted">{{ d }}</p>
      }
      <div class="mt-5 flex flex-wrap items-center justify-center gap-2 empty:hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly icon = input<IconName | null>(null);
}

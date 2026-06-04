import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components';
import { BreadcrumbService } from '../../services';

/**
 * Renders the breadcrumb trail driven by `BreadcrumbService`. Returns
 * a single visually-hidden "Inicio" entry when the trail is empty so the
 * landmark still announces itself to screen readers.
 */
@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, IconComponent],
  template: `
    <nav aria-label="Ruta de navegación" class="flex items-center text-sm text-content-muted">
      <ol class="flex items-center gap-1.5">
        @for (crumb of crumbs(); track $index; let last = $last) {
          <li class="flex items-center gap-1.5">
            @if (crumb.url) {
              <a
                [routerLink]="crumb.url"
                class="hover:text-content focus-visible:outline-none focus-visible:underline"
              >
                {{ crumb.label }}
              </a>
            } @else {
              <span class="font-medium text-content" aria-current="page">{{ crumb.label }}</span>
            }
            @if (!last) {
              <app-icon name="chevron-right" [size]="14" class="text-content-subtle" />
            }
          </li>
        }
      </ol>
    </nav>
  `
})
export class BreadcrumbsComponent {
  private readonly breadcrumbs = inject(BreadcrumbService);
  readonly crumbs = this.breadcrumbs.breadcrumbs;
}

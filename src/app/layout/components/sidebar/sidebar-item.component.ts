import { NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { IconComponent } from '@shared/components';
import { NavigationItem } from '../../models';

/**
 * Single sidebar entry.
 *
 * Three rendering modes resolved at runtime from props:
 *   - leaf            → just a router link
 *   - group (expand)  → button that toggles child list inline; route still
 *                       active-tracked via descendant URL match
 *   - collapsed mode  → icon-only; children never render (the user reopens the
 *                       sidebar to drill in). Tooltip preserves the label.
 *
 * Children automatically expand when the current URL matches one of them, so
 * the user always sees their position without manual interaction.
 */
@Component({
  selector: 'app-sidebar-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, IconComponent, NgClass],
  template: `
    @if (hasChildren() && !collapsed()) {
      <button
        type="button"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="panelId"
        (click)="toggle()"
        class="group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-content-muted transition-colors hover:bg-surface-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
        [ngClass]="{ 'text-content': anyChildActive() }"
      >
        @if (item().icon; as icon) {
          <app-icon [name]="icon" [size]="20" class="shrink-0" />
        }
        <span class="flex-1 truncate text-left">{{ item().label }}</span>
        @if (item().badge; as badge) {
          <span class="badge badge-primary text-2xs">{{ badge }}</span>
        }
        <app-icon
          [name]="open() ? 'chevron-down' : 'chevron-right'"
          [size]="14"
          class="text-content-subtle transition-transform"
        />
      </button>

      @if (open()) {
        <ul [id]="panelId" class="ml-3 mt-1 space-y-0.5 border-l border-border-subtle pl-3">
          @for (child of item().children; track child.id) {
            <li>
              <a
                [routerLink]="child.route"
                routerLinkActive="is-active-child"
                [routerLinkActiveOptions]="{ exact: child.exactMatch ?? false }"
                #childActive="routerLinkActive"
                [attr.aria-current]="childActive.isActive ? 'page' : null"
                (click)="navigated.emit()"
                class="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-content-muted transition-colors hover:bg-surface-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
                [ngClass]="{
                  'bg-primary-500/10 font-medium text-primary-700 dark:text-primary-300':
                    childActive.isActive,
                }"
              >
                <span class="truncate">{{ child.label }}</span>
                @if (child.badge; as badge) {
                  <span class="badge badge-primary ml-auto text-2xs">{{ badge }}</span>
                }
              </a>
            </li>
          }
        </ul>
      }
    } @else {
      <a
        [routerLink]="item().route"
        routerLinkActive
        #rla="routerLinkActive"
        [routerLinkActiveOptions]="{ exact: item().exactMatch ?? false }"
        [attr.title]="collapsed() ? item().label : null"
        [attr.aria-current]="rla.isActive ? 'page' : null"
        (click)="navigated.emit()"
        class="group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm text-content-muted transition-colors hover:bg-surface-muted hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
        [ngClass]="{
          'bg-primary-500/10 text-primary-700 dark:text-primary-300': rla.isActive,
          'justify-center px-2': collapsed(),
        }"
      >
        @if (rla.isActive) {
          <span
            class="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-primary-600"
            aria-hidden="true"
          ></span>
        }
        @if (item().icon; as icon) {
          <app-icon [name]="icon" [size]="20" class="shrink-0" />
        }
        @if (!collapsed()) {
          <span class="flex-1 truncate">{{ item().label }}</span>
          @if (item().badge; as badge) {
            <span class="badge badge-primary text-2xs">{{ badge }}</span>
          }
        }
      </a>
    }
  `,
})
export class SidebarItemComponent {
  private readonly router = inject(Router);

  readonly item = input.required<NavigationItem>();
  readonly collapsed = input<boolean>(false);
  readonly navigated = output<void>();

  readonly hasChildren = computed(() => (this.item().children?.length ?? 0) > 0);

  /** Current URL stream as a signal — drives auto-expand for active subtree. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => (e as NavigationEnd).urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly anyChildActive = computed(() => {
    const url = this.currentUrl();
    return (
      this.item().children?.some(
        (c) => !!c.route && (url === c.route || url.startsWith(c.route + '/')),
      ) ?? false
    );
  });

  private readonly _open = signal(false);
  readonly open = this._open.asReadonly();

  readonly panelId = `sidebar-group-${Math.random().toString(36).slice(2, 9)}`;

  constructor() {
    /* Auto-expand when navigation lands inside the group. We do NOT auto-close
     * the user has manually toggled it. */
    effect(
      () => {
        if (this.anyChildActive()) this._open.set(true);
      },
      { allowSignalWrites: true },
    );
  }

  toggle(): void {
    this._open.update((v) => !v);
  }
}

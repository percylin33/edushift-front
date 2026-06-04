import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { Breadcrumb } from '../models';

/**
 * Builds the breadcrumb trail by walking the router state tree and pulling
 * `data.breadcrumb` from each segment.
 *
 * Add `data: { breadcrumb: '...' }` to route configs to make them participate;
 * routes without that key are skipped (and therefore invisible).
 *
 * The leaf breadcrumb has `url: null` because it represents the current page.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly router = inject(Router);

  readonly breadcrumbs = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.build(this.router.routerState.snapshot.root))
    ),
    { initialValue: [] as Breadcrumb[] }
  );

  private build(root: ActivatedRouteSnapshot): Breadcrumb[] {
    const trail: Breadcrumb[] = [];
    const segments: string[] = [];
    let route: ActivatedRouteSnapshot | null = root;

    while (route) {
      if (route.url.length > 0) {
        segments.push(...route.url.map((seg) => seg.path));
      }
      const label = route.data?.['breadcrumb'] as string | undefined;
      if (label) {
        trail.push({ label, url: '/' + segments.join('/') });
      }
      route = route.firstChild;
    }

    if (trail.length > 0) {
      trail[trail.length - 1] = { ...trail[trail.length - 1], url: null };
    }
    return trail;
  }
}

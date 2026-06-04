import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { APP } from '@core/constants';

/**
 * Drives `document.title` from route data.
 *
 * Resolution order:
 *   1. `route.title`             — explicit Angular Router title (highest priority).
 *   2. `route.data.title`        — convention used across feature route files.
 *   3. Deepest `data.breadcrumb` — falls back to the breadcrumb label.
 *
 * Final format: `<page> · EduShift`. When no candidate is found we keep just
 * the app name so the user never sees the bare `localhost:4200`.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const explicit = this.buildTitle(snapshot);
    const page = explicit ?? this.findDeepestData(snapshot.root, 'breadcrumb');

    this.title.setTitle(page ? `${page} · ${APP.NAME}` : APP.NAME);
  }

  private findDeepestData(route: ActivatedRouteSnapshot, key: string): string | null {
    let current: ActivatedRouteSnapshot | null = route;
    let found: string | null = null;
    while (current) {
      const value = current.data?.[key];
      if (typeof value === 'string' && value.length > 0) found = value;
      current = current.firstChild;
    }
    return found;
  }
}

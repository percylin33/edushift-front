import { Injectable, computed, inject } from '@angular/core';
import { environment } from '@env/environment';
import { AuthService, TenantService } from '@core/services';
import { FeatureKey } from '@core/enums';
import { NAVIGATION_GROUPS } from '../config';
import { NavigationGroup, NavigationItem } from '../models';

/**
 * Builds the visible navigation tree by filtering `NAVIGATION_GROUPS` against
 * four orthogonal predicates (all must pass):
 *
 *   1. `feature`        → enabled in `environment.features` (build-time flag).
 *   2. `feature` again  → present in `tenant.enabledFeatures` if the tenant
 *                         declares an explicit allowlist (plan / entitlement).
 *   3. `roles`          → user has at least one of the listed roles.
 *   4. `permissions`    → user has at least one of the listed permissions.
 *
 * Empty groups (no visible items) are pruned. Children are filtered recursively
 * and an item with all its children hidden falls back to its own visibility.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);

  readonly groups = computed<NavigationGroup[]>(() => {
    /* Read every reactive source upfront so re-evaluation tracks them all. */
    this.auth.user();
    this.tenant.tenant();

    return NAVIGATION_GROUPS
      .map((group) => ({
        ...group,
        items: this.filterItems([...group.items])
      }))
      .filter((group) => group.items.length > 0);
  });

  isVisible(item: NavigationItem): boolean {
    if (item.feature) {
      if (!this.envEnables(item.feature)) return false;
      if (!this.tenantEnables(item.feature)) return false;
    }
    if (item.roles?.length && !this.auth.hasRole(...item.roles)) return false;
    if (item.permissions?.length && !this.auth.hasPermission(...item.permissions)) return false;
    return true;
  }

  private envEnables(feature: FeatureKey): boolean {
    const flags = environment.features as Record<string, boolean>;
    return flags[feature] ?? false;
  }

  /** Undefined / empty allowlist on the tenant means "everything env says yes". */
  private tenantEnables(feature: FeatureKey): boolean {
    const allowlist = this.tenant.tenant()?.enabledFeatures;
    if (!allowlist || allowlist.length === 0) return true;
    return allowlist.includes(feature);
  }

  private filterItems(items: NavigationItem[]): NavigationItem[] {
    return items
      .filter((item) => this.isVisible(item))
      .map((item) => {
        if (!item.children?.length) return item;
        const children = this.filterItems(item.children);
        /* If every child was filtered out we still keep the parent (it has its
         * own route). The empty children array would render no chevron. */
        return { ...item, children: children.length > 0 ? children : undefined };
      });
  }
}

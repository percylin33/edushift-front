import { FeatureKey, Permission, UserRole } from '@core/enums';
import { IconName } from '@shared/components';

/**
 * Declarative navigation node. Visibility is decided by `NavigationService`
 * based on the combination of `feature` / `roles` / `permissions`.
 * If all three are omitted the item is always visible to authenticated users.
 */
export interface NavigationItem {
  id: string;
  label: string;
  icon?: IconName;
  route?: string;
  external?: boolean;
  exactMatch?: boolean;
  badge?: string;
  children?: NavigationItem[];

  feature?: FeatureKey;
  roles?: UserRole[];
  permissions?: Permission[];
}

/** Sidebar groups separate items with an optional section header. */
export interface NavigationGroup {
  id: string;
  label?: string;
  items: NavigationItem[];
}

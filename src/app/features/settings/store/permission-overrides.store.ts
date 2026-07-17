import { Injectable, computed, inject, signal } from '@angular/core';
import { UserRole } from '@core/enums';
import {
  RolePermissionOverrideResponse,
  UpsertPermissionOverrideRequest,
} from '../models/permission-override.model';
import { PermissionOverridesService } from '../services/permission-overrides.service';

/**
 * D1 / F0.5 — Signal-driven store for the permission-override matrix.
 *
 * <p>The list shape from the BE is a flat array of triples. The store
 * materialises a lookup-friendly {@code Map<UserRole, Map<authority,
 * override>>} so the page can render directly from a signal without
 * any client-side filtering.</p>
 */
@Injectable({ providedIn: 'root' })
export class PermissionOverridesStore {
  private readonly service = inject(PermissionOverridesService);

  // Snapshot of the latest GET /v1/tenants/me/permission-overrides.
  private readonly _rows = signal<RolePermissionOverrideResponse[]>([]);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  /** Increments on every successful PUT so the page can trigger a refresh. */
  private readonly _version = signal<number>(0);

  readonly rows = this._rows.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly version = this._version.asReadonly();

  /** Indexed view: role → authority → override row. */
  readonly indexedByRole = computed(() => {
    const out = new Map<UserRole, Map<string, RolePermissionOverrideResponse>>();
    for (const row of this._rows()) {
      let inner = out.get(row.role);
      if (!inner) {
        inner = new Map();
        out.set(row.role, inner);
      }
      inner.set(row.authority, row);
    }
    return out;
  });

  load(): void {
    this._loading.set(true);
    this._error.set(null);
    this.service.list().subscribe({
      next: (rows) => {
        this._rows.set(rows ?? []);
        this._loading.set(false);
      },
      error: (e) => {
        this._error.set(e?.message ?? 'No se pudo cargar la matriz de permisos.');
        this._loading.set(false);
      },
    });
  }

  toggle(req: UpsertPermissionOverrideRequest): void {
    this.service.upsert(req).subscribe({
      next: () => {
        // The service returns the new state; we re-fetch for simplicity
        // (avoids having to merge). Cheap on a small list.
        this._version.update((v) => v + 1);
        this.load();
      },
      error: (e) =>
        this._error.set(
          e?.message ?? 'No se pudo guardar el cambio. Intenta de nuevo.',
        ),
    });
  }
}

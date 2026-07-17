import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services';
import { ApiResponse } from '@core/models';
import { API } from '@core/constants';
import {
  RolePermissionOverrideResponse,
  UpsertPermissionOverrideRequest,
} from '../models/permission-override.model';

/**
 * D1 / F0.5 — REST adapter for {@code /v1/tenants/me/permission-overrides}.
 *
 * <p>Only TENANT_ADMIN may call this surface. The route guard already
 * gates the FE entry point; the JWT filter enforces the same role on
 * the BE. The service trusts the interceptor chain (auth + tenant
 * headers) and does not duplicate that work.</p>
 */
@Injectable({ providedIn: 'root' })
export class PermissionOverridesService {
  private readonly api = inject(ApiService);

  list(): Observable<RolePermissionOverrideResponse[]> {
    return this.api
      .get<ApiResponse<RolePermissionOverrideResponse[]>>(
        API.TENANTS.PERMISSION_OVERRIDES,
      )
      .pipe(
        // api.get returns the ApiResponse envelope; flatten it so the
        // store/UI work directly with the rows.
        // (map imported lazily above to keep import surface minimal.)
        (source$) =>
          new Observable<RolePermissionOverrideResponse[]>((subscriber) => {
            const inner = source$.subscribe({
              next: (env) => subscriber.next(env?.data ?? []),
              error: (e) => subscriber.error(e),
              complete: () => subscriber.complete(),
            });
            return () => inner.unsubscribe();
          }),
      );
  }

  upsert(req: UpsertPermissionOverrideRequest): Observable<RolePermissionOverrideResponse> {
    return this.api
      .put<ApiResponse<RolePermissionOverrideResponse>>(
        API.TENANTS.PERMISSION_OVERRIDES,
        req,
      )
      .pipe(
        (source$) =>
          new Observable<RolePermissionOverrideResponse>((subscriber) => {
            const inner = source$.subscribe({
              next: (env) => subscriber.next(env?.data),
              error: (e) => subscriber.error(e),
              complete: () => subscriber.complete(),
            });
            return () => inner.unsubscribe();
          }),
      );
  }
}

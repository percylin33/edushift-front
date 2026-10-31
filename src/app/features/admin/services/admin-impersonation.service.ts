import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { API, ROUTES } from '@core/constants';
import { UserRole, UserStatus } from '@core/enums';
import { User } from '@core/models';
import { ApiService, AuthService } from '@core/services';
import { AdminTenantSummary } from '../models';

const STATE_KEY = 'edushift.admin.impersonation';
const ADMIN_USER_KEY = 'edushift.admin.impersonation.original-user';

interface StartImpersonationResponse {
  expiresInSec: number;
  targetUserPublicUuid: string;
  targetUser: {
    publicUuid: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    roles: string[];
    tenantId: string;
    tenantSlug: string;
  };
}

interface ImpersonationState {
  publicUuid: string;
  fullName: string;
  email: string;
  tenantSlug: string;
  reason: string;
}

export interface SupportUserOption {
  publicUuid: string;
  email: string;
  fullName: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminImpersonationService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly active = signal(this.readState());
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  searchTenants(name: string) {
    return this.api.get<{ data: { content: AdminTenantSummary[] } }>(API.ADMIN.TENANTS_ROOT, {
      search: name.trim(), status: 'ACTIVE', page: 0, size: 20,
    });
  }

  searchUsers(tenantUuid: string, search: string) {
    return this.api.get<{ data: { content: SupportUserOption[] } }>(
      API.ADMIN.IMPERSONATE_TENANT_USERS(tenantUuid), { search: search.trim(), page: 0, size: 50 },
    );
  }

  start(targetUserPublicUuid: string, reason: string): void {
    const targetUuid = targetUserPublicUuid.trim();
    const trimmedReason = reason.trim();
    if (!targetUuid || !trimmedReason || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const adminUser = this.auth.user();
    if (adminUser) sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminUser));
    this.api.post<{ data: StartImpersonationResponse }>(API.ADMIN.IMPERSONATE, {
      targetUserPublicUuid: targetUuid,
      reason: trimmedReason,
    }).subscribe({
      next: (response) => {
        const target = response.data.targetUser;
        const targetUser: User = {
          publicUuid: target.publicUuid,
          email: target.email,
          fullName: target.fullName,
          firstName: target.firstName,
          lastName: target.lastName,
          status: UserStatus.Active,
          roles: target.roles as UserRole[],
          tenantId: target.tenantId,
        };
        const state = { publicUuid: target.publicUuid, fullName: target.fullName, email: target.email, tenantSlug: target.tenantSlug, reason: trimmedReason };
        sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
        this.active.set(state);
        this.auth.setUser(targetUser);
        this.busy.set(false);
        void this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        sessionStorage.removeItem(ADMIN_USER_KEY);
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo iniciar la impersonación.');
      },
    });
  }

  stop(): void {
    const state = this.active();
    if (!state || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.post<void>(API.ADMIN.IMPERSONATE_STOP, {
      targetUserPublicUuid: state.publicUuid,
      reason: `Fin de soporte: ${state.reason}`,
    }).subscribe({
      next: () => {
        const rawUser = sessionStorage.getItem(ADMIN_USER_KEY);
        if (rawUser) {
          try { this.auth.setUser(JSON.parse(rawUser) as User); } catch { this.auth.clearSession(); }
        } else {
          this.auth.clearSession();
        }
        sessionStorage.removeItem(ADMIN_USER_KEY);
        sessionStorage.removeItem(STATE_KEY);
        this.active.set(null);
        this.busy.set(false);
        void this.router.navigateByUrl(ROUTES.ADMIN.DASHBOARD);
      },
      error: (err) => {
        this.busy.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo cerrar la impersonación.');
      },
    });
  }

  private readState(): ImpersonationState | null {
    try {
      const raw = sessionStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) as ImpersonationState : null;
    } catch {
      return null;
    }
  }
}

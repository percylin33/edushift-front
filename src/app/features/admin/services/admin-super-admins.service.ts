import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';

export interface SuperAdminAccount {
  publicUuid: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminSuperAdminsService {
  private readonly api = inject(ApiService);
  readonly accounts = signal<SuperAdminAccount[]>([]);
  readonly activeCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<{ data: SuperAdminAccount[] }>(API.ADMIN.SUPER_ADMINS).subscribe({
      next: (response) => { this.accounts.set(response.data ?? []); this.loading.set(false); },
      error: (err) => { this.error.set(err?.error?.message ?? 'No se pudieron cargar las cuentas.'); this.loading.set(false); },
    });
    this.api.get<{ data: number }>(API.ADMIN.SUPER_ADMINS_COUNT).subscribe({
      next: (response) => this.activeCount.set(response.data ?? 0),
    });
  }

  create(request: { email: string; firstName: string; lastName: string }): void {
    this.error.set(null);
    this.api.post<{ data: SuperAdminAccount }, typeof request>(API.ADMIN.SUPER_ADMINS, request).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.message ?? 'No se pudo crear la cuenta.'),
    });
  }

  disable(uuid: string): void {
    this.error.set(null);
    this.api.patch<{ data: SuperAdminAccount }>(API.ADMIN.SUPER_ADMIN_DISABLE(uuid), {}).subscribe({
      next: () => this.load(),
      error: (err) => this.error.set(err?.error?.message ?? 'No se pudo desactivar la cuenta.'),
    });
  }
}

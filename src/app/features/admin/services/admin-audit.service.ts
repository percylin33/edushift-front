import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import { AdminAuditEvent, AdminAuditPage } from '../models/audit.models';

@Injectable({ providedIn: 'root' })
export class AdminAuditService {
  private readonly api = inject(ApiService);
  readonly events = signal<AdminAuditEvent[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);

  load(params: { tenantId?: string; actorId?: string; tenantSearch?: string; actorSearch?: string; action?: string; from?: string; to?: string; page: number }): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.get<{ data: AdminAuditPage }>(API.ADMIN.AUDIT_ROOT, { ...params, size: 50 }).subscribe({
      next: (response) => {
        const page = response.data;
        this.events.set(page.content ?? []);
        this.totalElements.set(page.totalElements ?? 0);
        this.totalPages.set(page.totalPages ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'No se pudo cargar la auditoría.');
        this.loading.set(false);
      },
    });
  }
}

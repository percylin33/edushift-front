import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '@core/services/api.service';
import { API } from '@core/constants';
import { firstValueFrom } from 'rxjs';

type UUID = string;

export interface ClaimSummary {
  id: UUID;
  claimCode: string;
  consumerName: string;
  claimType: 'RECLAMO' | 'QUEJA';
  status: 'PENDING' | 'IN_PROCESS' | 'ATTENDED';
  dueDate: string;
  createdAt: string;
  isMinor?: boolean;
  respondedAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClaimsAdminState {
  readonly claims = signal<ClaimSummary[]>([]);
  readonly totalElements = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly currentPage = signal(0);
  readonly pageSize = signal(20);
}

@Injectable({ providedIn: 'root' })
export class AdminClaimsService {
  private readonly api = inject(ApiService);
  private readonly state = inject(ClaimsAdminState);

  /**
   * Cargar lista de reclamos con paginación y filtros opcionales.
   * GET /v1/admin/claims?status=&page=&size=
   */
  async loadClaims(params: {
    status?: 'PENDING' | 'IN_PROCESS' | 'ATTENDED';
    page?: number;
    size?: number;
  } = {}): Promise<void> {
    this.state.loading.set(true);
    this.state.errorMessage.set(null);

    const page = params.page ?? this.state.currentPage();
    const size = params.size ?? this.state.pageSize();

    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('size', String(size));
    if (params.status) {
      query.set('status', params.status);
    }

    const url = `${API.CLAIMS.ROOT}?${query.toString()}`;

    try {
      const response = await firstValueFrom(this.api.get<any>(url));
      const data = response.data ?? response;

      if (data && Array.isArray(data.content)) {
        this.state.claims.set(data.content);
      } else {
        this.state.claims.set(data ?? []);
      }

      this.state.totalElements.set(data.totalElements ?? data.length ?? 0);
      this.state.totalPages.set(data.totalPages ?? 1);
      this.state.currentPage.set(page);
      this.state.loading.set(false);
    } catch (err: any) {
      this.state.errorMessage.set(err?.error?.message ?? 'Error al cargar los reclamos');
      this.state.loading.set(false);
    }
  }

  /**
   * Responder a un reclamo.
   * POST /v1/admin/claims/{uuid}/respond
   */
  async respondClaim(claimId: UUID, responseText: string): Promise<ClaimSummary> {
    this.state.loading.set(true);
    this.state.errorMessage.set(null);

    const url = `${API.CLAIMS.RESPOND(String(claimId))}`;

    try {
      const response = await firstValueFrom(
        this.api.post<{ success: boolean; data: ClaimSummary }>(url, {
          responseText,
        })
      );

      // Optimistic update: refresh the claim in the list
      const updatedClaim = response.data;
      this.state.claims.update((claims) =>
        claims.map((c) => (c.id === updatedClaim.id ? updatedClaim : c))
      );

      this.state.loading.set(false);
      return updatedClaim;
    } catch (err: any) {
      this.state.errorMessage.set(err?.error?.message ?? 'Error al responder el reclamo');
      this.state.loading.set(false);
      throw err;
    }
  }

  /**
   * Obtener un reclamo por su ID (para modo detalle/edición).
   */
  async getClaimById(claimId: UUID): Promise<ClaimSummary | null> {
    const url = `${API.CLAIMS.RESPOND(String(claimId))}`.replace('/respond', '');

    try {
      const response = await firstValueFrom(this.api.get<any>(url));
      const data = response.data ?? response;
      return data ? { ...data, id: data.id as UUID } : null;
    } catch {
      return null;
    }
  }
}
import { HttpClient, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, switchMap, tap } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import {
  AdminTenantDetail,
  AdminTenantSummary,
  TenantFilterParams,
} from '../models';

export interface TenantOverview {
  activeTenants: number;
  activeStudents: number;
  mrr: number;
  overdue: number;
  collectionRate: number;
  lastUpdated: string | null;
}

export type PrepPackageVariant = 'PILOT' | 'PRODUCTION';

@Injectable({ providedIn: 'root' })
export class AdminTenantsService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private tenantRequestSequence = 0;

  private readonly _tenants = signal<AdminTenantSummary[]>([]);
  private readonly _totalElements = signal(0);
  private readonly _totalPages = signal(0);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _selectedTenant = signal<AdminTenantDetail | null>(null);
  private readonly _overview = signal<TenantOverview | null>(null);
  private readonly _overviewLoading = signal(false);
  private readonly _overviewError = signal<string | null>(null);

  readonly tenants = this._tenants.asReadonly();
  readonly totalElements = this._totalElements.asReadonly();
  readonly totalPages = this._totalPages.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly selectedTenant = this._selectedTenant.asReadonly();
  readonly overview = this._overview.asReadonly();
  readonly overviewLoading = this._overviewLoading.asReadonly();
  readonly overviewError = this._overviewError.asReadonly();

  loadOverview(): void {
    this._overviewLoading.set(true);
    this._overviewError.set(null);
    this.api.get<any>(API.ADMIN.KPIS).subscribe({
      next: (res) => {
        const data = res.data ?? res;
        this._overview.set({
          activeTenants: Number(data.activeTenants ?? 0),
          activeStudents: Number(data.activeStudents ?? 0),
          mrr: Number(data.mrrCents ?? 0) / 100,
          overdue: Number(data.overdueCents ?? 0) / 100,
          collectionRate: Number(data.collectionRate ?? 0),
          lastUpdated: data.lastUpdated ?? null,
        });
        this._overviewLoading.set(false);
      },
      error: (err) => {
        this._overviewError.set(err?.error?.message ?? 'No se pudieron cargar los indicadores.');
        this._overviewLoading.set(false);
      },
    });
  }

  loadTenants(params: TenantFilterParams = {}): void {
    const requestSequence = ++this.tenantRequestSequence;
    this._loading.set(true);
    this._error.set(null);
    const query: Record<string, string | number> = {};
    if (params.search) query['search'] = params.search;
    if (params.plan) query['plan'] = params.plan;
    if (params.status) query['status'] = params.status;
    if (params.sort) query['sort'] = params.sort;
    query['page'] = params.page ?? 0;
    query['size'] = params.size ?? 10;

    this.api.get<any>(API.ADMIN.TENANTS_ROOT, query).subscribe({
      next: (res) => {
        if (requestSequence !== this.tenantRequestSequence) return;
        const data = res.data ?? res;
        this._tenants.set(data.content ?? data);
        this._totalElements.set(data.totalElements ?? 0);
        this._totalPages.set(data.totalPages ?? 0);
        this._loading.set(false);
      },
      error: (err) => {
        if (requestSequence !== this.tenantRequestSequence) return;
        this._error.set(err?.error?.message ?? 'Error al cargar instituciones');
        this._loading.set(false);
      },
    });
  }

  loadTenantDetail(uuid: string): void {
    this._loading.set(true);
    this._error.set(null);
    this.api.get<any>(API.ADMIN.TENANTS_BY_ID(uuid)).subscribe({
      next: (res) => {
        this._selectedTenant.set(res.data ?? res);
        this._loading.set(false);
      },
      error: (err) => {
        this._error.set(err?.error?.message ?? 'Error al cargar detalle');
        this._loading.set(false);
      },
    });
  }

  suspendTenant(uuid: string, reason: string): Observable<void> {
    return this.api.post<void>(API.ADMIN.TENANTS_SUSPEND(uuid), { reason }).pipe(
      tap(() => this.loadTenantDetail(uuid)),
    );
  }

  reactivateTenant(uuid: string): Observable<void> {
    return this.api.post<void>(API.ADMIN.TENANTS_REACTIVATE(uuid), {}).pipe(
      tap(() => this.loadTenantDetail(uuid)),
    );
  }

  assignPlan(tenantUuid: string, planUuid: string): Observable<void> {
    return this.api.post<void>(API.ADMIN.ASSIGN_SUBSCRIPTION(tenantUuid), {
      planId: planUuid,
    }).pipe(tap(() => this.loadTenantDetail(tenantUuid)));
  }

  inviteSchool(email: string) {
    return this.api.post<{ data?: SchoolInvitationDto } & SchoolInvitationDto, { email: string }>(
      API.ADMIN.SCHOOL_INVITATIONS,
      { email },
    );
  }

  loadSchoolInvitations() {
    return this.api.get<{ content?: SchoolInvitationDto[] }>(API.ADMIN.SCHOOL_INVITATIONS, {
      size: 20,
    });
  }

  resendSchoolInvitation(publicUuid: string) {
    return this.api.post<{ data?: SchoolInvitationDto } & SchoolInvitationDto>(
      API.ADMIN.SCHOOL_INVITATION_RESEND(publicUuid),
    );
  }

  cancelSchoolInvitation(publicUuid: string) {
    return this.api.delete<{ data?: SchoolInvitationDto }>(API.ADMIN.SCHOOL_INVITATION_BY_ID(publicUuid));
  }

  /**
   * Downloads the personalized school data-prep ZIP for Super Admin handoff.
   */
  downloadPrepPackage(
    schoolName: string,
    variant: PrepPackageVariant = 'PRODUCTION',
  ): Observable<Blob> {
    const params: Record<string, string> = { variant };
    const name = schoolName?.trim();
    if (name) params['schoolName'] = name;
    return this.http
      .get(API.ADMIN.PREP_PACKAGE, {
        params,
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(switchMap((res) => from(this.ensureBinaryBlob(res))));
  }

  private async ensureBinaryBlob(res: HttpResponse<Blob>): Promise<Blob> {
    const blob = res.body;
    if (!blob || blob.size === 0) {
      throw new HttpErrorResponse({
        status: res.status || 500,
        statusText: 'Empty download',
        url: res.url ?? undefined,
      });
    }
    const type = (blob.type || res.headers.get('Content-Type') || '').toLowerCase();
    const looksJson =
      type.includes('application/json') || type.includes('text/json') || type.includes('text/html');
    if (looksJson) {
      const text = await blob.text();
      let message = 'No se pudo descargar el pack';
      try {
        const parsed = JSON.parse(text) as {
          message?: string;
          error?: string;
          errors?: Array<{ message?: string }>;
        };
        message =
          parsed.message ||
          parsed.error ||
          parsed.errors?.[0]?.message ||
          message;
      } catch {
        if (text.trim()) message = text.slice(0, 200);
      }
      throw new HttpErrorResponse({
        error: { message },
        status: res.status >= 400 ? res.status : 500,
        statusText: message,
        url: res.url ?? undefined,
      });
    }
    return blob;
  }
}

export interface SchoolInvitationDto {
  publicUuid: string;
  email: string;
  status: string;
  token?: string | null;
  setupUrl?: string | null;
  emailSent?: boolean;
  expiresAt?: string | null;
}

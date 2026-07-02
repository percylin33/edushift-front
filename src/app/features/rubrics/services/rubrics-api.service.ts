import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  CreateRubricRequest,
  RubricDetail,
  RubricFilters,
  RubricListItemRaw,
  RubricResponseRaw,
  RubricRow,
  UpdateRubricRequest,
  toRubricDetail,
  toRubricRow,
} from '../models';

/**
 * HTTP boundary del feature {@code rubrics} (Sprint 5B / FE-5B.2).
 *
 * <h3>Endpoint coverage</h3>
 * <ul>
 *   <li>{@link #listRubrics}    → {@code GET    /v1/academic/rubrics}</li>
 *   <li>{@link #listSystemRubrics} → {@code GET /v1/academic/rubrics/system}
 *       (seed MINEDU on-demand: la primera llamada del tenant inserta
 *       el catálogo canónico).</li>
 *   <li>{@link #getRubric}      → {@code GET    /v1/academic/rubrics/{uuid}}</li>
 *   <li>{@link #createRubric}   → {@code POST   /v1/academic/rubrics}</li>
 *   <li>{@link #forkRubric}     → {@code POST   /v1/academic/rubrics/{uuid}/fork}</li>
 *   <li>{@link #updateRubric}   → {@code PUT    /v1/academic/rubrics/{uuid}}</li>
 *   <li>{@link #deleteRubric}   → {@code DELETE /v1/academic/rubrics/{uuid}}</li>
 * </ul>
 *
 * <p>Las rúbricas {@code isSystem=true} son read-only por contrato
 * ({@code RUB_SYSTEM_READ_ONLY}, 403). El UI deshabilita los botones
 * de update/delete sobre ellas y solo ofrece "Fork".</p>
 */
@Injectable({ providedIn: 'root' })
export class RubricsApiService {
  private readonly api = inject(ApiService);

  /**
   * Lista rúbricas del tenant. El backend ya ordena por {@code isSystem
   * desc, name asc} para que las MINEDU aparezcan primero como referencia.
   */
  listRubrics(filters: RubricFilters = {}): Observable<RubricRow[]> {
    const params: Record<string, string | undefined> = {
      systemOnly: filters.systemOnly === undefined ? undefined : String(filters.systemOnly),
      isActive: filters.isActive === undefined ? undefined : String(filters.isActive),
      q: filters.q,
    };
    return this.api
      .get<RubricListItemRaw[]>(API.RUBRICS.ROOT, params)
      .pipe(map((rows) => rows.map((r) => toRubricRow(r))));
  }

  /**
   * Trae el catálogo MINEDU (seed on-demand). En la primera llamada del
   * tenant, el backend inserta las 4 rúbricas canónicas con
   * {@code isSystem=true} y las devuelve.
   */
  listSystemRubrics(): Observable<RubricRow[]> {
    return this.api
      .get<RubricListItemRaw[]>(API.RUBRICS.SYSTEM)
      .pipe(map((rows) => rows.map((r) => toRubricRow(r))));
  }

  getRubric(publicUuid: string): Observable<RubricDetail> {
    return this.api
      .get<ApiResponse<RubricResponseRaw>>(API.RUBRICS.BY_ID(publicUuid))
      .pipe(map((envelope) => toRubricDetail(envelope.data)));
  }

  /**
   * Crea una rúbrica per-tenant ({@code isSystem=false}). Validación
   * cascada: bean → service (1..10 criterios, 2..4 niveles, weights
   * = 100, level codes únicos) → DB (unique index `(tenant, lower(name))`).
   */
  createRubric(request: CreateRubricRequest): Observable<RubricDetail> {
    return this.api
      .post<ApiResponse<RubricResponseRaw>, CreateRubricRequest>(API.RUBRICS.ROOT, request)
      .pipe(map((envelope) => toRubricDetail(envelope.data)));
  }

  /**
   * Forka una rúbrica existente (system o per-tenant). El cuerpo es
   * opcional: si está vacío, el server clona todo y aplica el sufijo
   * "(fork)" al nombre. Cualquier campo que el caller pase reemplaza
   * el del origen (override granular).
   */
  forkRubric(publicUuid: string, request?: Partial<CreateRubricRequest>): Observable<RubricDetail> {
    return this.api
      .post<ApiResponse<RubricResponseRaw>, Partial<CreateRubricRequest>>(
        API.RUBRICS.FORK(publicUuid),
        request ?? {},
      )
      .pipe(map((envelope) => toRubricDetail(envelope.data)));
  }

  /**
   * Patch parcial. Las rúbricas {@code isSystem=true} se rechazan con
   * {@code RUB_SYSTEM_READ_ONLY} (403); usar {@link #forkRubric} y
   * editar el clon.
   */
  updateRubric(publicUuid: string, patch: UpdateRubricRequest): Observable<RubricDetail> {
    return this.api
      .put<ApiResponse<RubricResponseRaw>, UpdateRubricRequest>(
        API.RUBRICS.BY_ID(publicUuid),
        patch,
      )
      .pipe(map((envelope) => toRubricDetail(envelope.data)));
  }

  /**
   * Soft-delete. System rubrics: {@code RUB_SYSTEM_READ_ONLY}. Si la
   * rúbrica está vinculada a una evaluation: {@code RUB_IN_USE} (409).
   */
  deleteRubric(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.RUBRICS.BY_ID(publicUuid));
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  AdoptSessionTemplateRequest,
  CreateSessionTemplateRequest,
  SessionTemplateDetail,
  SessionTemplateListItem,
  SessionTemplatesOrganized,
  UpdateSessionTemplateRequest,
} from '../models/session-template.model';

@Injectable({ providedIn: 'root' })
export class SessionTemplatesApiService {
  private readonly api = inject(ApiService);

  organized(): Observable<SessionTemplatesOrganized> {
    return this.api
      .get<ApiResponse<SessionTemplatesOrganized>>(API.SESSIONS.TEMPLATES.ORGANIZED)
      .pipe(map((env) => env.data ?? { groups: [] }));
  }

  listCatalog(): Observable<SessionTemplateListItem[]> {
    return this.api
      .get<ApiResponse<SessionTemplateListItem[]>>(API.SESSIONS.TEMPLATES.CATALOG)
      .pipe(map((env) => env.data ?? []));
  }

  listMine(): Observable<SessionTemplateDetail[]> {
    return this.api
      .get<ApiResponse<SessionTemplateDetail[]>>(API.SESSIONS.TEMPLATES.ROOT)
      .pipe(map((env) => env.data ?? []));
  }

  get(uuid: string): Observable<SessionTemplateDetail> {
    return this.api
      .get<ApiResponse<SessionTemplateDetail>>(API.SESSIONS.TEMPLATES.BY_ID(uuid))
      .pipe(map((env) => env.data));
  }

  adopt(
    catalogUuid: string,
    request: AdoptSessionTemplateRequest = {},
  ): Observable<SessionTemplateDetail> {
    return this.api
      .post<ApiResponse<SessionTemplateDetail>, AdoptSessionTemplateRequest>(
        API.SESSIONS.TEMPLATES.ADOPT(catalogUuid),
        request,
      )
      .pipe(map((env) => env.data));
  }

  create(request: CreateSessionTemplateRequest): Observable<SessionTemplateDetail> {
    return this.api
      .post<ApiResponse<SessionTemplateDetail>, CreateSessionTemplateRequest>(
        API.SESSIONS.TEMPLATES.ROOT,
        request,
      )
      .pipe(map((env) => env.data));
  }

  update(
    uuid: string,
    request: UpdateSessionTemplateRequest,
  ): Observable<SessionTemplateDetail> {
    return this.api
      .put<ApiResponse<SessionTemplateDetail>, UpdateSessionTemplateRequest>(
        API.SESSIONS.TEMPLATES.BY_ID(uuid),
        request,
      )
      .pipe(map((env) => env.data));
  }

  setDefault(uuid: string): Observable<SessionTemplateDetail> {
    return this.api
      .put<ApiResponse<SessionTemplateDetail>, Record<string, never>>(
        API.SESSIONS.TEMPLATES.DEFAULT(uuid),
        {},
      )
      .pipe(map((env) => env.data));
  }

  delete(uuid: string): Observable<void> {
    return this.api.delete<void>(API.SESSIONS.TEMPLATES.BY_ID(uuid));
  }
}

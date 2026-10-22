import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiService } from '@core/services';
import { API } from '@core/constants/api.constants';
import { ApiResponse } from '@core/models/api-response.model';

export type SourceAudience = 'STUDENT' | 'TEACHER' | 'FAMILY';
export type SourceKind = 'INSTITUTIONAL' | 'OFFICIAL';
export type SourceStatus = 'INDEXING' | 'PROCESSING' | 'READY' | 'PUBLISHED' | 'NEEDS_OCR' | 'FAILED' | 'RETIRED';

export interface AiSource {
  publicUuid: string;
  filePublicUuid: string;
  title: string;
  kind: SourceKind;
  status: SourceStatus;
  audiences: SourceAudience[];
  sourceUrl: string | null;
  sourceVersion: string | null;
  effectiveAt: string | null;
  reviewAfter: string | null;
  textBytes: number;
  indexErrorCode: string | null;
}

export interface RegisterSource {
  filePublicUuid: string;
  title: string;
  kind: SourceKind;
  audiences: SourceAudience[];
  sourceUrl: string | null;
  sourceVersion: string | null;
  effectiveAt: string | null;
  reviewAfter: string | null;
}

@Injectable({ providedIn: 'root' })
export class AiSourceService {
  private readonly api = inject(ApiService);

  list() {
    return this.api.get<ApiResponse<AiSource[]>>(API.AI.SOURCES)
      .pipe(map((response) => response.data ?? []));
  }

  register(request: RegisterSource) {
    return this.api.post<ApiResponse<AiSource>>(API.AI.SOURCES, request)
      .pipe(map((response) => response.data));
  }

  publish(publicUuid: string) {
    return this.api.post<ApiResponse<AiSource>>(
      API.AI.SOURCES + '/' + encodeURIComponent(publicUuid) + '/publish', {})
      .pipe(map((response) => response.data));
  }

  retry(publicUuid: string) {
    return this.api.post<ApiResponse<AiSource>>(
      API.AI.SOURCES + '/' + encodeURIComponent(publicUuid) + '/retry', {})
      .pipe(map((response) => response.data));
  }

  retire(publicUuid: string) {
    return this.api.delete<void>(
      API.AI.SOURCES + '/' + encodeURIComponent(publicUuid));
  }
}

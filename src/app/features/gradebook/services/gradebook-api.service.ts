import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  GradeBook,
  GradeBookQuery,
  GradeBookResponseRaw,
  toGradeBook,
} from '../models';

/**
 * HTTP boundary del feature {@code gradebook} (FE-5B.4 / F1b–F4).
 */
@Injectable({ providedIn: 'root' })
export class GradeBookApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  getByAssignment(
    assignmentPublicUuid: string,
    query: GradeBookQuery = {},
  ): Observable<GradeBook> {
    return this.api
      .get<ApiResponse<GradeBookResponseRaw>>(
        API.GRADE_BOOK.BY_ASSIGNMENT(assignmentPublicUuid),
        {
          includeWithdrawn: query.includeWithdrawn === true ? true : undefined,
          includeTransferred: query.includeTransferred === true ? true : undefined,
        },
      )
      .pipe(map((envelope) => toGradeBook(envelope.data)));
  }

  exportXlsx(assignmentPublicUuid: string, query: GradeBookQuery = {}): Observable<Blob> {
    return this.http.get(API.GRADE_BOOK.EXPORT_XLSX(assignmentPublicUuid), {
      params: this.toParams(query),
      responseType: 'blob',
    });
  }

  exportPdf(assignmentPublicUuid: string, query: GradeBookQuery = {}): Observable<Blob> {
    return this.http.get(API.GRADE_BOOK.EXPORT_PDF(assignmentPublicUuid), {
      params: this.toParams(query),
      responseType: 'blob',
    });
  }

  private toParams(query: GradeBookQuery): HttpParams {
    let params = new HttpParams();
    if (query.includeWithdrawn === true) {
      params = params.set('includeWithdrawn', 'true');
    }
    if (query.includeTransferred === true) {
      params = params.set('includeTransferred', 'true');
    }
    return params;
  }
}

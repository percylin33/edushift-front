import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import { GradeBook, GradeBookResponseRaw, toGradeBook } from '../models';

/**
 * HTTP boundary del feature {@code gradebook} (FE-5B.4).
 *
 * <h3>Endpoint</h3>
 * <ul>
 *   <li>{@link #getByAssignment} → {@code GET /v1/academic/teacher-assignments/{publicUuid}/gradebook}</li>
 * </ul>
 *
 * <p>El backend devuelve una "vista on-the-fly": no hay materialised
 * table, así que cada request es una función pura del estado actual de
 * `evaluations` + `grade_records` + `student_enrollments`. Si el listing
 * tarda más de ~500ms en producción se considera DEBT-EVAL-N
 * (paging + materialisation).</p>
 */
@Injectable({ providedIn: 'root' })
export class GradeBookApiService {
  private readonly api = inject(ApiService);

  getByAssignment(assignmentPublicUuid: string): Observable<GradeBook> {
    return this.api
      .get<ApiResponse<GradeBookResponseRaw>>(API.GRADE_BOOK.BY_ASSIGNMENT(assignmentPublicUuid))
      .pipe(map((envelope) => toGradeBook(envelope.data)));
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  StudentCompetencyResult,
  StudentCompetencyResultRevision,
  UpsertStudentCompetencyResultsRequest,
} from '../models/competency-results.model';

@Injectable({ providedIn: 'root' })
export class CompetencyResultsApiService {
  private readonly api = inject(ApiService);

  list(evaluationUuid: string, studentUuid: string): Observable<ApiResponse<StudentCompetencyResult[]>> {
    return this.api.get<ApiResponse<StudentCompetencyResult[]>>(
      API.GRADE_RECORDS.COMPETENCY_RESULTS(evaluationUuid, studentUuid),
    );
  }

  replace(
    evaluationUuid: string,
    studentUuid: string,
    request: UpsertStudentCompetencyResultsRequest,
  ): Observable<ApiResponse<StudentCompetencyResult[]>> {
    return this.api.put<
      ApiResponse<StudentCompetencyResult[]>,
      UpsertStudentCompetencyResultsRequest
    >(API.GRADE_RECORDS.COMPETENCY_RESULTS(evaluationUuid, studentUuid), request);
  }

  revisions(
    evaluationUuid: string,
    studentUuid: string,
    competencyUuid: string,
  ): Observable<ApiResponse<StudentCompetencyResultRevision[]>> {
    return this.api.get<ApiResponse<StudentCompetencyResultRevision[]>>(
      API.GRADE_RECORDS.COMPETENCY_RESULT_REVISIONS(
        evaluationUuid,
        studentUuid,
        competencyUuid,
      ),
    );
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  AdoptGradeRegisterTemplateRequest,
  CreateGradeCategoryRequest,
  GradeRegisterTemplate,
  GradeRegisterTemplateListItem,
  GradeRegisterTemplateRaw,
  UpdateGradeCategoryRequest,
  toGradeRegisterTemplate,
} from '../models/grade-register-template.model';

/**
 * HTTP boundary for formal grade-register templates (F1).
 */
@Injectable({ providedIn: 'root' })
export class GradeRegisterApiService {
  private readonly api = inject(ApiService);

  listCatalog(): Observable<GradeRegisterTemplateListItem[]> {
    return this.api
      .get<ApiResponse<GradeRegisterTemplateListItem[]>>(
        API.ACADEMIC.GRADE_REGISTER_TEMPLATES.CATALOG,
      )
      .pipe(map((env) => env.data ?? []));
  }

  listMine(yearUuid: string): Observable<GradeRegisterTemplateListItem[]> {
    return this.api
      .get<ApiResponse<GradeRegisterTemplateListItem[]>>(
        API.ACADEMIC.GRADE_REGISTER_TEMPLATES.ROOT,
        { yearUuid },
      )
      .pipe(map((env) => env.data ?? []));
  }

  get(uuid: string): Observable<GradeRegisterTemplate> {
    return this.api
      .get<ApiResponse<GradeRegisterTemplateRaw>>(
        API.ACADEMIC.GRADE_REGISTER_TEMPLATES.BY_ID(uuid),
      )
      .pipe(map((env) => toGradeRegisterTemplate(env.data)));
  }

  adopt(
    catalogUuid: string,
    request: AdoptGradeRegisterTemplateRequest,
  ): Observable<GradeRegisterTemplate> {
    return this.api
      .post<ApiResponse<GradeRegisterTemplateRaw>, AdoptGradeRegisterTemplateRequest>(
        API.ACADEMIC.GRADE_REGISTER_TEMPLATES.ADOPT(catalogUuid),
        request,
      )
      .pipe(map((env) => toGradeRegisterTemplate(env.data)));
  }

  updateCategory(
    categoryUuid: string,
    request: UpdateGradeCategoryRequest,
  ): Observable<GradeRegisterTemplate> {
    return this.api
      .put<ApiResponse<GradeRegisterTemplateRaw>, UpdateGradeCategoryRequest>(
        API.ACADEMIC.GRADE_CATEGORIES.BY_ID(categoryUuid),
        request,
      )
      .pipe(map((env) => toGradeRegisterTemplate(env.data)));
  }

  addCategory(
    templateUuid: string,
    request: CreateGradeCategoryRequest,
  ): Observable<GradeRegisterTemplate> {
    return this.api
      .post<ApiResponse<GradeRegisterTemplateRaw>, CreateGradeCategoryRequest>(
        API.ACADEMIC.GRADE_REGISTER_TEMPLATES.CATEGORIES(templateUuid),
        request,
      )
      .pipe(map((env) => toGradeRegisterTemplate(env.data)));
  }

  deleteCategory(categoryUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.GRADE_CATEGORIES.BY_ID(categoryUuid));
  }

  deleteTemplate(uuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.GRADE_REGISTER_TEMPLATES.BY_ID(uuid));
  }
}

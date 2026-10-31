import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  CloneScheduleRequest,
  CreateDayBlockRequest,
  CreateDayTemplateRequest,
  DayBlockItem,
  DayTemplate,
  ScheduleSettings,
  ScheduleSourceDocument,
  ScheduleWarningItem,
  ScheduleWeekView,
  ScheduleWeekViewRaw,
  TeacherWorkloadItem,
  UpdateDayBlockRequest,
  UpdateDayTemplateRequest,
  UpdateScheduleSettingsRequest,
  ApplyDayPlanRequest,
  toScheduleWeekView,
} from '@features/academic/models';

/**
 * HTTP boundary for day templates, recess policy, bootstrap, validation
 * warnings and teacher workload. Week reverse-views (slots + non-teaching
 * blocks) also live here.
 */
@Injectable({ providedIn: 'root' })
export class ScheduleApiService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  getSettings(): Observable<ScheduleSettings> {
    return this.api
      .get<ApiResponse<ScheduleSettings>>(API.ACADEMIC.DAY_SCHEDULE.SETTINGS)
      .pipe(map((env) => env.data));
  }

  updateSettings(request: UpdateScheduleSettingsRequest): Observable<ScheduleSettings> {
    return this.api
      .put<ApiResponse<ScheduleSettings>, UpdateScheduleSettingsRequest>(
        API.ACADEMIC.DAY_SCHEDULE.SETTINGS,
        request,
      )
      .pipe(map((env) => env.data));
  }

  // ---------------------------------------------------------------------------
  // Day templates
  // ---------------------------------------------------------------------------

  listDayTemplates(yearUuid: string): Observable<DayTemplate[]> {
    return this.api
      .get<ApiResponse<DayTemplate[]>>(API.ACADEMIC.DAY_SCHEDULE.DAY_TEMPLATES, { yearUuid })
      .pipe(map((env) => env.data ?? []));
  }

  createDayTemplate(request: CreateDayTemplateRequest): Observable<DayTemplate> {
    return this.api
      .post<ApiResponse<DayTemplate>, CreateDayTemplateRequest>(
        API.ACADEMIC.DAY_SCHEDULE.DAY_TEMPLATES,
        request,
      )
      .pipe(map((env) => env.data));
  }

  updateDayTemplate(uuid: string, request: UpdateDayTemplateRequest): Observable<DayTemplate> {
    return this.api
      .put<ApiResponse<DayTemplate>, UpdateDayTemplateRequest>(
        API.ACADEMIC.DAY_SCHEDULE.DAY_TEMPLATE(uuid),
        request,
      )
      .pipe(map((env) => env.data));
  }

  deleteDayTemplate(uuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.DAY_SCHEDULE.DAY_TEMPLATE(uuid));
  }

  addBlock(templateUuid: string, request: CreateDayBlockRequest): Observable<DayBlockItem> {
    return this.api
      .post<ApiResponse<DayBlockItem>, CreateDayBlockRequest>(
        API.ACADEMIC.DAY_SCHEDULE.DAY_TEMPLATE_BLOCKS(templateUuid),
        request,
      )
      .pipe(map((env) => env.data));
  }

  updateBlock(blockUuid: string, request: UpdateDayBlockRequest): Observable<DayBlockItem> {
    return this.api
      .put<ApiResponse<DayBlockItem>, UpdateDayBlockRequest>(
        API.ACADEMIC.DAY_SCHEDULE.BLOCK(blockUuid),
        request,
      )
      .pipe(map((env) => env.data));
  }

  deleteBlock(blockUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.DAY_SCHEDULE.BLOCK(blockUuid));
  }

  seedDefaultTemplates(yearUuid: string): Observable<DayTemplate[]> {
    return this.http
      .post<ApiResponse<DayTemplate[]>>(
        API.ACADEMIC.DAY_SCHEDULE.SEED_DEFAULTS,
        {},
        { params: { yearUuid } },
      )
      .pipe(map((env) => env.data ?? []));
  }

  applyDayPlan(templateUuid: string, request: ApplyDayPlanRequest): Observable<DayTemplate> {
    return this.api
      .post<ApiResponse<DayTemplate>, ApplyDayPlanRequest>(
        API.ACADEMIC.DAY_SCHEDULE.APPLY_DAY_PLAN(templateUuid),
        request,
      )
      .pipe(map((env) => env.data));
  }

  markDayTemplateReviewed(templateUuid: string): Observable<DayTemplate> {
    return this.api
      .post<ApiResponse<DayTemplate>, Record<string, never>>(
        API.ACADEMIC.DAY_SCHEDULE.REVIEW_DAY_TEMPLATE(templateUuid),
        {},
      )
      .pipe(map((env) => env.data));
  }

  // ---------------------------------------------------------------------------
  // Validation / clone / bootstrap
  // ---------------------------------------------------------------------------

  listValidationWarnings(yearUuid?: string): Observable<ScheduleWarningItem[]> {
    return this.api
      .get<ApiResponse<ScheduleWarningItem[]>>(API.ACADEMIC.DAY_SCHEDULE.VALIDATION_WARNINGS, {
        yearUuid,
      })
      .pipe(map((env) => env.data ?? []));
  }

  cloneSchedule(targetYearUuid: string, request: CloneScheduleRequest): Observable<DayTemplate[]> {
    return this.api
      .post<ApiResponse<DayTemplate[]>, CloneScheduleRequest>(
        API.ACADEMIC.DAY_SCHEDULE.CLONE_SCHEDULE(targetYearUuid),
        request,
      )
      .pipe(map((env) => env.data ?? []));
  }

  listBootstrapDocuments(yearUuid: string): Observable<ScheduleSourceDocument[]> {
    return this.api
      .get<ApiResponse<ScheduleSourceDocument[]>>(API.ACADEMIC.DAY_SCHEDULE.BOOTSTRAP(yearUuid))
      .pipe(map((env) => env.data ?? []));
  }

  uploadBootstrap(yearUuid: string, file: File): Observable<ScheduleSourceDocument> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http
      .post<ApiResponse<ScheduleSourceDocument>>(
        API.ACADEMIC.DAY_SCHEDULE.BOOTSTRAP_UPLOAD(yearUuid),
        fd,
      )
      .pipe(map((env) => env.data));
  }

  // ---------------------------------------------------------------------------
  // Workload
  // ---------------------------------------------------------------------------

  listTeacherWorkload(periodId: string): Observable<TeacherWorkloadItem[]> {
    return this.api
      .get<ApiResponse<TeacherWorkloadItem[]>>(API.ACADEMIC.DAY_SCHEDULE.TEACHERS_WORKLOAD, {
        periodId,
      })
      .pipe(map((env) => env.data ?? []));
  }

  getTeacherWorkload(teacherUuid: string, periodId: string): Observable<TeacherWorkloadItem> {
    return this.api
      .get<ApiResponse<TeacherWorkloadItem>>(API.ACADEMIC.DAY_SCHEDULE.TEACHER_WORKLOAD(teacherUuid), {
        periodId,
      })
      .pipe(map((env) => env.data));
  }

  // ---------------------------------------------------------------------------
  // Week views (slots + non-teaching blocks)
  // ---------------------------------------------------------------------------

  getTeacherScheduleWeek(teacherUuid: string, periodId?: string): Observable<ScheduleWeekView> {
    return this.api
      .get<ApiResponse<ScheduleWeekViewRaw>>(API.ACADEMIC.SCHEDULE.TEACHER_SCHEDULE_WEEK(teacherUuid), {
        periodId,
      })
      .pipe(map((env) => toScheduleWeekView(env.data)));
  }

  getSectionScheduleWeek(sectionUuid: string, periodId?: string): Observable<ScheduleWeekView> {
    return this.api
      .get<ApiResponse<ScheduleWeekViewRaw>>(API.ACADEMIC.SCHEDULE.SECTION_SCHEDULE_WEEK(sectionUuid), {
        periodId,
      })
      .pipe(map((env) => toScheduleWeekView(env.data)));
  }
}

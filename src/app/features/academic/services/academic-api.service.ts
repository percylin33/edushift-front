import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API } from '@core/constants';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import {
  AcademicLevel,
  AcademicLevelResponseRaw,
  AcademicPeriodDetail,
  AcademicPeriodListFilters,
  AcademicPeriodListItemRaw,
  AcademicPeriodResponseRaw,
  AcademicPeriodRow,
  AcademicYearDetail,
  AcademicYearListFilters,
  AcademicYearListItemRaw,
  AcademicYearResponseRaw,
  AcademicYearRow,
  CourseDetail,
  CourseListFilters,
  CourseListItemRaw,
  CourseResponseRaw,
  CourseRow,
  CreateAcademicLevelRequest,
  CreateAcademicPeriodRequest,
  CreateAcademicYearRequest,
  CreateCourseRequest,
  CreateGradeRequest,
  CreateSectionRequest,
  Grade,
  GradeReorderRequest,
  GradeResponseRaw,
  SectionDetail,
  SectionListFilters,
  SectionListItemRaw,
  SectionResponseRaw,
  SectionRow,
  UpdateAcademicLevelRequest,
  UpdateAcademicPeriodRequest,
  UpdateAcademicYearRequest,
  UpdateCourseLevelsRequest,
  UpdateCourseRequest,
  UpdateGradeRequest,
  UpdateSectionRequest,
  parseLocalDate
} from '../models';

/**
 * HTTP boundary del módulo {@code academic}. Sprint 4 / FE-4.1 cubre
 * el sub-módulo {@code academic.year} (BE-4.1). Los demás
 * sub-módulos (levels, sections, courses, periods) llegan en
 * FE-4.2..4.5 reusando el mismo patrón.
 *
 * <h3>Endpoint coverage (FE-4.1)</h3>
 * <ul>
 *   <li>{@link #listYears}     → {@code GET    /v1/academic/years}</li>
 *   <li>{@link #getYear}       → {@code GET    /v1/academic/years/{publicUuid}}</li>
 *   <li>{@link #createYear}    → {@code POST   /v1/academic/years}</li>
 *   <li>{@link #updateYear}    → {@code PUT    /v1/academic/years/{publicUuid}}</li>
 *   <li>{@link #activateYear}  → {@code POST   /v1/academic/years/{publicUuid}/activate}</li>
 *   <li>{@link #deleteYear}    → {@code DELETE /v1/academic/years/{publicUuid}}</li>
 * </ul>
 *
 * <h3>Endpoint coverage (FE-4.2)</h3>
 * <ul>
 *   <li>{@link #listLevels}    → {@code GET    /v1/academic/levels} (con grades embebidos)</li>
 *   <li>{@link #createLevel}   → {@code POST   /v1/academic/levels}</li>
 *   <li>{@link #updateLevel}   → {@code PUT    /v1/academic/levels/{publicUuid}}</li>
 *   <li>{@link #deleteLevel}   → {@code DELETE /v1/academic/levels/{publicUuid}}</li>
 *   <li>{@link #createGrade}   → {@code POST   /v1/academic/levels/{levelUuid}/grades}</li>
 *   <li>{@link #updateGrade}   → {@code PUT    /v1/academic/levels/{levelUuid}/grades/{gradeUuid}}</li>
 *   <li>{@link #deleteGrade}   → {@code DELETE /v1/academic/levels/{levelUuid}/grades/{gradeUuid}}</li>
 *   <li>{@link #reorderGrades} → {@code PATCH  /v1/academic/levels/{levelUuid}/grades/reorder}</li>
 * </ul>
 *
 * <h3>Endpoint coverage (FE-4.3)</h3>
 * <ul>
 *   <li>{@link #listSections}   → {@code GET    /v1/academic/sections}</li>
 *   <li>{@link #getSection}     → {@code GET    /v1/academic/sections/{publicUuid}}</li>
 *   <li>{@link #createSection}  → {@code POST   /v1/academic/sections}</li>
 *   <li>{@link #updateSection}  → {@code PUT    /v1/academic/sections/{publicUuid}}</li>
 *   <li>{@link #deleteSection}  → {@code DELETE /v1/academic/sections/{publicUuid}}</li>
 * </ul>
 *
 * <h3>Endpoint coverage (FE-4.4)</h3>
 * <ul>
 *   <li>{@link #listCourses}        → {@code GET    /v1/academic/courses}</li>
 *   <li>{@link #getCourse}          → {@code GET    /v1/academic/courses/{publicUuid}}</li>
 *   <li>{@link #createCourse}       → {@code POST   /v1/academic/courses}</li>
 *   <li>{@link #updateCourse}       → {@code PUT    /v1/academic/courses/{publicUuid}}</li>
 *   <li>{@link #replaceCourseLevels}→ {@code POST   /v1/academic/courses/{publicUuid}/levels}</li>
 *   <li>{@link #deleteCourse}       → {@code DELETE /v1/academic/courses/{publicUuid}}</li>
 * </ul>
 *
 * <h3>Endpoint coverage (FE-4.5)</h3>
 * <ul>
 *   <li>{@link #listPeriods}  → {@code GET    /v1/academic/periods}</li>
 *   <li>{@link #getPeriod}    → {@code GET    /v1/academic/periods/{publicUuid}}</li>
 *   <li>{@link #createPeriod} → {@code POST   /v1/academic/periods}</li>
 *   <li>{@link #updatePeriod} → {@code PUT    /v1/academic/periods/{publicUuid}}</li>
 *   <li>{@link #deletePeriod} → {@code DELETE /v1/academic/periods/{publicUuid}}</li>
 * </ul>
 *
 * <p>Adapters al final convierten las fechas ISO a {@link Date} y
 * surfacean los nullable como {@code undefined}, igual que en
 * {@code StudentsApiService}.</p>
 */
@Injectable({ providedIn: 'root' })
export class AcademicApiService {
  private readonly api = inject(ApiService);

  // ===========================================================================
  // Years (BE-4.1)
  // ===========================================================================

  /**
   * Lista años académicos del tenant. Backend ordena por
   * {@code status} (ACTIVE primero) luego {@code startDate desc}, así
   * que la UI no necesita re-ordenar.
   */
  listYears(filters: AcademicYearListFilters = {}): Observable<AcademicYearRow[]> {
    const params: Record<string, string | undefined> = {
      status: filters.status
    };
    return this.api
      .get<AcademicYearListItemRaw[]>(API.ACADEMIC.YEARS.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toYearRow(r))));
  }

  getYear(publicUuid: string): Observable<AcademicYearDetail> {
    return this.api
      .get<ApiResponse<AcademicYearResponseRaw>>(API.ACADEMIC.YEARS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toYearDetail(envelope.data)));
  }

  createYear(request: CreateAcademicYearRequest): Observable<AcademicYearDetail> {
    return this.api
      .post<ApiResponse<AcademicYearResponseRaw>, CreateAcademicYearRequest>(
        API.ACADEMIC.YEARS.ROOT,
        request
      )
      .pipe(map((envelope) => this.toYearDetail(envelope.data)));
  }

  updateYear(
    publicUuid: string,
    patch: UpdateAcademicYearRequest
  ): Observable<AcademicYearDetail> {
    return this.api
      .put<ApiResponse<AcademicYearResponseRaw>, UpdateAcademicYearRequest>(
        API.ACADEMIC.YEARS.BY_ID(publicUuid),
        patch
      )
      .pipe(map((envelope) => this.toYearDetail(envelope.data)));
  }

  /**
   * Activa el año. Idempotente sobre años ya {@code ACTIVE}. Si otro
   * año estaba activo, el backend lo cierra ({@code CLOSED}) en la
   * misma transacción.
   *
   * <p>Errores: 409 {@code ACADEMIC_YEAR_NOT_ACTIVATABLE} si el target
   * está {@code CLOSED}; 404 si cross-tenant.</p>
   */
  activateYear(publicUuid: string): Observable<AcademicYearDetail> {
    return this.api
      .post<ApiResponse<AcademicYearResponseRaw>>(API.ACADEMIC.YEARS.ACTIVATE(publicUuid))
      .pipe(map((envelope) => this.toYearDetail(envelope.data)));
  }

  /**
   * Soft-delete. Backend rechaza con 409 {@code ACADEMIC_YEAR_IN_USE}
   * si el año está {@code ACTIVE}: hay que cerrar (activar otro)
   * primero.
   */
  deleteYear(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.YEARS.BY_ID(publicUuid));
  }

  // ===========================================================================
  // Levels (BE-4.2)
  // ===========================================================================

  /**
   * Lista los levels del tenant con sus grades embebidos. El backend
   * devuelve un {@code List<AcademicLevelResponse>} sin envelope
   * (excepción a la convención: payload chico, ordenado por
   * {@code ordinal asc}).
   */
  listLevels(): Observable<AcademicLevel[]> {
    return this.api
      .get<AcademicLevelResponseRaw[]>(API.ACADEMIC.LEVELS.ROOT)
      .pipe(map((rows) => rows.map((r) => this.toLevel(r))));
  }

  createLevel(request: CreateAcademicLevelRequest): Observable<AcademicLevel> {
    return this.api
      .post<ApiResponse<AcademicLevelResponseRaw>, CreateAcademicLevelRequest>(
        API.ACADEMIC.LEVELS.ROOT,
        request
      )
      .pipe(map((envelope) => this.toLevel(envelope.data)));
  }

  updateLevel(
    publicUuid: string,
    patch: UpdateAcademicLevelRequest
  ): Observable<AcademicLevel> {
    return this.api
      .put<ApiResponse<AcademicLevelResponseRaw>, UpdateAcademicLevelRequest>(
        API.ACADEMIC.LEVELS.BY_ID(publicUuid),
        patch
      )
      .pipe(map((envelope) => this.toLevel(envelope.data)));
  }

  /**
   * Soft-delete del level. Errores conocidos:
   * <ul>
   *   <li>409 {@code LEVEL_HAS_GRADES} — borrar primero los grades.</li>
   *   <li>409 {@code LEVEL_IN_USE_BY_COURSES} — cursos asociados (BE-4.4).</li>
   * </ul>
   */
  deleteLevel(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.LEVELS.BY_ID(publicUuid));
  }

  // ===========================================================================
  // Grades (BE-4.2)
  // ===========================================================================

  createGrade(levelUuid: string, request: CreateGradeRequest): Observable<Grade> {
    return this.api
      .post<ApiResponse<GradeResponseRaw>, CreateGradeRequest>(
        API.ACADEMIC.LEVELS.GRADES(levelUuid),
        request
      )
      .pipe(map((envelope) => this.toGrade(envelope.data)));
  }

  updateGrade(
    levelUuid: string,
    gradeUuid: string,
    patch: UpdateGradeRequest
  ): Observable<Grade> {
    return this.api
      .put<ApiResponse<GradeResponseRaw>, UpdateGradeRequest>(
        API.ACADEMIC.LEVELS.GRADE_BY_ID(levelUuid, gradeUuid),
        patch
      )
      .pipe(map((envelope) => this.toGrade(envelope.data)));
  }

  /**
   * Soft-delete. 409 {@code GRADE_HAS_SECTIONS} si tiene secciones
   * asociadas (BE-4.3).
   */
  deleteGrade(levelUuid: string, gradeUuid: string): Observable<void> {
    return this.api.delete<void>(
      API.ACADEMIC.LEVELS.GRADE_BY_ID(levelUuid, gradeUuid)
    );
  }

  /**
   * Reordena grades del level. Backend usa estrategia two-phase
   * (parking en ordinales temporales) para no romper el unique
   * constraint a mitad de la transacción.
   *
   * <p>Retorna la lista de grades del level ordenada por nuevo
   * {@code ordinal asc} — sin envelope, similar al GET de levels.</p>
   */
  reorderGrades(
    levelUuid: string,
    request: GradeReorderRequest
  ): Observable<Grade[]> {
    return this.api
      .patch<GradeResponseRaw[], GradeReorderRequest>(
        API.ACADEMIC.LEVELS.GRADES_REORDER(levelUuid),
        request
      )
      .pipe(map((rows) => rows.map((r) => this.toGrade(r))));
  }

  // ===========================================================================
  // Sections (BE-4.3)
  // ===========================================================================

  /**
   * Lista las secciones del tenant. Sin filtros explícitos, el backend
   * scopea al año {@code ACTIVE}; cualquiera de los tres filtros
   * (year/grade/level) los escopea explícitamente. Si se pasan
   * {@code grade} y {@code level} a la vez, gana grade (más estricto).
   *
   * <p>Retorna una lista plana sin envelope (el set por tenant es
   * acotado: pocos cientos de secciones max).</p>
   */
  listSections(filters: SectionListFilters = {}): Observable<SectionRow[]> {
    const params: Record<string, string | undefined> = {
      academicYearId: filters.academicYearPublicUuid,
      gradeId: filters.gradePublicUuid,
      levelId: filters.levelPublicUuid
    };
    return this.api
      .get<SectionListItemRaw[]>(API.ACADEMIC.SECTIONS.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toSectionRow(r))));
  }

  getSection(publicUuid: string): Observable<SectionDetail> {
    return this.api
      .get<ApiResponse<SectionResponseRaw>>(
        API.ACADEMIC.SECTIONS.BY_ID(publicUuid)
      )
      .pipe(map((envelope) => this.toSectionDetail(envelope.data)));
  }

  createSection(request: CreateSectionRequest): Observable<SectionDetail> {
    return this.api
      .post<ApiResponse<SectionResponseRaw>, CreateSectionRequest>(
        API.ACADEMIC.SECTIONS.ROOT,
        request
      )
      .pipe(map((envelope) => this.toSectionDetail(envelope.data)));
  }

  updateSection(
    publicUuid: string,
    patch: UpdateSectionRequest
  ): Observable<SectionDetail> {
    return this.api
      .put<ApiResponse<SectionResponseRaw>, UpdateSectionRequest>(
        API.ACADEMIC.SECTIONS.BY_ID(publicUuid),
        patch
      )
      .pipe(map((envelope) => this.toSectionDetail(envelope.data)));
  }

  /**
   * Soft-delete. Errores conocidos:
   * <ul>
   *   <li>409 {@code ACADEMIC_YEAR_LOCKED} si el año padre está
   *       {@code CLOSED}.</li>
   *   <li>409 {@code SECTION_HAS_ENROLLMENTS} cuando BE-4.8 wireea
   *       enrollments (Sprint 4).</li>
   * </ul>
   */
  deleteSection(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.SECTIONS.BY_ID(publicUuid));
  }

  // ===========================================================================
  // Courses (BE-4.4)
  // ===========================================================================

  /**
   * Lista cursos del tenant. Backend ordena por {@code name asc}; los
   * filtros opcionales {@code levelId} e {@code isActive} son AND.
   * Retorna lista plana sin envelope (set acotado por tenant).
   */
  listCourses(filters: CourseListFilters = {}): Observable<CourseRow[]> {
    const params: Record<string, string | undefined> = {
      levelId: filters.levelPublicUuid,
      isActive:
        filters.isActive === undefined ? undefined : String(filters.isActive)
    };
    return this.api
      .get<CourseListItemRaw[]>(API.ACADEMIC.COURSES.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toCourseRow(r))));
  }

  getCourse(publicUuid: string): Observable<CourseDetail> {
    return this.api
      .get<ApiResponse<CourseResponseRaw>>(
        API.ACADEMIC.COURSES.BY_ID(publicUuid)
      )
      .pipe(map((envelope) => this.toCourseDetail(envelope.data)));
  }

  /**
   * Crea un curso con su set inicial de levels (≥ 1 por invariant).
   * Errores conocidos:
   * <ul>
   *   <li>409 {@code COURSE_CODE_TAKEN} — code colisiona case-insensitive.</li>
   *   <li>404 {@code RESOURCE_NOT_FOUND} — algún level publicUuid no existe (incl. cross-tenant).</li>
   *   <li>422 {@code COURSE_NEEDS_AT_LEAST_ONE_LEVEL} — la lista resuelta queda vacía.</li>
   * </ul>
   */
  createCourse(request: CreateCourseRequest): Observable<CourseDetail> {
    return this.api
      .post<ApiResponse<CourseResponseRaw>, CreateCourseRequest>(
        API.ACADEMIC.COURSES.ROOT,
        request
      )
      .pipe(map((envelope) => this.toCourseDetail(envelope.data)));
  }

  /**
   * Partial-merge sobre los campos escalares del curso. <strong>No
   * cambia levels</strong> — para eso usa
   * {@link #replaceCourseLevels}.
   */
  updateCourse(
    publicUuid: string,
    patch: UpdateCourseRequest
  ): Observable<CourseDetail> {
    return this.api
      .put<ApiResponse<CourseResponseRaw>, UpdateCourseRequest>(
        API.ACADEMIC.COURSES.BY_ID(publicUuid),
        patch
      )
      .pipe(map((envelope) => this.toCourseDetail(envelope.data)));
  }

  /**
   * Reemplaza el set de levels asociados al curso ({@code POST
   * /courses/{uuid}/levels}). El BE aplica el diff mínimo (solo
   * añade/quita filas); enviar lista vacía da 422
   * {@code COURSE_NEEDS_AT_LEAST_ONE_LEVEL}.
   */
  replaceCourseLevels(
    publicUuid: string,
    request: UpdateCourseLevelsRequest
  ): Observable<CourseDetail> {
    return this.api
      .post<ApiResponse<CourseResponseRaw>, UpdateCourseLevelsRequest>(
        API.ACADEMIC.COURSES.LEVELS(publicUuid),
        request
      )
      .pipe(map((envelope) => this.toCourseDetail(envelope.data)));
  }

  /**
   * Soft-delete. Cascadea a las filas {@code course_levels}. BE-4.7
   * agregará 409 {@code COURSE_IN_USE_BY_ASSIGNMENTS} cuando aterrice
   * el wiring de teacher assignments.
   */
  deleteCourse(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.COURSES.BY_ID(publicUuid));
  }

  // ===========================================================================
  // Periods (BE-4.5)
  // ===========================================================================

  /**
   * Lista periodos. Sin filtros explícitos, el backend escopea al año
   * {@code ACTIVE}; si no hay año activo retorna lista vacía. Backend
   * ordena por {@code (period_type, ordinal) asc}.
   */
  listPeriods(filters: AcademicPeriodListFilters = {}): Observable<AcademicPeriodRow[]> {
    const params: Record<string, string | undefined> = {
      academicYearId: filters.academicYearPublicUuid,
      periodType: filters.periodType
    };
    return this.api
      .get<AcademicPeriodListItemRaw[]>(API.ACADEMIC.PERIODS.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toPeriodRow(r))));
  }

  getPeriod(publicUuid: string): Observable<AcademicPeriodDetail> {
    return this.api
      .get<ApiResponse<AcademicPeriodResponseRaw>>(
        API.ACADEMIC.PERIODS.BY_ID(publicUuid)
      )
      .pipe(map((envelope) => this.toPeriodDetail(envelope.data)));
  }

  /**
   * Crea un periodo. Errores conocidos (orden de validación BE):
   * <ul>
   *   <li>409 {@code ACADEMIC_YEAR_LOCKED} — año {@code CLOSED}.</li>
   *   <li>422 {@code PERIOD_DATE_INVERTED} — start ≥ end.</li>
   *   <li>422 {@code PERIOD_OUT_OF_YEAR_RANGE}.</li>
   *   <li>409 {@code PERIOD_ORDINAL_TAKEN} | {@code PERIOD_ORDINAL_GAP}.</li>
   *   <li>409 {@code PERIOD_DATE_OVERLAP}.</li>
   * </ul>
   */
  createPeriod(
    request: CreateAcademicPeriodRequest
  ): Observable<AcademicPeriodDetail> {
    return this.api
      .post<ApiResponse<AcademicPeriodResponseRaw>, CreateAcademicPeriodRequest>(
        API.ACADEMIC.PERIODS.ROOT,
        request
      )
      .pipe(map((envelope) => this.toPeriodDetail(envelope.data)));
  }

  /**
   * Partial-merge sobre {@code name}, {@code startDate}, {@code endDate}.
   * El triple {@code (year, type, ordinal)} es inmutable.
   */
  updatePeriod(
    publicUuid: string,
    patch: UpdateAcademicPeriodRequest
  ): Observable<AcademicPeriodDetail> {
    return this.api
      .put<ApiResponse<AcademicPeriodResponseRaw>, UpdateAcademicPeriodRequest>(
        API.ACADEMIC.PERIODS.BY_ID(publicUuid),
        patch
      )
      .pipe(map((envelope) => this.toPeriodDetail(envelope.data)));
  }

  /**
   * Soft-delete. Solo el último ordinal del par {@code (year, type)}
   * puede borrarse (BE responde 409 {@code PERIOD_NOT_LAST_ORDINAL}
   * para preservar contigüidad). BE-4.7 agregará 409
   * {@code PERIOD_IN_USE_BY_ASSIGNMENTS}.
   */
  deletePeriod(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.PERIODS.BY_ID(publicUuid));
  }

  // ---------------------------------------------------------------------------
  // Adapters
  // ---------------------------------------------------------------------------

  private toYearRow(raw: AcademicYearListItemRaw): AcademicYearRow {
    return {
      publicUuid: raw.publicUuid,
      name: raw.name,
      status: raw.status,
      startDate: parseLocalDate(raw.startDate),
      endDate: parseLocalDate(raw.endDate)
    };
  }

  private toYearDetail(raw: AcademicYearResponseRaw): AcademicYearDetail {
    return {
      publicUuid: raw.publicUuid,
      name: raw.name,
      status: raw.status,
      startDate: parseLocalDate(raw.startDate),
      endDate: parseLocalDate(raw.endDate),
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt)
    };
  }

  private toLevel(raw: AcademicLevelResponseRaw): AcademicLevel {
    return {
      publicUuid: raw.publicUuid,
      code: raw.code,
      name: raw.name,
      ordinal: raw.ordinal,
      grades: (raw.grades ?? []).map((g) => this.toGrade(g)),
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt)
    };
  }

  private toGrade(raw: GradeResponseRaw): Grade {
    return {
      publicUuid: raw.publicUuid,
      levelPublicUuid: raw.levelPublicUuid,
      name: raw.name,
      ordinal: raw.ordinal,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt)
    };
  }

  private toSectionRow(raw: SectionListItemRaw): SectionRow {
    return {
      publicUuid: raw.publicUuid,
      academicYearPublicUuid: raw.academicYearPublicUuid,
      academicYearName: raw.academicYearName,
      academicYearStatus: raw.academicYearStatus,
      gradePublicUuid: raw.gradePublicUuid,
      gradeName: raw.gradeName,
      gradeOrdinal: raw.gradeOrdinal,
      levelPublicUuid: raw.levelPublicUuid,
      levelCode: raw.levelCode,
      name: raw.name,
      capacity: raw.capacity ?? undefined,
      displayOrder: raw.displayOrder ?? undefined
    };
  }

  private toSectionDetail(raw: SectionResponseRaw): SectionDetail {
    return {
      publicUuid: raw.publicUuid,
      academicYearPublicUuid: raw.academicYearPublicUuid,
      academicYearName: raw.academicYearName,
      academicYearStatus: raw.academicYearStatus,
      gradePublicUuid: raw.gradePublicUuid,
      gradeName: raw.gradeName,
      gradeOrdinal: raw.gradeOrdinal,
      levelPublicUuid: raw.levelPublicUuid,
      levelCode: raw.levelCode,
      levelName: raw.levelName,
      name: raw.name,
      capacity: raw.capacity ?? undefined,
      displayOrder: raw.displayOrder ?? undefined,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt)
    };
  }

  private toCourseRow(raw: CourseListItemRaw): CourseRow {
    return {
      publicUuid: raw.publicUuid,
      code: raw.code,
      name: raw.name,
      credits: raw.credits ?? undefined,
      hoursPerWeek: raw.hoursPerWeek ?? undefined,
      isActive: raw.isActive,
      levels: raw.levels.slice().sort((a, b) => a.ordinal - b.ordinal)
    };
  }

  private toCourseDetail(raw: CourseResponseRaw): CourseDetail {
    return {
      publicUuid: raw.publicUuid,
      code: raw.code,
      name: raw.name,
      description: raw.description ?? undefined,
      credits: raw.credits ?? undefined,
      hoursPerWeek: raw.hoursPerWeek ?? undefined,
      isActive: raw.isActive,
      levels: raw.levels.slice().sort((a, b) => a.ordinal - b.ordinal),
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt)
    };
  }

  private toPeriodRow(raw: AcademicPeriodListItemRaw): AcademicPeriodRow {
    return {
      publicUuid: raw.publicUuid,
      academicYearPublicUuid: raw.academicYearPublicUuid,
      periodType: raw.periodType,
      ordinal: raw.ordinal,
      name: raw.name,
      startDate: parseLocalDate(raw.startDate),
      endDate: parseLocalDate(raw.endDate)
    };
  }

  private toPeriodDetail(raw: AcademicPeriodResponseRaw): AcademicPeriodDetail {
    return {
      publicUuid: raw.publicUuid,
      academicYearPublicUuid: raw.academicYearPublicUuid,
      academicYearName: raw.academicYearName,
      periodType: raw.periodType,
      ordinal: raw.ordinal,
      name: raw.name,
      startDate: parseLocalDate(raw.startDate),
      endDate: parseLocalDate(raw.endDate),
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt)
    };
  }

  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
}

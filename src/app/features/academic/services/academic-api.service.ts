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
  CapacityDetail,
  CapacityReorderRequest,
  CapacityResponseRaw,
  CompetencyDetail,
  CompetencyListItemRaw,
  CompetencyReorderRequest,
  CompetencyResponseRaw,
  CompetencyRow,
  CourseDetail,
  CourseListFilters,
  CourseListItemRaw,
  CourseResponseRaw,
  CourseRow,
  CreateAcademicLevelRequest,
  CreateAcademicPeriodRequest,
  CreateAcademicYearRequest,
  CreateCapacityRequest,
  CreateCompetencyRequest,
  CreateCourseRequest,
  CreateGradeRequest,
  CreateSectionRequest,
  CreateTimeSlotRequest,
  CreateUnitRequest,
  Grade,
  GradeReorderRequest,
  GradeResponseRaw,
  ScheduleSlotItem,
  ScheduleSlotItemRaw,
  SectionDetail,
  SectionListFilters,
  SectionListItemRaw,
  SectionResponseRaw,
  SectionRow,
  SeedCompetenciesResponse,
  TimeSlotDetail,
  TimeSlotResponseRaw,
  UnitDetail,
  UnitListItemRaw,
  UnitReorderRequest,
  UnitResponseRaw,
  UnitRow,
  UpdateAcademicLevelRequest,
  UpdateAcademicPeriodRequest,
  UpdateAcademicYearRequest,
  UpdateCapacityRequest,
  UpdateCompetencyRequest,
  UpdateCourseLevelsRequest,
  UpdateCourseRequest,
  UpdateGradeRequest,
  UpdateSectionRequest,
  UpdateTimeSlotRequest,
  UpdateUnitRequest,
  parseLocalDate,
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
 * <h3>Endpoint coverage (FE-5A.1)</h3>
 * <ul>
 *   <li>{@link #listUnits}    → {@code GET    /v1/academic/courses/{courseUuid}/units}</li>
 *   <li>{@link #createUnit}   → {@code POST   /v1/academic/courses/{courseUuid}/units}</li>
 *   <li>{@link #reorderUnits} → {@code PATCH  /v1/academic/courses/{courseUuid}/units/reorder}</li>
 *   <li>{@link #getUnit}      → {@code GET    /v1/academic/units/{publicUuid}}</li>
 *   <li>{@link #updateUnit}   → {@code PUT    /v1/academic/units/{publicUuid}}</li>
 *   <li>{@link #deleteUnit}   → {@code DELETE /v1/academic/units/{publicUuid}}</li>
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
      status: filters.status,
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
        request,
      )
      .pipe(map((envelope) => this.toYearDetail(envelope.data)));
  }

  updateYear(publicUuid: string, patch: UpdateAcademicYearRequest): Observable<AcademicYearDetail> {
    return this.api
      .put<ApiResponse<AcademicYearResponseRaw>, UpdateAcademicYearRequest>(
        API.ACADEMIC.YEARS.BY_ID(publicUuid),
        patch,
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
        request,
      )
      .pipe(map((envelope) => this.toLevel(envelope.data)));
  }

  updateLevel(publicUuid: string, patch: UpdateAcademicLevelRequest): Observable<AcademicLevel> {
    return this.api
      .put<ApiResponse<AcademicLevelResponseRaw>, UpdateAcademicLevelRequest>(
        API.ACADEMIC.LEVELS.BY_ID(publicUuid),
        patch,
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
        request,
      )
      .pipe(map((envelope) => this.toGrade(envelope.data)));
  }

  updateGrade(levelUuid: string, gradeUuid: string, patch: UpdateGradeRequest): Observable<Grade> {
    return this.api
      .put<ApiResponse<GradeResponseRaw>, UpdateGradeRequest>(
        API.ACADEMIC.LEVELS.GRADE_BY_ID(levelUuid, gradeUuid),
        patch,
      )
      .pipe(map((envelope) => this.toGrade(envelope.data)));
  }

  /**
   * Soft-delete. 409 {@code GRADE_HAS_SECTIONS} si tiene secciones
   * asociadas (BE-4.3).
   */
  deleteGrade(levelUuid: string, gradeUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.LEVELS.GRADE_BY_ID(levelUuid, gradeUuid));
  }

  /**
   * Reordena grades del level. Backend usa estrategia two-phase
   * (parking en ordinales temporales) para no romper el unique
   * constraint a mitad de la transacción.
   *
   * <p>Retorna la lista de grades del level ordenada por nuevo
   * {@code ordinal asc} — sin envelope, similar al GET de levels.</p>
   */
  reorderGrades(levelUuid: string, request: GradeReorderRequest): Observable<Grade[]> {
    return this.api
      .patch<GradeResponseRaw[], GradeReorderRequest>(
        API.ACADEMIC.LEVELS.GRADES_REORDER(levelUuid),
        request,
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
      levelId: filters.levelPublicUuid,
    };
    return this.api
      .get<SectionListItemRaw[]>(API.ACADEMIC.SECTIONS.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toSectionRow(r))));
  }

  getSection(publicUuid: string): Observable<SectionDetail> {
    return this.api
      .get<ApiResponse<SectionResponseRaw>>(API.ACADEMIC.SECTIONS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toSectionDetail(envelope.data)));
  }

  createSection(request: CreateSectionRequest): Observable<SectionDetail> {
    return this.api
      .post<ApiResponse<SectionResponseRaw>, CreateSectionRequest>(
        API.ACADEMIC.SECTIONS.ROOT,
        request,
      )
      .pipe(map((envelope) => this.toSectionDetail(envelope.data)));
  }

  updateSection(publicUuid: string, patch: UpdateSectionRequest): Observable<SectionDetail> {
    return this.api
      .put<ApiResponse<SectionResponseRaw>, UpdateSectionRequest>(
        API.ACADEMIC.SECTIONS.BY_ID(publicUuid),
        patch,
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
      isActive: filters.isActive === undefined ? undefined : String(filters.isActive),
    };
    return this.api
      .get<CourseListItemRaw[]>(API.ACADEMIC.COURSES.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toCourseRow(r))));
  }

  getCourse(publicUuid: string): Observable<CourseDetail> {
    return this.api
      .get<ApiResponse<CourseResponseRaw>>(API.ACADEMIC.COURSES.BY_ID(publicUuid))
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
      .post<ApiResponse<CourseResponseRaw>, CreateCourseRequest>(API.ACADEMIC.COURSES.ROOT, request)
      .pipe(map((envelope) => this.toCourseDetail(envelope.data)));
  }

  /**
   * Partial-merge sobre los campos escalares del curso. <strong>No
   * cambia levels</strong> — para eso usa
   * {@link #replaceCourseLevels}.
   */
  updateCourse(publicUuid: string, patch: UpdateCourseRequest): Observable<CourseDetail> {
    return this.api
      .put<ApiResponse<CourseResponseRaw>, UpdateCourseRequest>(
        API.ACADEMIC.COURSES.BY_ID(publicUuid),
        patch,
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
    request: UpdateCourseLevelsRequest,
  ): Observable<CourseDetail> {
    return this.api
      .post<ApiResponse<CourseResponseRaw>, UpdateCourseLevelsRequest>(
        API.ACADEMIC.COURSES.LEVELS(publicUuid),
        request,
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
      periodType: filters.periodType,
    };
    return this.api
      .get<AcademicPeriodListItemRaw[]>(API.ACADEMIC.PERIODS.ROOT, params)
      .pipe(map((rows) => rows.map((r) => this.toPeriodRow(r))));
  }

  getPeriod(publicUuid: string): Observable<AcademicPeriodDetail> {
    return this.api
      .get<ApiResponse<AcademicPeriodResponseRaw>>(API.ACADEMIC.PERIODS.BY_ID(publicUuid))
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
  createPeriod(request: CreateAcademicPeriodRequest): Observable<AcademicPeriodDetail> {
    return this.api
      .post<ApiResponse<AcademicPeriodResponseRaw>, CreateAcademicPeriodRequest>(
        API.ACADEMIC.PERIODS.ROOT,
        request,
      )
      .pipe(map((envelope) => this.toPeriodDetail(envelope.data)));
  }

  /**
   * Partial-merge sobre {@code name}, {@code startDate}, {@code endDate}.
   * El triple {@code (year, type, ordinal)} es inmutable.
   */
  updatePeriod(
    publicUuid: string,
    patch: UpdateAcademicPeriodRequest,
  ): Observable<AcademicPeriodDetail> {
    return this.api
      .put<ApiResponse<AcademicPeriodResponseRaw>, UpdateAcademicPeriodRequest>(
        API.ACADEMIC.PERIODS.BY_ID(publicUuid),
        patch,
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

  // ===========================================================================
  // Units (BE-5A.1)
  // ===========================================================================

  /**
   * Lista las unidades del curso ordenadas por {@code displayOrder asc}.
   * Backend retorna lista plana sin envelope (mismo patrón que
   * {@code listLevels} y {@code listGrades}).
   */
  listUnits(courseUuid: string): Observable<UnitRow[]> {
    return this.api
      .get<UnitListItemRaw[]>(API.ACADEMIC.COURSES.UNITS(courseUuid))
      .pipe(map((rows) => rows.map((r) => this.toUnitRow(r))));
  }

  getUnit(publicUuid: string): Observable<UnitDetail> {
    return this.api
      .get<ApiResponse<UnitResponseRaw>>(API.ACADEMIC.UNITS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toUnitDetail(envelope.data)));
  }

  /**
   * Crea una unidad bajo el curso. Errores conocidos:
   * <ul>
   *   <li>409 {@code UNIT_NAME_EXISTS} — nombre duplicado dentro del
   *       curso (case-insensitive).</li>
   *   <li>400 {@code UNIT_DATE_INVERTED} — {@code startDate > endDate}.</li>
   *   <li>409 {@code UNIT_ORDER_TAKEN} — colisión en
   *       {@code displayOrder} (raro: explícito en payload).</li>
   * </ul>
   */
  createUnit(courseUuid: string, request: CreateUnitRequest): Observable<UnitDetail> {
    return this.api
      .post<ApiResponse<UnitResponseRaw>, CreateUnitRequest>(
        API.ACADEMIC.COURSES.UNITS(courseUuid),
        request,
      )
      .pipe(map((envelope) => this.toUnitDetail(envelope.data)));
  }

  /**
   * Partial-merge sobre los campos pedagógicos. <strong>No incluye
   * {@code displayOrder}</strong> — para mover una unidad usa
   * {@link #reorderUnits}.
   */
  updateUnit(publicUuid: string, patch: UpdateUnitRequest): Observable<UnitDetail> {
    return this.api
      .put<ApiResponse<UnitResponseRaw>, UpdateUnitRequest>(
        API.ACADEMIC.UNITS.BY_ID(publicUuid),
        patch,
      )
      .pipe(map((envelope) => this.toUnitDetail(envelope.data)));
  }

  /**
   * Soft-delete. 409 {@code UNIT_HAS_SESSIONS} si tiene sesiones
   * vivas (no canceladas) — activado por BE-5A.4.
   */
  deleteUnit(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.UNITS.BY_ID(publicUuid));
  }

  /**
   * Reordena unidades del curso. Backend usa estrategia two-phase
   * (parking en ordinales temporales) idéntica a {@code reorderGrades}
   * para no romper el unique parcial
   * {@code uk_academic_units_course_order_active}.
   *
   * <p>Retorna la lista de {@code UnitDetail} con los nuevos ordinales
   * (envelope {@code data}). La UI puede usarla para reemplazar el
   * estado tras commit.</p>
   */
  reorderUnits(courseUuid: string, request: UnitReorderRequest): Observable<UnitDetail[]> {
    return this.api
      .patch<ApiResponse<UnitResponseRaw[]>, UnitReorderRequest>(
        API.ACADEMIC.COURSES.UNITS_REORDER(courseUuid),
        request,
      )
      .pipe(map((envelope) => envelope.data.map((r) => this.toUnitDetail(r))));
  }

  // ===========================================================================
  // Competencies & Capacities (BE-5A.2)
  // ===========================================================================

  /**
   * Lista las competencias del curso ordenadas por {@code displayOrder asc}.
   * Acepta filtro opcional {@code isActive}.
   */
  listCompetencies(courseUuid: string, isActive?: boolean): Observable<CompetencyRow[]> {
    const params: Record<string, string | undefined> = {
      isActive: isActive === undefined ? undefined : String(isActive),
    };
    return this.api
      .get<CompetencyListItemRaw[]>(API.ACADEMIC.COURSES.COMPETENCIES(courseUuid), params)
      .pipe(map((rows) => rows.map((r) => this.toCompetencyRow(r))));
  }

  getCompetency(publicUuid: string): Observable<CompetencyDetail> {
    return this.api
      .get<ApiResponse<CompetencyResponseRaw>>(API.ACADEMIC.COMPETENCIES.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toCompetencyDetail(envelope.data)));
  }

  /**
   * Crea una competencia bajo el curso. Errores conocidos:
   * <ul>
   *   <li>409 {@code COMPETENCY_CODE_TAKEN} — código duplicado en el curso.</li>
   *   <li>409 {@code COMPETENCY_ORDER_TAKEN} — colisión en {@code displayOrder}.</li>
   * </ul>
   */
  createCompetency(
    courseUuid: string,
    request: CreateCompetencyRequest,
  ): Observable<CompetencyDetail> {
    return this.api
      .post<ApiResponse<CompetencyResponseRaw>, CreateCompetencyRequest>(
        API.ACADEMIC.COURSES.COMPETENCIES(courseUuid),
        request,
      )
      .pipe(map((envelope) => this.toCompetencyDetail(envelope.data)));
  }

  /**
   * Partial-merge sobre los campos de la competencia. <strong>No incluye
   * {@code displayOrder}</strong> — para mover una competencia usa
   * {@link #reorderCompetencies}.
   */
  updateCompetency(
    publicUuid: string,
    patch: UpdateCompetencyRequest,
  ): Observable<CompetencyDetail> {
    return this.api
      .put<ApiResponse<CompetencyResponseRaw>, UpdateCompetencyRequest>(
        API.ACADEMIC.COMPETENCIES.BY_ID(publicUuid),
        patch,
      )
      .pipe(map((envelope) => this.toCompetencyDetail(envelope.data)));
  }

  /**
   * Soft-delete. 409 {@code COMPETENCY_IN_USE_BY_SESSIONS} si tiene sesiones
   * vivas (activado por BE-5A.4).
   */
  deleteCompetency(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.COMPETENCIES.BY_ID(publicUuid));
  }

  /**
   * Reordena competencias del curso. Backend usa estrategia two-phase
   * (parking en ordinales temporales) idéntica a {@code reorderUnits}.
   */
  reorderCompetencies(
    courseUuid: string,
    request: CompetencyReorderRequest,
  ): Observable<CompetencyDetail[]> {
    return this.api
      .patch<ApiResponse<CompetencyResponseRaw[]>, CompetencyReorderRequest>(
        API.ACADEMIC.COURSES.COMPETENCIES_REORDER(courseUuid),
        request,
      )
      .pipe(map((envelope) => envelope.data.map((r) => this.toCompetencyDetail(r))));
  }

  /**
   * Siembra el catálogo MINEDU mínimo según el {@code code} del curso.
   * Idempotente: si ya hay ≥1 competencia, retorna {@code seeded=false}.
   */
  seedCompetencies(courseUuid: string): Observable<SeedCompetenciesResponse> {
    return this.api
      .post<ApiResponse<SeedCompetenciesResponse>>(
        API.ACADEMIC.COURSES.COMPETENCIES_SEED(courseUuid),
      )
      .pipe(map((envelope) => envelope.data));
  }

  /**
   * Lista las capacidades de una competencia ordenadas por {@code displayOrder asc}.
   * Acepta filtro opcional {@code isActive}.
   */
  listCapacities(competencyUuid: string, isActive?: boolean): Observable<CapacityDetail[]> {
    const params: Record<string, string | undefined> = {
      isActive: isActive === undefined ? undefined : String(isActive),
    };
    return this.api
      .get<CapacityResponseRaw[]>(API.ACADEMIC.COMPETENCIES.CAPACITIES(competencyUuid), params)
      .pipe(map((rows) => rows.map((r) => this.toCapacityDetail(r))));
  }

  /**
   * Crea una capacidad bajo la competencia. Errores conocidos:
   * <ul>
   *   <li>409 {@code CAPACITY_CODE_TAKEN} — código duplicado en la competencia.</li>
   *   <li>409 {@code CAPACITY_ORDER_TAKEN} — colisión en {@code displayOrder}.</li>
   * </ul>
   */
  createCapacity(
    competencyUuid: string,
    request: CreateCapacityRequest,
  ): Observable<CapacityDetail> {
    return this.api
      .post<ApiResponse<CapacityResponseRaw>, CreateCapacityRequest>(
        API.ACADEMIC.COMPETENCIES.CAPACITIES(competencyUuid),
        request,
      )
      .pipe(map((envelope) => this.toCapacityDetail(envelope.data)));
  }

  /**
   * Partial-merge sobre los campos de la capacidad. <strong>No incluye
   * {@code displayOrder}</strong> — para mover una capacidad usa
   * {@link #reorderCapacities}.
   */
  updateCapacity(publicUuid: string, patch: UpdateCapacityRequest): Observable<CapacityDetail> {
    return this.api
      .put<ApiResponse<CapacityResponseRaw>, UpdateCapacityRequest>(
        API.ACADEMIC.CAPACITIES.BY_ID(publicUuid),
        patch,
      )
      .pipe(map((envelope) => this.toCapacityDetail(envelope.data)));
  }

  /**
   * Soft-delete. 409 {@code CAPACITY_IN_USE_BY_SESSIONS} si tiene sesiones
   * vivas (activado por BE-5A.4).
   */
  deleteCapacity(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.CAPACITIES.BY_ID(publicUuid));
  }

  /**
   * Reordena capacidades de la competencia. Backend usa estrategia two-phase.
   */
  reorderCapacities(
    competencyUuid: string,
    request: CapacityReorderRequest,
  ): Observable<CapacityDetail[]> {
    return this.api
      .patch<ApiResponse<CapacityResponseRaw[]>, CapacityReorderRequest>(
        API.ACADEMIC.COMPETENCIES.CAPACITIES_REORDER(competencyUuid),
        request,
      )
      .pipe(map((envelope) => envelope.data.map((r) => this.toCapacityDetail(r))));
  }

  // ===========================================================================
  // Schedule & Time Slots (BE-5A.3)
  // ===========================================================================

  /**
   * Obtiene el horario semanal de un docente (todas sus asignaciones activas).
   * {@code teacher} viene como {@code null} en la respuesta (el caller ya es el docente).
   */
  getTeacherSchedule(teacherUuid: string, periodId?: string): Observable<ScheduleSlotItem[]> {
    const params: Record<string, string | undefined> = {
      periodId,
    };
    return this.api
      .get<ScheduleSlotItemRaw[]>(API.ACADEMIC.SCHEDULE.TEACHER_SCHEDULE(teacherUuid), params)
      .pipe(map((rows) => rows.map((r) => this.toScheduleSlotItem(r))));
  }

  /**
   * Obtiene el horario semanal de una sección.
   * {@code section} viene como {@code null} en la respuesta.
   */
  getSectionSchedule(sectionUuid: string, periodId?: string): Observable<ScheduleSlotItem[]> {
    const params: Record<string, string | undefined> = {
      periodId,
    };
    return this.api
      .get<ScheduleSlotItemRaw[]>(API.ACADEMIC.SCHEDULE.SECTION_SCHEDULE(sectionUuid), params)
      .pipe(map((rows) => rows.map((r) => this.toScheduleSlotItem(r))));
  }

  /**
   * Lista las asignaciones de docentes del tenant.
   * Acepta filtros opcionales para la cascada del formulario de sesiones.
   */
  listAssignments(
    filters: {
      teacherId?: string;
      sectionId?: string;
      courseId?: string;
      activeOnly?: boolean;
    } = {},
  ): Observable<any[]> {
    const params: Record<string, string | undefined> = {
      teacherId: filters.teacherId,
      sectionId: filters.sectionId,
      courseId: filters.courseId,
      activeOnly: filters.activeOnly === undefined ? undefined : String(filters.activeOnly),
    };
    return this.api.get<any[]>(API.TEACHER_ASSIGNMENTS.ROOT, params);
  }

  /**
   * Obtiene el detalle de un time slot.
   */
  getTimeSlot(publicUuid: string): Observable<TimeSlotDetail> {
    return this.api
      .get<ApiResponse<TimeSlotResponseRaw>>(API.ACADEMIC.TIME_SLOTS.BY_ID(publicUuid))
      .pipe(map((envelope) => this.toTimeSlotDetail(envelope.data)));
  }

  /**
   * Crea un time slot para una asignación.
   * Errores: 400 {@code TIME_SLOT_DATE_INVERTED}, 409 {@code TIME_SLOT_OVERLAP}, 409 {@code ASSIGNMENT_NOT_ACTIVE}.
   */
  createTimeSlot(
    assignmentUuid: string,
    request: CreateTimeSlotRequest,
  ): Observable<TimeSlotDetail> {
    return this.api
      .post<ApiResponse<TimeSlotResponseRaw>, CreateTimeSlotRequest>(
        API.ACADEMIC.TIME_SLOTS.BY_ASSIGNMENT(assignmentUuid),
        request,
      )
      .pipe(map((envelope) => this.toTimeSlotDetail(envelope.data)));
  }

  /**
   * Actualiza un time slot.
   */
  updateTimeSlot(publicUuid: string, patch: UpdateTimeSlotRequest): Observable<TimeSlotDetail> {
    return this.api
      .put<ApiResponse<TimeSlotResponseRaw>, UpdateTimeSlotRequest>(
        API.ACADEMIC.TIME_SLOTS.BY_ID(publicUuid),
        patch,
      )
      .pipe(map((envelope) => this.toTimeSlotDetail(envelope.data)));
  }

  /**
   * Soft-delete de un time slot.
   */
  deleteTimeSlot(publicUuid: string): Observable<void> {
    return this.api.delete<void>(API.ACADEMIC.TIME_SLOTS.BY_ID(publicUuid));
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
      endDate: parseLocalDate(raw.endDate),
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
      updatedAt: this.parseDate(raw.updatedAt),
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
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  private toGrade(raw: GradeResponseRaw): Grade {
    return {
      publicUuid: raw.publicUuid,
      levelPublicUuid: raw.levelPublicUuid,
      name: raw.name,
      ordinal: raw.ordinal,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
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
      displayOrder: raw.displayOrder ?? undefined,
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
      updatedAt: this.parseDate(raw.updatedAt),
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
      levels: raw.levels.slice().sort((a, b) => a.ordinal - b.ordinal),
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
      updatedAt: this.parseDate(raw.updatedAt),
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
      endDate: parseLocalDate(raw.endDate),
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
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  private toUnitRow(raw: UnitListItemRaw): UnitRow {
    return {
      publicUuid: raw.publicUuid,
      name: raw.name,
      displayOrder: raw.displayOrder,
      startDate: raw.startDate ? parseLocalDate(raw.startDate) : undefined,
      endDate: raw.endDate ? parseLocalDate(raw.endDate) : undefined,
      isActive: raw.isActive,
      sessionCount: raw.sessionCount,
    };
  }

  private toUnitDetail(raw: UnitResponseRaw): UnitDetail {
    return {
      publicUuid: raw.publicUuid,
      course: {
        publicUuid: raw.course.publicUuid,
        code: raw.course.code,
        name: raw.course.name,
      },
      name: raw.name,
      description: raw.description ?? undefined,
      displayOrder: raw.displayOrder,
      startDate: raw.startDate ? parseLocalDate(raw.startDate) : undefined,
      endDate: raw.endDate ? parseLocalDate(raw.endDate) : undefined,
      isActive: raw.isActive,
      sessionCount: raw.sessionCount,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  private parseDate(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  private toCompetencyRow(raw: CompetencyListItemRaw): CompetencyRow {
    return {
      publicUuid: raw.publicUuid,
      code: raw.code,
      name: raw.name,
      displayOrder: raw.displayOrder,
      isActive: raw.isActive,
      capacityCount: raw.capacityCount,
      capacities: [],
    };
  }

  private toCompetencyDetail(raw: CompetencyResponseRaw): CompetencyDetail {
    return {
      publicUuid: raw.publicUuid,
      course: raw.course,
      code: raw.code,
      name: raw.name,
      description: raw.description ?? undefined,
      displayOrder: raw.displayOrder,
      isActive: raw.isActive,
      capacityCount: raw.capacities.length,
      capacities: raw.capacities.map((c) => ({
        publicUuid: c.publicUuid,
        code: c.code,
        name: c.name,
        displayOrder: c.displayOrder,
        isActive: c.isActive,
        competency: {
          publicUuid: raw.publicUuid,
          code: raw.code,
          name: raw.name,
          course: raw.course,
        },
      })),
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  private toCapacityDetail(raw: CapacityResponseRaw): CapacityDetail {
    return {
      publicUuid: raw.publicUuid,
      competency: raw.competency,
      code: raw.code,
      name: raw.name,
      description: raw.description ?? undefined,
      displayOrder: raw.displayOrder,
      isActive: raw.isActive,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  private toScheduleSlotItem(raw: ScheduleSlotItemRaw): ScheduleSlotItem {
    return {
      slotPublicUuid: raw.slotPublicUuid,
      assignmentPublicUuid: raw.assignmentPublicUuid,
      dayOfWeek: raw.dayOfWeek,
      startTime: raw.startTime,
      endTime: raw.endTime,
      classroom: raw.classroom ?? undefined,
      teacher: raw.teacher ?? undefined,
      course: raw.course,
      section: raw.section ?? undefined,
      period: raw.period,
    };
  }

  private toTimeSlotDetail(raw: TimeSlotResponseRaw): TimeSlotDetail {
    return {
      publicUuid: raw.publicUuid,
      assignmentPublicUuid: raw.assignmentPublicUuid,
      dayOfWeek: raw.dayOfWeek,
      startTime: raw.startTime,
      endTime: raw.endTime,
      classroom: raw.classroom ?? undefined,
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }
}

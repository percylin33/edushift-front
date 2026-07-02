import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AcademicApiService } from '../services';
import {
  AcademicLevel,
  AcademicPeriodDetail,
  AcademicPeriodListFilters,
  AcademicPeriodRow,
  AcademicYearDetail,
  AcademicYearListFilters,
  AcademicYearRow,
  AcademicYearStatus,
  CourseDetail,
  CourseListFilters,
  CourseRow,
  CreateAcademicLevelRequest,
  CreateAcademicPeriodRequest,
  CreateAcademicYearRequest,
  CreateCourseRequest,
  CreateGradeRequest,
  CreateSectionRequest,
  Grade,
  PeriodType,
  SectionDetail,
  SectionListFilters,
  SectionRow,
  UpdateAcademicLevelRequest,
  UpdateAcademicPeriodRequest,
  UpdateAcademicYearRequest,
  UpdateCourseLevelsRequest,
  UpdateCourseRequest,
  UpdateGradeRequest,
  UpdateSectionRequest,
} from '../models';

/**
 * Reactive façade sobre {@link AcademicApiService} para las pantallas
 * del módulo {@code academic}. Sprint 4 / FE-4.1 cubre el slice de
 * años; los slices de levels/sections/courses/periods se agregan en
 * FE-4.2..4.5 sobre este mismo store o en stores hermanos según
 * complejidad.
 *
 * <h3>State slices (FE-4.1)</h3>
 * <ol>
 *   <li><b>Years list</b> — colección completa (no paginada: pocos años
 *       por tenant). {@link #loadYears} refresca; {@link #currentActive}
 *       expone el año {@code ACTIVE} para que la sidebar/header lo
 *       resalten sin un fetch adicional.</li>
 *   <li><b>Year detail</b> — slot individual ({@link #selectedYear})
 *       que el form de edición usa para hidratar valores; las
 *       mutaciones lo mantienen sincronizado con la fila de la lista.</li>
 * </ol>
 *
 * <p>Las páginas <strong>no</strong> deben llamar a
 * {@link AcademicApiService} directamente: enrutar las escrituras a
 * través del store evita listas desactualizadas tras
 * {@code update/activate/delete}.</p>
 */
@Injectable({ providedIn: 'root' })
export class AcademicStore {
  private readonly api = inject(AcademicApiService);

  // -------- years list slice --------
  private readonly _years = signal<AcademicYearRow[]>([]);
  private readonly _yearFilters = signal<AcademicYearListFilters>({});
  private readonly _loadingYears = signal(false);

  // -------- year detail slice --------
  private readonly _selectedYear = signal<AcademicYearDetail | null>(null);
  private readonly _loadingYearDetail = signal(false);
  private readonly _savingYear = signal(false);

  // -------- levels & grades slice (FE-4.2) --------
  private readonly _levels = signal<AcademicLevel[]>([]);
  private readonly _selectedLevelId = signal<string | null>(null);
  private readonly _loadingLevels = signal(false);
  private readonly _savingLevel = signal(false);
  private readonly _savingGrade = signal(false);
  /** Snapshot del orden previo para rollback en reorder optimista. */
  private gradesSnapshot: Grade[] | null = null;

  // -------- sections slice (FE-4.3) --------
  private readonly _sections = signal<SectionRow[]>([]);
  private readonly _sectionFilters = signal<SectionListFilters>({});
  private readonly _loadingSections = signal(false);
  private readonly _selectedSection = signal<SectionDetail | null>(null);
  private readonly _loadingSectionDetail = signal(false);
  private readonly _savingSection = signal(false);

  // -------- courses slice (FE-4.4) --------
  private readonly _courses = signal<CourseRow[]>([]);
  private readonly _courseFilters = signal<CourseListFilters>({});
  private readonly _loadingCourses = signal(false);
  private readonly _selectedCourse = signal<CourseDetail | null>(null);
  private readonly _loadingCourseDetail = signal(false);
  private readonly _savingCourse = signal(false);

  // -------- periods slice (FE-4.5) --------
  private readonly _periods = signal<AcademicPeriodRow[]>([]);
  private readonly _periodFilters = signal<AcademicPeriodListFilters>({});
  private readonly _loadingPeriods = signal(false);
  private readonly _savingPeriod = signal(false);
  /** Progreso del bulk-generator: {@code current/total} POSTs. */
  private readonly _bulkProgress = signal<{ current: number; total: number } | null>(null);

  // -------- shared --------
  private readonly _error = signal<string | null>(null);

  readonly years = this._years.asReadonly();
  readonly yearFilters = this._yearFilters.asReadonly();
  readonly loadingYears = this._loadingYears.asReadonly();

  readonly selectedYear = this._selectedYear.asReadonly();
  readonly loadingYearDetail = this._loadingYearDetail.asReadonly();
  readonly savingYear = this._savingYear.asReadonly();

  readonly levels = this._levels.asReadonly();
  readonly selectedLevelId = this._selectedLevelId.asReadonly();
  readonly loadingLevels = this._loadingLevels.asReadonly();
  readonly savingLevel = this._savingLevel.asReadonly();
  readonly savingGrade = this._savingGrade.asReadonly();

  /** Level seleccionado en el board, o el primero si no hay selección. */
  readonly selectedLevel = computed<AcademicLevel | null>(() => {
    const id = this._selectedLevelId();
    const all = this._levels();
    if (id) return all.find((l) => l.publicUuid === id) ?? null;
    return all[0] ?? null;
  });

  /** Grades del level seleccionado, ordenados por {@code ordinal asc}. */
  readonly selectedGrades = computed<Grade[]>(
    () =>
      this.selectedLevel()
        ?.grades.slice()
        .sort((a, b) => a.ordinal - b.ordinal) ?? [],
  );

  readonly hasLevels = computed(() => this._levels().length > 0);
  readonly isLevelsEmpty = computed(() => !this._loadingLevels() && this._levels().length === 0);

  readonly sections = this._sections.asReadonly();
  readonly sectionFilters = this._sectionFilters.asReadonly();
  readonly loadingSections = this._loadingSections.asReadonly();
  readonly selectedSection = this._selectedSection.asReadonly();
  readonly loadingSectionDetail = this._loadingSectionDetail.asReadonly();
  readonly savingSection = this._savingSection.asReadonly();

  /**
   * Secciones filtradas client-side por {@code search} (no soportado
   * server-side). Backend ya filtró por year/grade/level; aquí solo
   * aplicamos el text-search por {@code name} si lo hay.
   */
  readonly filteredSections = computed<SectionRow[]>(() => {
    const all = this._sections();
    const q = this._sectionFilters().search?.trim().toLowerCase();
    if (!q) return all;
    return all.filter((s) => s.name.toLowerCase().includes(q));
  });

  readonly hasSections = computed(() => this._sections().length > 0);
  readonly isSectionsEmpty = computed(
    () => !this._loadingSections() && this._sections().length === 0,
  );

  readonly courses = this._courses.asReadonly();
  readonly courseFilters = this._courseFilters.asReadonly();
  readonly loadingCourses = this._loadingCourses.asReadonly();
  readonly selectedCourse = this._selectedCourse.asReadonly();
  readonly loadingCourseDetail = this._loadingCourseDetail.asReadonly();
  readonly savingCourse = this._savingCourse.asReadonly();

  /**
   * Cursos filtrados client-side por {@code search} (BE no soporta).
   * El backend ya filtró por levelId/isActive; aquí matcheamos
   * {@code code} y {@code name} contra la query.
   */
  readonly filteredCourses = computed<CourseRow[]>(() => {
    const all = this._courses();
    const q = this._courseFilters().search?.trim().toLowerCase();
    if (!q) return all;
    return all.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  });

  readonly hasCourses = computed(() => this._courses().length > 0);
  readonly isCoursesEmpty = computed(() => !this._loadingCourses() && this._courses().length === 0);

  readonly periods = this._periods.asReadonly();
  readonly periodFilters = this._periodFilters.asReadonly();
  readonly loadingPeriods = this._loadingPeriods.asReadonly();
  readonly savingPeriod = this._savingPeriod.asReadonly();
  readonly bulkProgress = this._bulkProgress.asReadonly();

  readonly hasPeriods = computed(() => this._periods().length > 0);
  readonly isPeriodsEmpty = computed(() => !this._loadingPeriods() && this._periods().length === 0);

  readonly error = this._error.asReadonly();

  /**
   * Año {@code ACTIVE} actual del tenant (a lo más uno, garantía del
   * partial unique index {@code uk_academic_years_active_singleton}).
   * {@code null} si no hay año activo todavía.
   */
  readonly currentActive = computed<AcademicYearRow | null>(
    () => this._years().find((y) => y.status === AcademicYearStatus.Active) ?? null,
  );

  readonly hasYears = computed(() => this._years().length > 0);
  readonly isYearsEmpty = computed(() => !this._loadingYears() && this._years().length === 0);

  // ===========================================================================
  // Years list ops
  // ===========================================================================

  /** Aplica un filtro y recarga la lista. {@code undefined} status = mostrar todos. */
  async applyYearFilters(filters: AcademicYearListFilters): Promise<void> {
    this._yearFilters.set({ ...filters });
    await this.loadYears();
  }

  async loadYears(): Promise<void> {
    this._loadingYears.set(true);
    this._error.set(null);

    try {
      const rows = await firstValueFrom(this.api.listYears(this._yearFilters()));
      this._years.set(rows);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._years.set([]);
    } finally {
      this._loadingYears.set(false);
    }
  }

  // ===========================================================================
  // Year detail ops
  // ===========================================================================

  async loadYearDetail(publicUuid: string): Promise<AcademicYearDetail | null> {
    this._loadingYearDetail.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(this.api.getYear(publicUuid));
      this._selectedYear.set(detail);
      return detail;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._selectedYear.set(null);
      return null;
    } finally {
      this._loadingYearDetail.set(false);
    }
  }

  async createYear(request: CreateAcademicYearRequest): Promise<AcademicYearDetail | null> {
    this._savingYear.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.createYear(request));
      this._selectedYear.set(created);
      this._years.update((rows) => this.sortRows([this.toYearRow(created), ...rows]));
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingYear.set(false);
    }
  }

  async updateYear(
    publicUuid: string,
    patch: UpdateAcademicYearRequest,
  ): Promise<AcademicYearDetail | null> {
    this._savingYear.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.updateYear(publicUuid, patch));
      this._selectedYear.set(updated);
      this.upsertYearRow(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingYear.set(false);
    }
  }

  /**
   * Activa el año destino. Reproduce localmente el efecto del backend:
   * cierra el {@code ACTIVE} previo (si lo había) y promueve el target
   * a {@code ACTIVE}. Esto evita que la UI parpadee mostrando dos
   * años activos hasta el próximo {@link #loadYears}.
   */
  async activateYear(publicUuid: string): Promise<AcademicYearDetail | null> {
    this._savingYear.set(true);
    this._error.set(null);

    try {
      const activated = await firstValueFrom(this.api.activateYear(publicUuid));
      this._selectedYear.set(activated);
      this._years.update((rows) =>
        this.sortRows(
          rows.map((r) => {
            if (r.publicUuid === activated.publicUuid) {
              return this.toYearRow(activated);
            }
            if (r.status === AcademicYearStatus.Active) {
              return { ...r, status: AcademicYearStatus.Closed };
            }
            return r;
          }),
        ),
      );
      return activated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingYear.set(false);
    }
  }

  async deleteYear(publicUuid: string): Promise<boolean> {
    this._savingYear.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.deleteYear(publicUuid));
      this._years.update((rows) => rows.filter((r) => r.publicUuid !== publicUuid));
      if (this._selectedYear()?.publicUuid === publicUuid) {
        this._selectedYear.set(null);
      }
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._savingYear.set(false);
    }
  }

  // ===========================================================================
  // Levels & Grades ops (FE-4.2)
  // ===========================================================================

  async loadLevels(): Promise<void> {
    this._loadingLevels.set(true);
    this._error.set(null);

    try {
      const rows = await firstValueFrom(this.api.listLevels());
      this._levels.set(rows);
      /* Mantén la selección actual si sigue existiendo; si no,
       * cae al primero (computed `selectedLevel` ya lo hace pero
       * el id explícito ayuda a la URL/tab). */
      const id = this._selectedLevelId();
      if (id && !rows.some((l) => l.publicUuid === id)) {
        this._selectedLevelId.set(rows[0]?.publicUuid ?? null);
      }
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._levels.set([]);
    } finally {
      this._loadingLevels.set(false);
    }
  }

  selectLevel(publicUuid: string | null): void {
    this._selectedLevelId.set(publicUuid);
  }

  async createLevel(request: CreateAcademicLevelRequest): Promise<AcademicLevel | null> {
    this._savingLevel.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.createLevel(request));
      this._levels.update((rows) => this.sortLevels([...rows, created]));
      this._selectedLevelId.set(created.publicUuid);
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingLevel.set(false);
    }
  }

  async updateLevel(
    publicUuid: string,
    patch: UpdateAcademicLevelRequest,
  ): Promise<AcademicLevel | null> {
    this._savingLevel.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.updateLevel(publicUuid, patch));
      this._levels.update((rows) =>
        this.sortLevels(rows.map((l) => (l.publicUuid === publicUuid ? updated : l))),
      );
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingLevel.set(false);
    }
  }

  async deleteLevel(publicUuid: string): Promise<boolean> {
    this._savingLevel.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.deleteLevel(publicUuid));
      this._levels.update((rows) => rows.filter((l) => l.publicUuid !== publicUuid));
      if (this._selectedLevelId() === publicUuid) {
        this._selectedLevelId.set(this._levels()[0]?.publicUuid ?? null);
      }
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._savingLevel.set(false);
    }
  }

  async createGrade(levelUuid: string, request: CreateGradeRequest): Promise<Grade | null> {
    this._savingGrade.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.createGrade(levelUuid, request));
      this.upsertGrade(levelUuid, created);
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingGrade.set(false);
    }
  }

  async updateGrade(
    levelUuid: string,
    gradeUuid: string,
    patch: UpdateGradeRequest,
  ): Promise<Grade | null> {
    this._savingGrade.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.updateGrade(levelUuid, gradeUuid, patch));
      this.upsertGrade(levelUuid, updated);
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingGrade.set(false);
    }
  }

  async deleteGrade(levelUuid: string, gradeUuid: string): Promise<boolean> {
    this._savingGrade.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.deleteGrade(levelUuid, gradeUuid));
      this._levels.update((rows) =>
        rows.map((l) =>
          l.publicUuid === levelUuid
            ? { ...l, grades: l.grades.filter((g) => g.publicUuid !== gradeUuid) }
            : l,
        ),
      );
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._savingGrade.set(false);
    }
  }

  /**
   * Aplica un orden optimista de los grades en memoria. Se invoca
   * <strong>antes</strong> de {@link #commitGradeReorder}: la UI ya
   * refleja el nuevo orden mientras viaja la PATCH al backend.
   *
   * <p>Guarda un snapshot interno del orden previo para que
   * {@link #rollbackGradeReorder} lo restaure si la request falla.</p>
   */
  optimisticReorderGrades(levelUuid: string, orderedUuids: string[]): void {
    const level = this._levels().find((l) => l.publicUuid === levelUuid);
    if (!level) return;

    this.gradesSnapshot = level.grades.slice();
    const byId = new Map(level.grades.map((g) => [g.publicUuid, g]));
    const reordered: Grade[] = [];
    orderedUuids.forEach((id, index) => {
      const g = byId.get(id);
      if (g) reordered.push({ ...g, ordinal: index + 1 });
    });

    this._levels.update((rows) =>
      rows.map((l) => (l.publicUuid === levelUuid ? { ...l, grades: reordered } : l)),
    );
  }

  /**
   * Confirma el reorder enviando la PATCH al backend. Si falla,
   * revierte el snapshot guardado por {@link #optimisticReorderGrades}.
   */
  async commitGradeReorder(levelUuid: string): Promise<boolean> {
    const level = this._levels().find((l) => l.publicUuid === levelUuid);
    if (!level) return false;

    const items = level.grades.map((g, i) => ({
      publicUuid: g.publicUuid,
      ordinal: i + 1,
    }));

    this._savingGrade.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.reorderGrades(levelUuid, { items }));
      this._levels.update((rows) =>
        rows.map((l) => (l.publicUuid === levelUuid ? { ...l, grades: updated } : l)),
      );
      this.gradesSnapshot = null;
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this.rollbackGradeReorder(levelUuid);
      return false;
    } finally {
      this._savingGrade.set(false);
    }
  }

  /**
   * Rollback explícito: restaura el snapshot tomado por
   * {@link #optimisticReorderGrades}. Útil si el caller decide cancelar
   * el reorder antes de commit (ej. drag fuera del drop list).
   */
  rollbackGradeReorder(levelUuid: string): void {
    if (!this.gradesSnapshot) return;
    const snap = this.gradesSnapshot;
    this._levels.update((rows) =>
      rows.map((l) => (l.publicUuid === levelUuid ? { ...l, grades: snap } : l)),
    );
    this.gradesSnapshot = null;
  }

  // ===========================================================================
  // Sections ops (FE-4.3)
  // ===========================================================================

  async applySectionFilters(filters: SectionListFilters): Promise<void> {
    this._sectionFilters.set({ ...filters });
    /* {@code search} es client-side: si solo cambió ese campo,
     * no necesitamos pegarle al backend. Comparamos el resto de
     * filtros con el snapshot anterior. */
    await this.loadSections();
  }

  /** Solo actualiza el filtro de búsqueda local (no toca backend). */
  setSectionSearch(search: string | undefined): void {
    this._sectionFilters.update((f) => ({ ...f, search }));
  }

  async loadSections(): Promise<void> {
    this._loadingSections.set(true);
    this._error.set(null);

    try {
      const f = this._sectionFilters();
      const rows = await firstValueFrom(
        this.api.listSections({
          academicYearPublicUuid: f.academicYearPublicUuid,
          gradePublicUuid: f.gradePublicUuid,
          levelPublicUuid: f.levelPublicUuid,
        }),
      );
      this._sections.set(this.sortSections(rows));
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._sections.set([]);
    } finally {
      this._loadingSections.set(false);
    }
  }

  async loadSectionDetail(publicUuid: string): Promise<SectionDetail | null> {
    this._loadingSectionDetail.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(this.api.getSection(publicUuid));
      this._selectedSection.set(detail);
      return detail;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._selectedSection.set(null);
      return null;
    } finally {
      this._loadingSectionDetail.set(false);
    }
  }

  async createSection(request: CreateSectionRequest): Promise<SectionDetail | null> {
    this._savingSection.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.createSection(request));
      this._selectedSection.set(created);
      this._sections.update((rows) => this.sortSections([this.toSectionRow(created), ...rows]));
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingSection.set(false);
    }
  }

  async updateSection(
    publicUuid: string,
    patch: UpdateSectionRequest,
  ): Promise<SectionDetail | null> {
    this._savingSection.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.updateSection(publicUuid, patch));
      this._selectedSection.set(updated);
      this._sections.update((rows) =>
        this.sortSections(
          rows.map((s) => (s.publicUuid === publicUuid ? this.toSectionRow(updated) : s)),
        ),
      );
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingSection.set(false);
    }
  }

  async deleteSection(publicUuid: string): Promise<boolean> {
    this._savingSection.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.deleteSection(publicUuid));
      this._sections.update((rows) => rows.filter((s) => s.publicUuid !== publicUuid));
      if (this._selectedSection()?.publicUuid === publicUuid) {
        this._selectedSection.set(null);
      }
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._savingSection.set(false);
    }
  }

  /**
   * Sugerencia de letra para el {@code name} de la próxima sección de
   * {@code (year, grade)}: A → B → C ... Si todas las letras ya
   * existen retorna {@code "A1"} como fallback (cliente puede editar).
   */
  suggestSectionName(yearUuid: string, gradeUuid: string): string {
    const taken = new Set(
      this._sections()
        .filter((s) => s.academicYearPublicUuid === yearUuid && s.gradePublicUuid === gradeUuid)
        .map((s) => s.name.trim().toUpperCase()),
    );
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!taken.has(letter)) return letter;
    }
    return 'A1';
  }

  // ===========================================================================
  // Courses ops (FE-4.4)
  // ===========================================================================

  /**
   * Aplica filtros server-side (level/isActive) y refetcha. La
   * búsqueda por texto se queda client-side y no dispara load.
   */
  async applyCourseFilters(filters: CourseListFilters): Promise<void> {
    this._courseFilters.set({ ...filters });
    await this.loadCourses();
  }

  /** Solo actualiza la búsqueda local (no toca backend). */
  setCourseSearch(search: string | undefined): void {
    this._courseFilters.update((f) => ({ ...f, search }));
  }

  async loadCourses(): Promise<void> {
    this._loadingCourses.set(true);
    this._error.set(null);

    try {
      const f = this._courseFilters();
      const rows = await firstValueFrom(
        this.api.listCourses({
          levelPublicUuid: f.levelPublicUuid,
          isActive: f.isActive,
        }),
      );
      this._courses.set(rows);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._courses.set([]);
    } finally {
      this._loadingCourses.set(false);
    }
  }

  async loadCourseDetail(publicUuid: string): Promise<CourseDetail | null> {
    this._loadingCourseDetail.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(this.api.getCourse(publicUuid));
      this._selectedCourse.set(detail);
      return detail;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._selectedCourse.set(null);
      return null;
    } finally {
      this._loadingCourseDetail.set(false);
    }
  }

  async createCourse(request: CreateCourseRequest): Promise<CourseDetail | null> {
    this._savingCourse.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.createCourse(request));
      this._selectedCourse.set(created);
      this._courses.update((rows) => this.sortCourses([this.toCourseRow(created), ...rows]));
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingCourse.set(false);
    }
  }

  /**
   * Update dual: si {@code request.patch} no está vacío, dispara
   * {@code PUT /courses/{uuid}}; si {@code request.levels} está
   * presente, dispara {@code POST /courses/{uuid}/levels}. El orden
   * coincide con el spec de FE-4.4 (PATCH escalar → POST levels).
   *
   * <p>El BE rechaza un PUT con body vacío con 400, así que omitimos
   * la primera llamada cuando no hay cambios escalares (caso "solo
   * cambié los chips de levels").</p>
   */
  async updateCourse(
    publicUuid: string,
    request: { patch?: UpdateCourseRequest; levels?: UpdateCourseLevelsRequest },
  ): Promise<CourseDetail | null> {
    this._savingCourse.set(true);
    this._error.set(null);

    try {
      let result: CourseDetail | null = null;
      if (request.patch && this.hasAnyValue(request.patch)) {
        result = await firstValueFrom(this.api.updateCourse(publicUuid, request.patch));
      }
      if (request.levels) {
        result = await firstValueFrom(this.api.replaceCourseLevels(publicUuid, request.levels));
      }
      if (!result) {
        /* No-op call (sin patch + sin levels). Devolvemos el detail
         * vigente sin tocar nada para que el caller no falle. */
        result = this._selectedCourse();
      }
      if (result) {
        this._selectedCourse.set(result);
        this._courses.update((rows) =>
          this.sortCourses(
            rows.map((c) => (c.publicUuid === publicUuid ? this.toCourseRow(result!) : c)),
          ),
        );
      }
      return result;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingCourse.set(false);
    }
  }

  /**
   * Toggle inline de {@code isActive} con UI optimista + rollback en
   * caso de fallo de red. Devuelve {@code true} si la mutación se
   * commiteó, {@code false} si hubo rollback.
   */
  async toggleCourseActive(publicUuid: string): Promise<boolean> {
    const before = this._courses().find((c) => c.publicUuid === publicUuid);
    if (!before) return false;
    const next = !before.isActive;

    /* Optimistic update. */
    this._courses.update((rows) =>
      rows.map((c) => (c.publicUuid === publicUuid ? { ...c, isActive: next } : c)),
    );

    try {
      const updated = await firstValueFrom(this.api.updateCourse(publicUuid, { isActive: next }));
      this._courses.update((rows) =>
        rows.map((c) => (c.publicUuid === publicUuid ? this.toCourseRow(updated) : c)),
      );
      if (this._selectedCourse()?.publicUuid === publicUuid) {
        this._selectedCourse.set(updated);
      }
      return true;
    } catch (err) {
      /* Rollback. */
      this._courses.update((rows) =>
        rows.map((c) => (c.publicUuid === publicUuid ? { ...c, isActive: before.isActive } : c)),
      );
      this._error.set(this.toErrorMessage(err));
      return false;
    }
  }

  async deleteCourse(publicUuid: string): Promise<boolean> {
    this._savingCourse.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.deleteCourse(publicUuid));
      this._courses.update((rows) => rows.filter((c) => c.publicUuid !== publicUuid));
      if (this._selectedCourse()?.publicUuid === publicUuid) {
        this._selectedCourse.set(null);
      }
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._savingCourse.set(false);
    }
  }

  // ===========================================================================
  // Periods ops (FE-4.5)
  // ===========================================================================

  async applyPeriodFilters(filters: AcademicPeriodListFilters): Promise<void> {
    this._periodFilters.set({ ...filters });
    await this.loadPeriods();
  }

  async loadPeriods(): Promise<void> {
    this._loadingPeriods.set(true);
    this._error.set(null);

    try {
      const f = this._periodFilters();
      const rows = await firstValueFrom(this.api.listPeriods(f));
      this._periods.set(this.sortPeriods(rows));
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._periods.set([]);
    } finally {
      this._loadingPeriods.set(false);
    }
  }

  async createPeriod(request: CreateAcademicPeriodRequest): Promise<AcademicPeriodDetail | null> {
    this._savingPeriod.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.createPeriod(request));
      this._periods.update((rows) => this.sortPeriods([this.toPeriodRow(created), ...rows]));
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingPeriod.set(false);
    }
  }

  async updatePeriod(
    publicUuid: string,
    patch: UpdateAcademicPeriodRequest,
  ): Promise<AcademicPeriodDetail | null> {
    this._savingPeriod.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.updatePeriod(publicUuid, patch));
      this._periods.update((rows) =>
        this.sortPeriods(
          rows.map((p) => (p.publicUuid === publicUuid ? this.toPeriodRow(updated) : p)),
        ),
      );
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._savingPeriod.set(false);
    }
  }

  async deletePeriod(publicUuid: string): Promise<boolean> {
    this._savingPeriod.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.deletePeriod(publicUuid));
      this._periods.update((rows) => rows.filter((p) => p.publicUuid !== publicUuid));
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._savingPeriod.set(false);
    }
  }

  /**
   * Materializa un {@code BulkPeriodPlan} con N {@code POST}s
   * secuenciales. Se publica el progreso en {@link #bulkProgress}
   * para que la UI muestre un spinner con "k/N". Si alguno falla, se
   * detiene y deja los previos creados (no es una transacción
   * distribuida — el tenant podrá reintentar el resto manualmente).
   *
   * <p>Devuelve {@code true} si todos los POSTs se aplicaron, o el
   * número del primero que falló (1-based) en caso contrario.</p>
   */
  async createPeriodsBulk(
    yearUuid: string,
    plan: ReadonlyArray<{
      ordinal: number;
      name: string;
      startDate: string;
      endDate: string;
      periodType: PeriodType;
    }>,
  ): Promise<{ success: boolean; failedAt?: number }> {
    if (plan.length === 0) return { success: true };

    this._error.set(null);
    this._bulkProgress.set({ current: 0, total: plan.length });

    try {
      for (let i = 0; i < plan.length; i++) {
        const part = plan[i];
        try {
          const created = await firstValueFrom(
            this.api.createPeriod({
              academicYearPublicUuid: yearUuid,
              periodType: part.periodType,
              ordinal: part.ordinal,
              name: part.name,
              startDate: part.startDate,
              endDate: part.endDate,
            }),
          );
          this._periods.update((rows) => this.sortPeriods([...rows, this.toPeriodRow(created)]));
        } catch (err) {
          this._error.set(this.toErrorMessage(err));
          return { success: false, failedAt: i + 1 };
        }
        this._bulkProgress.set({ current: i + 1, total: plan.length });
      }
      return { success: true };
    } finally {
      this._bulkProgress.set(null);
    }
  }

  /**
   * Sugerencia de ordinal: el siguiente entero contiguo para
   * {@code (year, type)}. Si no hay periodos previos retorna 1. Mira
   * solo los periodos cargados en memoria — se asume que la lista
   * está sincronizada con el backend para el {@code year} actual.
   */
  suggestPeriodOrdinal(yearUuid: string, type: PeriodType): number {
    const max = this._periods()
      .filter((p) => p.academicYearPublicUuid === yearUuid && p.periodType === type)
      .reduce((acc, p) => Math.max(acc, p.ordinal), 0);
    return max + 1;
  }

  clearError(): void {
    this._error.set(null);
  }

  reset(): void {
    this._years.set([]);
    this._yearFilters.set({});
    this._loadingYears.set(false);
    this._selectedYear.set(null);
    this._loadingYearDetail.set(false);
    this._savingYear.set(false);
    this._levels.set([]);
    this._selectedLevelId.set(null);
    this._loadingLevels.set(false);
    this._savingLevel.set(false);
    this._savingGrade.set(false);
    this.gradesSnapshot = null;
    this._sections.set([]);
    this._sectionFilters.set({});
    this._loadingSections.set(false);
    this._selectedSection.set(null);
    this._loadingSectionDetail.set(false);
    this._savingSection.set(false);
    this._courses.set([]);
    this._courseFilters.set({});
    this._loadingCourses.set(false);
    this._selectedCourse.set(null);
    this._loadingCourseDetail.set(false);
    this._savingCourse.set(false);
    this._periods.set([]);
    this._periodFilters.set({});
    this._loadingPeriods.set(false);
    this._savingPeriod.set(false);
    this._bulkProgress.set(null);
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private upsertYearRow(detail: AcademicYearDetail): void {
    this._years.update((rows) => {
      const idx = rows.findIndex((r) => r.publicUuid === detail.publicUuid);
      const next = rows.slice();
      const row = this.toYearRow(detail);
      if (idx < 0) {
        next.unshift(row);
      } else {
        next[idx] = row;
      }
      return this.sortRows(next);
    });
  }

  private toYearRow(detail: AcademicYearDetail): AcademicYearRow {
    return {
      publicUuid: detail.publicUuid,
      name: detail.name,
      status: detail.status,
      startDate: detail.startDate,
      endDate: detail.endDate,
    };
  }

  private upsertGrade(levelUuid: string, grade: Grade): void {
    this._levels.update((rows) =>
      rows.map((l) => {
        if (l.publicUuid !== levelUuid) return l;
        const idx = l.grades.findIndex((g) => g.publicUuid === grade.publicUuid);
        const grades =
          idx < 0 ? [...l.grades, grade] : l.grades.map((g, i) => (i === idx ? grade : g));
        return { ...l, grades: grades.sort((a, b) => a.ordinal - b.ordinal) };
      }),
    );
  }

  private sortLevels(levels: AcademicLevel[]): AcademicLevel[] {
    return levels.slice().sort((a, b) => {
      if (a.ordinal !== b.ordinal) return a.ordinal - b.ordinal;
      return a.name.localeCompare(b.name);
    });
  }

  private toSectionRow(detail: SectionDetail): SectionRow {
    return {
      publicUuid: detail.publicUuid,
      academicYearPublicUuid: detail.academicYearPublicUuid,
      academicYearName: detail.academicYearName,
      academicYearStatus: detail.academicYearStatus,
      gradePublicUuid: detail.gradePublicUuid,
      gradeName: detail.gradeName,
      gradeOrdinal: detail.gradeOrdinal,
      levelPublicUuid: detail.levelPublicUuid,
      levelCode: detail.levelCode,
      name: detail.name,
      capacity: detail.capacity,
      displayOrder: detail.displayOrder,
    };
  }

  /**
   * Orden estable: año (asc por nombre), grade ordinal asc, name asc.
   * Es el orden que la tabla muestra y es razonable para el listado
   * cuando hay múltiples años en pantalla (ej. filtro vacío).
   */
  private sortSections(rows: SectionRow[]): SectionRow[] {
    return rows.slice().sort((a, b) => {
      const yearCmp = a.academicYearName.localeCompare(b.academicYearName);
      if (yearCmp !== 0) return yearCmp;
      if (a.gradeOrdinal !== b.gradeOrdinal) return a.gradeOrdinal - b.gradeOrdinal;
      return a.name.localeCompare(b.name);
    });
  }

  private toCourseRow(detail: CourseDetail): CourseRow {
    return {
      publicUuid: detail.publicUuid,
      code: detail.code,
      name: detail.name,
      credits: detail.credits,
      hoursPerWeek: detail.hoursPerWeek,
      isActive: detail.isActive,
      levels: detail.levels,
    };
  }

  /** Orden por {@code name asc} (espejo del backend). */
  private sortCourses(rows: CourseRow[]): CourseRow[] {
    return rows.slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Heurística para "el patch tiene al menos un campo cambiado". Sin
   * esto el caller mandaría {@code PUT {}} (rejected con 400).
   */
  private hasAnyValue(patch: UpdateCourseRequest): boolean {
    return Object.values(patch).some((v) => v !== undefined);
  }

  private toPeriodRow(detail: AcademicPeriodDetail): AcademicPeriodRow {
    return {
      publicUuid: detail.publicUuid,
      academicYearPublicUuid: detail.academicYearPublicUuid,
      periodType: detail.periodType,
      ordinal: detail.ordinal,
      name: detail.name,
      startDate: detail.startDate,
      endDate: detail.endDate,
    };
  }

  /**
   * Orden estable: por {@code periodType} (Bimestre → Trimestre → Anual)
   * y luego por {@code ordinal asc}. Replica el {@code ORDER BY} del
   * backend para que la tabla y el timeline rendericen igual aunque
   * insertemos optimistamente antes del refresh.
   */
  private sortPeriods(rows: AcademicPeriodRow[]): AcademicPeriodRow[] {
    const typeOrder: Record<PeriodType, number> = {
      [PeriodType.Bimestre]: 0,
      [PeriodType.Trimestre]: 1,
      [PeriodType.Anual]: 2,
    };
    return rows.slice().sort((a, b) => {
      const t = typeOrder[a.periodType] - typeOrder[b.periodType];
      if (t !== 0) return t;
      return a.ordinal - b.ordinal;
    });
  }

  /**
   * Replica el orden del backend ({@code ACTIVE} primero, luego
   * {@code startDate} desc) para que la lista local se vea igual a
   * un re-fetch sin tener que hacerlo.
   */
  private sortRows(rows: AcademicYearRow[]): AcademicYearRow[] {
    const rank = (s: AcademicYearStatus): number => {
      switch (s) {
        case AcademicYearStatus.Active:
          return 0;
        case AcademicYearStatus.Planning:
          return 1;
        case AcademicYearStatus.Closed:
          return 2;
      }
    };
    return rows.slice().sort((a, b) => {
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return b.startDate.getTime() - a.startDate.getTime();
    });
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as { message?: unknown; error?: { message?: unknown } };
      if (typeof anyErr.error?.message === 'string') return anyErr.error.message;
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'Ocurrió un error inesperado.';
  }
}

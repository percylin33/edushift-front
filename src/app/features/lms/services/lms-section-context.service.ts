import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import { formatSectionDisplayLabel } from '@features/academic/models';
import { AcademicApiService } from '@features/academic/services';
import { AssignmentRow } from '@features/teachers/models';
import { TeachersApiService } from '@features/teachers/services';

/** Section entry for the LMS section switcher. */
export interface LmsSectionOption {
  publicUuid: string;
  label: string;
}

/** Course (materia) card for the Mis cursos picker. */
export interface LmsCourseOption {
  coursePublicUuid: string;
  courseName: string;
  courseCode: string;
  sectionCount: number;
  color?: string | null;
  icon?: string | null;
}

/** Section card for a chosen materia. */
export interface LmsCourseSectionOption {
  sectionPublicUuid: string;
  label: string;
  assignmentPublicUuid: string;
  academicPeriodPublicUuid: string;
}

/**
 * Resolves which sections the current user may browse in the LMS shell.
 *
 * <p>TEACHER → unique sections from active {@code TeacherAssignment} rows.
 * TENANT_ADMIN → all ACTIVE-year sections in the tenant (same as landing
 * resolver before this service existed).</p>
 */
@Injectable({ providedIn: 'root' })
export class LmsSectionContextService {
  private readonly auth = inject(AuthService);
  private readonly teachersApi = inject(TeachersApiService);
  private readonly academicApi = inject(AcademicApiService);

  /** Active teacher assignments for the caller (empty for TENANT_ADMIN-only). */
  async loadMyAssignments(): Promise<AssignmentRow[]> {
    if (!this.auth.hasRole(UserRole.Teacher)) {
      return [];
    }
    try {
      return await firstValueFrom(this.teachersApi.listMyAssignments({ active: true }));
    } catch {
      return [];
    }
  }

  /** Sections available in the LMS section switcher for the current user. */
  async loadSectionOptions(): Promise<LmsSectionOption[]> {
    const sections = await firstValueFrom(this.academicApi.listSections());
    const activeSections = sections.filter((s) => s.academicYearStatus === 'ACTIVE');
    const sectionByUuid = new Map(activeSections.map((s) => [s.publicUuid, s]));

    if (this.auth.hasRole(UserRole.Teacher) && !this.auth.hasRole(UserRole.TenantAdmin)) {
      const assignments = await this.loadMyAssignments();
      return this.#uniqueSectionsFromAssignments(assignments, sectionByUuid);
    }

    return activeSections
      .sort((a, b) => {
        const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
        const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.name.localeCompare(b.name, 'es');
      })
      .map((s) => ({
        publicUuid: s.publicUuid,
        label: formatSectionDisplayLabel(s.name, s.gradeName),
      }));
  }

  /**
   * Preferred first section for {@code /lms} landing redirect.
   * TEACHER → first assigned section; admin → first tenant section.
   */
  async resolveDefaultSectionUuid(): Promise<string | null> {
    const options = await this.loadSectionOptions();
    return options[0]?.publicUuid ?? null;
  }

  /** Assignments filtered to a section (teacher self-service). */
  assignmentsForSection(assignments: AssignmentRow[], sectionUuid: string): AssignmentRow[] {
    return assignments.filter((a) => a.sectionPublicUuid === sectionUuid && a.active);
  }

  /** Unique materias from active assignments, sorted by name. */
  groupCoursesFromAssignments(assignments: AssignmentRow[]): LmsCourseOption[] {
    const byCourse = new Map<string, LmsCourseOption & { sectionUuids: Set<string> }>();
    for (const a of assignments) {
      if (!a.active) continue;
      let entry = byCourse.get(a.coursePublicUuid);
      if (!entry) {
        entry = {
          coursePublicUuid: a.coursePublicUuid,
          courseName: a.courseName,
          courseCode: a.courseCode,
          color: a.courseColor ?? null,
          icon: a.courseIcon ?? null,
          sectionCount: 0,
          sectionUuids: new Set(),
        };
        byCourse.set(a.coursePublicUuid, entry);
      }
      entry.sectionUuids.add(a.sectionPublicUuid);
    }
    return [...byCourse.values()]
      .map(({ sectionUuids, ...rest }) => ({
        ...rest,
        sectionCount: sectionUuids.size,
      }))
      .sort((a, b) => a.courseName.localeCompare(b.courseName, 'es'));
  }

  /**
   * Sections where the teacher imparts {@code courseUuid}.
   * Prefers an assignment in {@code preferredPeriodUuid} when present.
   */
  async sectionsForCourse(
    courseUuid: string,
    preferredPeriodUuid: string | null = null,
  ): Promise<{ course: LmsCourseOption | null; sections: LmsCourseSectionOption[] }> {
    const assignments = (await this.loadMyAssignments()).filter(
      (a) => a.active && a.coursePublicUuid === courseUuid,
    );
    if (assignments.length === 0) {
      return { course: null, sections: [] };
    }

    const courses = this.groupCoursesFromAssignments(assignments);
    const course = courses[0] ?? null;

    const sections = await firstValueFrom(this.academicApi.listSections());
    const sectionByUuid = new Map(sections.map((s) => [s.publicUuid, s]));

    const bySection = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      const list = bySection.get(a.sectionPublicUuid) ?? [];
      list.push(a);
      bySection.set(a.sectionPublicUuid, list);
    }

    const options: LmsCourseSectionOption[] = [];
    for (const [sectionUuid, rows] of bySection) {
      const preferred =
        (preferredPeriodUuid
          ? rows.find((r) => r.academicPeriodPublicUuid === preferredPeriodUuid)
          : undefined) ??
        [...rows].sort((a, b) => a.periodOrdinal - b.periodOrdinal)[0]!;
      const section = sectionByUuid.get(sectionUuid);
      const label = section
        ? formatSectionDisplayLabel(section.name, section.gradeName)
        : preferred.sectionName;
      options.push({
        sectionPublicUuid: sectionUuid,
        label,
        assignmentPublicUuid: preferred.publicUuid,
        academicPeriodPublicUuid: preferred.academicPeriodPublicUuid,
      });
    }

    options.sort((a, b) => a.label.localeCompare(b.label, 'es'));
    return { course, sections: options };
  }

  /** Deep-link into the aula for a given assignment. */
  aulaUrlForAssignment(assignment: AssignmentRow): string {
    const path = ROUTES.LMS.sectionAssignments(assignment.sectionPublicUuid);
    return `${path}?assignment=${encodeURIComponent(assignment.publicUuid)}`;
  }

  /** Deep-link into Registros for a given assignment. */
  evaluationsUrlForAssignment(assignment: AssignmentRow | string): string {
    const uuid = typeof assignment === 'string' ? assignment : assignment.publicUuid;
    return ROUTES.EVALUATIONS.byAssignment(uuid);
  }

  #uniqueSectionsFromAssignments(
    assignments: AssignmentRow[],
    sectionByUuid: Map<string, { name: string; gradeName: string }>,
  ): LmsSectionOption[] {
    const seen = new Map<string, LmsSectionOption>();
    for (const a of assignments) {
      if (!a.active || seen.has(a.sectionPublicUuid)) continue;
      const section = sectionByUuid.get(a.sectionPublicUuid);
      const label = section
        ? formatSectionDisplayLabel(section.name, section.gradeName)
        : a.sectionName;
      seen.set(a.sectionPublicUuid, {
        publicUuid: a.sectionPublicUuid,
        label,
      });
    }
    return [...seen.values()].sort((x, y) => x.label.localeCompare(y.label, 'es'));
  }
}

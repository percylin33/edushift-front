import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Breadcrumb } from '@layout/models';
import { LmsSectionContextService } from '@features/lms/services/lms-section-context.service';

/** Breadcrumb = course name for `/evaluations/courses/:courseUuid/sections`. */
export const evaluationsCourseNameResolver: ResolveFn<string> = async (route) => {
  const courseUuid = route.paramMap.get('courseUuid');
  if (!courseUuid) return 'Materia';
  const ctx = inject(LmsSectionContextService);
  const assignments = await ctx.loadMyAssignments();
  const course = ctx
    .groupCoursesFromAssignments(assignments)
    .find((c) => c.coursePublicUuid === courseUuid);
  return course?.courseName ?? 'Materia';
};

/** Trail Materia → Sección (+ Libro if gradebook) for by-assignment routes. */
export const evaluationsAssignmentBreadcrumbsResolver: ResolveFn<Breadcrumb[]> = async (route) => {
  const assignmentUuid = route.paramMap.get('assignmentUuid');
  if (!assignmentUuid) return [];

  const ctx = inject(LmsSectionContextService);
  const [assignments, sectionOptions] = await Promise.all([
    ctx.loadMyAssignments(),
    ctx.loadSectionOptions(),
  ]);

  const match = assignments.find((a) => a.publicUuid === assignmentUuid);
  const isGradebook = route.routeConfig?.path?.includes('gradebook') ?? false;
  const crumbs: Breadcrumb[] = [];

  if (match) {
    crumbs.push({
      label: match.courseName,
      url: ROUTES.EVALUATIONS.courseSections(match.coursePublicUuid),
    });
    const sectionLabel =
      sectionOptions.find((o) => o.publicUuid === match.sectionPublicUuid)?.label ??
      match.sectionName;
    crumbs.push({
      label: sectionLabel,
      url: isGradebook ? ROUTES.EVALUATIONS.byAssignment(assignmentUuid) : null,
    });
    if (isGradebook) {
      crumbs.push({ label: 'Libro de calificaciones', url: null });
    }
    return crumbs;
  }

  crumbs.push({
    label: isGradebook ? 'Libro de calificaciones' : 'Asignación',
    url: null,
  });
  return crumbs;
};

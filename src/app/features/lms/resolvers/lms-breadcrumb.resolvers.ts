import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { ROUTES } from '@core/constants';
import { Breadcrumb } from '@layout/models';
import { LmsSectionContextService } from '../services/lms-section-context.service';

/** Breadcrumb label = course name for `/lms/courses/:courseUuid/sections`. */
export const lmsCourseNameResolver: ResolveFn<string> = async (route) => {
  const courseUuid = route.paramMap.get('courseUuid');
  if (!courseUuid) return 'Materia';
  const ctx = inject(LmsSectionContextService);
  const assignments = await ctx.loadMyAssignments();
  const course = ctx
    .groupCoursesFromAssignments(assignments)
    .find((c) => c.coursePublicUuid === courseUuid);
  return course?.courseName ?? 'Materia';
};

/**
 * Trail Materia → Sección for aula tabs
 * (`/lms/sections/:sectionUuid/{assignments|materials|quizzes}`).
 */
export const lmsAulaBreadcrumbsResolver: ResolveFn<Breadcrumb[]> = async (route) => {
  const sectionUuid = route.paramMap.get('sectionUuid');
  if (!sectionUuid) return [];

  const ctx = inject(LmsSectionContextService);
  const [assignments, sectionOptions] = await Promise.all([
    ctx.loadMyAssignments(),
    ctx.loadSectionOptions(),
  ]);

  const sectionLabel =
    sectionOptions.find((o) => o.publicUuid === sectionUuid)?.label ?? 'Sección';

  const assignmentUuid = route.queryParamMap.get('assignment');
  let courseName: string | null = null;
  let courseUuid: string | null = null;

  if (assignmentUuid) {
    const match = assignments.find((a) => a.publicUuid === assignmentUuid);
    if (match) {
      courseName = match.courseName;
      courseUuid = match.coursePublicUuid;
    }
  }
  if (!courseName) {
    const forSection = ctx.assignmentsForSection(assignments, sectionUuid);
    const first = forSection[0];
    if (first) {
      courseName = first.courseName;
      courseUuid = first.coursePublicUuid;
    }
  }

  const crumbs: Breadcrumb[] = [];
  if (courseName && courseUuid) {
    crumbs.push({
      label: courseName,
      url: ROUTES.LMS.courseSections(courseUuid),
    });
  }
  crumbs.push({ label: sectionLabel, url: null });
  return crumbs;
};

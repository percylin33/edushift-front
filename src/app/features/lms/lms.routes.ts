import { pendingChangesGuard } from '@shared/services/form-protection.service';
import { Routes } from '@angular/router';
import { permissionGuard, rejectReservedSegmentsCanMatch } from '@core/guards';
import { Permission } from '@core/enums';
import {
  lmsAulaBreadcrumbsResolver,
  lmsCourseNameResolver,
} from './resolvers/lms-breadcrumb.resolvers';

/**
 * Routes para el feature {@code lms} (Sprint 7a + 7b).
 *
 * <h3>Estructura</h3>
 * <ul>
 *   <li>{@code /lms}                                                → landing resolver (FE-7a.5 / BUG-2026-07-30-05).</li>
 *   <li>{@code /lms/courses}                                        → grilla de materias (funnel Mis cursos).</li>
 *   <li>{@code /lms/courses/:courseUuid/sections}                   → grilla de secciones de una materia.</li>
 *   <li>{@code /lms/sections/:sectionUuid/assignments}              → lista del TEACHER (LMS_TASK_READ).</li>
 *   <li>{@code /lms/students/:studentUuid/assignments}              → "Mis tareas" del STUDENT/PARENT (LMS_TASK_READ).</li>
 *   <li>{@code /lms/assignments/new?section=:sectionUuid}           → crear (LMS_TASK_CREATE).</li>
 *   <li>{@code /lms/assignments/:uuid}                              → detail (LMS_TASK_READ).</li>
 *   <li>{@code /lms/assignments/:uuid/edit}                         → editar DRAFT (LMS_TASK_CREATE).</li>
 *   <li>{@code /lms/assignments/:uuid/grade}                        → calificar entregas (LMS_TASK_GRADE) — page FE-7a.2.</li>
 *   <li>{@code /lms/assignments/:uuid/submit}                       → entregar (LMS_TASK_SUBMIT) — page FE-7a.2.</li>
 *   <li>{@code /lms/sections/:sectionUuid/materials}                → materiales de la sección (LMS_MATERIAL_READ) — page FE-7a.3.</li>
 *   <li>{@code /lms/sections/:sectionUuid/quizzes}                 → quizzes de la sección (LMS_QUIZ_READ) — page FE-7b.1.</li>
 *   <li>{@code /lms/quizzes/new?section=:sectionUuid}              → crear quiz (LMS_QUIZ_CREATE) — page FE-7b.1.</li>
 *   <li>{@code /lms/quizzes/:uuid}                                 → detalle de quiz (LMS_QUIZ_READ) — page FE-7b.1.</li>
 *   <li>{@code /lms/quizzes/:uuid/edit}                            → editar DRAFT (LMS_QUIZ_CREATE) — page FE-7b.1.</li>
 *   <li>{@code /lms/quizzes/:uuid/take}                            → tomar quiz (LMS_QUIZ_SUBMIT) — page FE-7b.2.</li>
 *   <li>{@code /lms/quizzes/:uuid/results}                         → resultados del quiz (LMS_QUIZ_GRADE) — page FE-7b.3.</li>
 *   <li>{@code /lms/quizzes/:uuid/grade}                           → cola de grading (LMS_QUIZ_GRADE) — page FE-7b.3.</li>
 * </ul>
 */
export const LMS_ROUTES: Routes = [
  // ---------------------------------------------------------------------------
  // Landing resolver (FE-7a.5 / BUG-2026-07-30-05).
  // ---------------------------------------------------------------------------
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/lms-landing/lms-landing.component').then((m) => m.LmsLandingComponent),
    data: { title: 'Aula virtual' },
  },
  // ---------------------------------------------------------------------------
  // Funnel Mis cursos: materias → secciones (fuera del shell de tabs).
  // ---------------------------------------------------------------------------
  {
    canDeactivate: [pendingChangesGuard],
    path: 'courses',
    canMatch: [permissionGuard],
    data: {
      permissions: Permission.LmsTaskRead,
      mode: 'any',
      title: 'Materias',
    },
    loadComponent: () =>
      import('./pages/lms-courses/lms-courses.component').then((m) => m.LmsCoursesComponent),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: 'courses/:courseUuid/sections',
    canMatch: [permissionGuard],
    resolve: { breadcrumb: lmsCourseNameResolver },
    data: {
      permissions: Permission.LmsTaskRead,
      mode: 'any',
      title: 'Secciones',
    },
    loadComponent: () =>
      import('./pages/lms-course-sections/lms-course-sections.component').then(
        (m) => m.LmsCourseSectionsComponent,
      ),
  },
  {
    canDeactivate: [pendingChangesGuard],
    path: '',
    canMatch: [permissionGuard],
    data: {
      permissions: Permission.LmsTaskRead,
      mode: 'any',
      title: 'Aula',
    },
    loadComponent: () =>
      import('./pages/lms-shell/lms-shell.component').then((m) => m.LmsShellComponent),
    children: [
      {
        canDeactivate: [pendingChangesGuard],
    path: 'sections/:sectionUuid/assignments',
        canMatch: [permissionGuard],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        resolve: { breadcrumbs: lmsAulaBreadcrumbsResolver },
        data: { permissions: Permission.LmsTaskRead, title: 'Tareas de la sección' },
        loadComponent: () =>
          import('./pages/tasks-list/tasks-list.component').then((m) => m.TasksListComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'students/:studentUuid/assignments',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsTaskRead, title: 'Mis tareas' },
        loadComponent: () =>
          import('./pages/tasks-list/tasks-list.component').then((m) => m.TasksListComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'assignments/new',
        canMatch: [permissionGuard],
        data: {
          permissions: Permission.LmsTaskCreate,
          title: 'Nueva tarea',
          breadcrumb: 'Nueva',
        },
        loadComponent: () =>
          import('./pages/task-form/task-form.component').then((m) => m.TaskFormComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'assignments/:uuid',
        canMatch: [rejectReservedSegmentsCanMatch(), permissionGuard],
        data: { permissions: Permission.LmsTaskRead, title: 'Detalle de tarea' },
        loadComponent: () =>
          import('./pages/task-detail/task-detail.component').then((m) => m.TaskDetailComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'assignments/:uuid/edit',
        canMatch: [permissionGuard],
        data: {
          permissions: Permission.LmsTaskCreate,
          title: 'Editar tarea',
          breadcrumb: 'Editar',
        },
        loadComponent: () =>
          import('./pages/task-form/task-form.component').then((m) => m.TaskFormComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'assignments/:uuid/grade',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsTaskGrade, title: 'Calificar entregas' },
        loadComponent: () =>
          import('./pages/submission-grade/submission-grade.component').then(
            (m) => m.SubmissionGradeComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'assignments/:uuid/submit',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsTaskSubmit, title: 'Entregar tarea' },
        loadComponent: () =>
          import('./pages/submission-submit/submission-submit.component').then(
            (m) => m.SubmissionSubmitComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'sections/:sectionUuid/materials',
        canMatch: [permissionGuard],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        resolve: { breadcrumbs: lmsAulaBreadcrumbsResolver },
        data: { permissions: Permission.LmsMaterialRead, title: 'Materiales' },
        loadComponent: () =>
          import('./pages/materials-list/materials-list.component').then(
            (m) => m.MaterialsListComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'sections/:sectionUuid/quizzes',
        canMatch: [permissionGuard],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        resolve: { breadcrumbs: lmsAulaBreadcrumbsResolver },
        data: { permissions: Permission.LmsQuizRead, title: 'Prácticas de la sección' },
        loadComponent: () =>
          import('./quiz/pages/quiz-list/quiz-list.page').then((m) => m.QuizListPageComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'quizzes/new',
        canMatch: [permissionGuard],
        data: {
          permissions: Permission.LmsQuizCreate,
          title: 'Nueva práctica',
          breadcrumb: 'Nueva práctica',
        },
        loadComponent: () =>
          import('./quiz/pages/quiz-form/quiz-form.page').then((m) => m.QuizFormPageComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'quizzes/:uuid',
        canMatch: [rejectReservedSegmentsCanMatch(), permissionGuard],
        data: { permissions: Permission.LmsQuizRead, title: 'Detalle de práctica' },
        loadComponent: () =>
          import('./quiz/pages/quiz-detail/quiz-detail.page').then(
            (m) => m.QuizDetailPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'quizzes/:uuid/edit',
        canMatch: [permissionGuard],
        data: {
          permissions: Permission.LmsQuizCreate,
          title: 'Editar práctica',
          breadcrumb: 'Editar',
        },
        loadComponent: () =>
          import('./quiz/pages/quiz-form/quiz-form.page').then((m) => m.QuizFormPageComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'quizzes/:uuid/take',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsQuizSubmit, title: 'Tomar práctica' },
        loadComponent: () =>
          import('./quiz/pages/quiz-take/quiz-take.page').then((m) => m.QuizTakePageComponent),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'quizzes/:uuid/results',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsQuizRead, title: 'Resultados de la práctica' },
        loadComponent: () =>
          import('./quiz/pages/quiz-results/quiz-results.page').then(
            (m) => m.QuizResultsPageComponent,
          ),
      },
      {
        canDeactivate: [pendingChangesGuard],
    path: 'quizzes/:uuid/grade',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsQuizGrade, title: 'Cola de grading' },
        loadComponent: () =>
          import('./quiz/pages/quiz-grade/quiz-grade.page').then((m) => m.QuizGradePageComponent),
      },
    ],
  },
];

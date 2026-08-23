import { Routes } from '@angular/router';
import { permissionGuard } from '@core/guards';
import { Permission } from '@core/enums';

/**
 * Routes para el feature {@code lms} (Sprint 7a + 7b).
 *
 * <h3>Estructura</h3>
 * <ul>
 *   <li>{@code /lms}                                                → landing resolver (FE-7a.5 / BUG-2026-07-30-05) que
 *       redirige a la primera sección real del tenant (o /me/courses
 *       para STUDENT, /family para PARENT).</li>
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
 *
 * <h3>RBAC (FE-7a.4 / FE-7b.0)</h3>
 * El coarse-grain gate (entrar al LMS shell) lo aplica
 * {@code permissionGuard} con {@code Permission.LmsTaskRead} en la
 * ruta padre; la granularidad fina (LMS_TASK_CREATE / GRADE / SUBMIT /
 * LMS_MATERIAL_* / LMS_QUIZ_*) la aplican los {@code permissionGuard}
 * hijos. Usamos {@code canMatch} en vez de {@code canActivate} para
 * que el bundle lazy-loaded de la ruta prohibida NUNCA se descargue
 * en el cliente (rationale en {@code permissionGuard}).
 *
 * <h3>Estado de implementación</h3>
 * FE-7a.1 entrega los componentes de {@code tasks} (lista, form,
 * detail). FE-7a.2 (submissions) y FE-7a.3 (materials) están cerrados.
 * FE-7b.0 entrega la infra RBAC + rutas; FE-7b.1 (builder — list +
 * form + detail) ya está cerrado; FE-7b.2 (player) y FE-7b.3
 * (results) son tickets siguientes; FE-7b.4 (AI assistant stub) se
 * ata al builder.
 */
export const LMS_ROUTES: Routes = [
  // ---------------------------------------------------------------------------
  // Landing resolver (FE-7a.5 / BUG-2026-07-30-05).
  //
  // This route is reachable by ANY authenticated role (no LMS_TASK_READ
  // guard) because its job is precisely to figure out where the user
  // should land:
  //   - STUDENT → /me/courses
  //   - PARENT  → /family
  //   - others  → first ACTIVE section's assignments list
  // Putting the guard here would 403 STUDENT/PARENT before the resolver
  // can redirect them to a different, role-appropriate page.
  // ---------------------------------------------------------------------------
  {
    path: '',
    loadComponent: () =>
      import('./pages/lms-landing/lms-landing.component').then((m) => m.LmsLandingComponent),
    data: { title: 'Aula virtual', breadcrumb: 'Aula virtual' },
  },
  {
    path: '',
    canMatch: [permissionGuard],
    data: {
      // Coarse-grain gate: any role holding LMS_TASK_READ enters the LMS
      // shell. Granular per-action checks live on the child routes below
      // (LMS_TASK_CREATE / LMS_TASK_GRADE / LMS_TASK_SUBMIT / LMS_MATERIAL_*
      // / LMS_QUIZ_*). `canMatch` (vs `canActivate`) prevents the LMS bundle
      // from being fetched by roles that don't have any LMS authority —
      // e.g. STAFF or SUPER_ADMIN.
      permissions: Permission.LmsTaskRead,
      mode: 'any',
      title: 'Aula virtual',
      breadcrumb: 'Aula virtual',
    },
    loadComponent: () =>
      import('./pages/lms-shell/lms-shell.component').then((m) => m.LmsShellComponent),
    children: [
      {
        path: 'sections/:sectionUuid/assignments',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsTaskRead, title: 'Tareas de la sección' },
        loadComponent: () =>
          import('./pages/tasks-list/tasks-list.component').then((m) => m.TasksListComponent),
      },
      {
        path: 'students/:studentUuid/assignments',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsTaskRead, title: 'Mis tareas' },
        loadComponent: () =>
          import('./pages/tasks-list/tasks-list.component').then((m) => m.TasksListComponent),
      },
      {
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
        path: 'assignments/:uuid',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsTaskRead, title: 'Detalle de tarea' },
        loadComponent: () =>
          import('./pages/task-detail/task-detail.component').then((m) => m.TaskDetailComponent),
      },
      {
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
        path: 'assignments/:uuid/grade',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsTaskGrade, title: 'Calificar entregas' },
        loadComponent: () =>
          import('./pages/submission-grade/submission-grade.component').then(
            (m) => m.SubmissionGradeComponent,
          ),
      },
      {
        path: 'assignments/:uuid/submit',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsTaskSubmit, title: 'Entregar tarea' },
        loadComponent: () =>
          import('./pages/submission-submit/submission-submit.component').then(
            (m) => m.SubmissionSubmitComponent,
          ),
      },
      {
        path: 'sections/:sectionUuid/materials',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsMaterialRead, title: 'Materiales' },
        loadComponent: () =>
          import('./pages/materials-list/materials-list.component').then(
            (m) => m.MaterialsListComponent,
          ),
      },
      // -------------------------------------------------------------------------
      // Quiz routes (Sprint 7b). FE-7b.0 entregó los placeholders + RBAC;
      // FE-7b.1 reemplaza list / form / detail con componentes reales;
      // FE-7b.2 (player), FE-7b.3 (results + grade queue) llegan después.
      // Permisos `LMS_QUIZ_*` ya extendidos en `permission.enum.ts`.
      // -------------------------------------------------------------------------
      {
        path: 'sections/:sectionUuid/quizzes',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsQuizRead, title: 'Quizzes de la sección' },
        loadComponent: () =>
          import('./quiz/pages/quiz-list/quiz-list.page').then((m) => m.QuizListPageComponent),
      },
      {
        path: 'quizzes/new',
        canMatch: [permissionGuard],
        data: {
          permissions: Permission.LmsQuizCreate,
          title: 'Nuevo quiz',
          breadcrumb: 'Nuevo quiz',
        },
        loadComponent: () =>
          import('./quiz/pages/quiz-form/quiz-form.page').then((m) => m.QuizFormPageComponent),
      },
      {
        path: 'quizzes/:uuid',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsQuizRead, title: 'Detalle de quiz' },
        loadComponent: () =>
          import('./quiz/pages/quiz-detail/quiz-detail.page').then(
            (m) => m.QuizDetailPageComponent,
          ),
      },
      {
        path: 'quizzes/:uuid/edit',
        canMatch: [permissionGuard],
        data: {
          permissions: Permission.LmsQuizCreate,
          title: 'Editar quiz',
          breadcrumb: 'Editar',
        },
        loadComponent: () =>
          import('./quiz/pages/quiz-form/quiz-form.page').then((m) => m.QuizFormPageComponent),
      },
      {
        path: 'quizzes/:uuid/take',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsQuizSubmit, title: 'Tomar quiz' },
        loadComponent: () =>
          import('./quiz/pages/quiz-take/quiz-take.page').then((m) => m.QuizTakePageComponent),
      },
      {
        path: 'quizzes/:uuid/results',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsQuizRead, title: 'Resultados del quiz' },
        loadComponent: () =>
          import('./quiz/pages/quiz-results/quiz-results.page').then(
            (m) => m.QuizResultsPageComponent,
          ),
      },
      {
        path: 'quizzes/:uuid/grade',
        canMatch: [permissionGuard],
        data: { permissions: Permission.LmsQuizGrade, title: 'Cola de grading' },
        loadComponent: () =>
          import('./quiz/pages/quiz-grade/quiz-grade.page').then((m) => m.QuizGradePageComponent),
      },
    ],
  },
];

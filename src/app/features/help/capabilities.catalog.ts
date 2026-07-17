import { Capability, RoleKey } from './models/qa.model';

const BUG_REPORTS_PATH = '/v1/qa/bug-reports';

const SA = 'super-admin' as const;
const TA = 'tenant-admin' as const;
const TE = 'teacher' as const;
const ST = 'student' as const;
const PA = 'parent' as const;
const SF = 'staff' as const;

export const ROLES: ReadonlyArray<{ key: RoleKey; title: string; subtitle: string }> = [
  { key: SA, title: 'SUPER_ADMIN', subtitle: 'Operaciones cross-tenant, planes, impersonación.' },
  { key: TA, title: 'TENANT_ADMIN', subtitle: 'Administración del colegio: usuarios, académico, asistencia.' },
  { key: TE, title: 'TEACHER', subtitle: 'Sesiones, asistencia, evaluaciones, LMS.' },
  { key: ST, title: 'STUDENT', subtitle: 'Mi panel, evaluaciones, QR, materiales.' },
  { key: PA, title: 'PARENT', subtitle: 'Ver hijos, justificar, calificaciones, pagos.' },
  { key: SF, title: 'STAFF', subtitle: 'Pagos, reportes operativos, delegadas.' },
];

/**
 * Single source of truth for QA capabilities in the Centro de Pruebas.
 *
 * <p>Convention: {@code capabilityId = '<roleKey>.<modulo>.<accion>'}.</p>
 *
 * <h3>Safety defaults</h3>
 * <ul>
 *   <li>{@code autoExecute: true} is reserved for GETs + dev-bypass calls.
 *       All mutations stay manual unless explicitly opted in.</li>
 *   <li>Statuses are best-effort snapshots — re-validate after BE changes.</li>
 * </ul>
 */
export const CAPABILITIES: ReadonlyArray<Capability> = [
  // ---------------- SUPER_ADMIN ----------------
  {
    id: 'sa.login.mfa-enrol',
    roleKey: SA,
    title: 'Login + enrolamiento MFA (TOTP)',
    summary: 'Acceder como SUPER_ADMIN y enrolar TOTP.',
    group: 'auth',
    status: 'live',
    steps: [
      {
        id: 'login',
        label: 'Login SUPER_ADMIN',
        description: 'POST /admin/login con credenciales válidas.',
        endpoint: { method: 'POST', path: '/admin/login' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 401] },
        defaultPayload: { email: 'super@edushift.pe', password: 'SuperAdmin2026!' },
      },
      {
        id: 'dev-mfa',
        label: 'Bypass MFA dev',
        description: 'POST /admin/dev/complete-mfa para abrir sesión en entorno dev.',
        endpoint: { method: 'POST', path: '/admin/dev/complete-mfa' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
        defaultPayload: {},
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.dashboard.kpis',
    roleKey: SA,
    title: 'Dashboard KPIs cross-tenant',
    summary: 'Indicadores globales de la plataforma.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'kpis',
        label: 'GET /admin/dashboard/kpis',
        description: 'Cargar KPIs agregados.',
        endpoint: { method: 'GET', path: '/admin/dashboard/kpis' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.dashboard.revenue-trend',
    roleKey: SA,
    title: 'Tendencia de revenue mensual',
    summary: 'Serie temporal de ingresos.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'trend',
        label: 'GET /admin/dashboard/revenue-trend',
        description: 'Cargar tendencia de revenue.',
        endpoint: { method: 'GET', path: '/admin/dashboard/revenue-trend' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.dashboard.active-tenants',
    roleKey: SA,
    title: 'Tendencia de tenants activos',
    summary: 'Serie temporal de tenants activos.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'active',
        label: 'GET /admin/dashboard/active-tenants',
        description: 'Cargar tendencia de tenants activos.',
        endpoint: { method: 'GET', path: '/admin/dashboard/active-tenants' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.dashboard.plan-distribution',
    roleKey: SA,
    title: 'Distribución de planes',
    summary: 'Conteo de tenants por plan.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'distribution',
        label: 'GET /admin/dashboard/plan-distribution',
        description: 'Cargar distribución de planes.',
        endpoint: { method: 'GET', path: '/admin/dashboard/plan-distribution' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.dashboard.top-tenants',
    roleKey: SA,
    title: 'Top N tenants por revenue',
    summary: 'Ranking de los N tenants con más revenue.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'top',
        label: 'GET /admin/dashboard/top-tenants',
        description: 'Cargar top tenants.',
        endpoint: { method: 'GET', path: '/admin/dashboard/top-tenants' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.dashboard.collection-vs-overdue',
    roleKey: SA,
    title: 'Collection vs overdue',
    summary: 'Indicadores de cobranza.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'collection',
        label: 'GET /admin/dashboard/collection-vs-overdue',
        description: 'Cargar collection vs overdue.',
        endpoint: { method: 'GET', path: '/admin/dashboard/collection-vs-overdue' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.dashboard.students-by-plan',
    roleKey: SA,
    title: 'Estudiantes por plan',
    summary: 'Conteo de estudiantes agrupado por plan.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'students-plan',
        label: 'GET /admin/dashboard/students-by-plan',
        description: 'Cargar estudiantes por plan.',
        endpoint: { method: 'GET', path: '/admin/dashboard/students-by-plan' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.tenants.list-with-filters',
    roleKey: SA,
    title: 'Listar tenants con filtros',
    summary: 'Lista paginada con search/status/plan.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'list',
        label: 'GET /admin/tenants',
        description: 'Listar tenants con query params.',
        endpoint: { method: 'GET', path: '/admin/tenants?page=0&size=20' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.tenants.detail',
    roleKey: SA,
    title: 'Detalle de tenant',
    summary: 'Detalle completo por publicUuid.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'detail',
        label: 'GET /admin/tenants/{uuid}',
        description: 'Cargar detalle de un tenant.',
        endpoint: { method: 'GET', path: '/admin/tenants/00000000-0000-0000-0000-000000000000' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 404] },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.tenants.suspend',
    roleKey: SA,
    title: 'Suspender tenant',
    summary: 'Cambia el estado a SUSPENDED.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'suspend',
        label: 'POST /admin/tenants/{uuid}/suspend',
        description: 'Suspender tenant — requiere confirmación humana.',
        endpoint: { method: 'POST', path: '/admin/tenants/00000000-0000-0000-0000-000000000000/suspend' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la suspensión del tenant. Esta acción afecta a todos los usuarios.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.tenants.reactivate',
    roleKey: SA,
    title: 'Reactivar tenant',
    summary: 'Cambia el estado a ACTIVE.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'reactivate',
        label: 'POST /admin/tenants/{uuid}/reactivate',
        description: 'Reactivar tenant — confirmar.',
        endpoint: { method: 'POST', path: '/admin/tenants/00000000-0000-0000-0000-000000000000/reactivate' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la reactivación del tenant.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.impersonation.start',
    roleKey: SA,
    title: 'Iniciar impersonación',
    summary: 'Genera un token de impersonación para soporte.',
    group: 'auth',
    status: 'live',
    steps: [
      {
        id: 'impersonate',
        label: 'POST /admin/impersonate/token',
        description: 'Impersonar a un user (JWT real).',
        endpoint: { method: 'POST', path: '/admin/impersonate/token' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la impersonación. Se registrará en auditoría.',
        },
        defaultPayload: { userId: '00000000-0000-0000-0000-000000000000' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sa.audit.view',
    roleKey: SA,
    title: 'Ver log de auditoría cross-tenant',
    summary: 'Búsqueda de eventos en audit_logs.',
    group: 'system',
    status: 'partial',
    steps: [
      {
        id: 'search',
        label: 'GET /admin/audit',
        description: 'Cargar eventos de auditoría.',
        endpoint: { method: 'GET', path: '/admin/audit?page=0&size=20' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },

  // ---------------- TENANT_ADMIN ----------------
  {
    id: 'ta.login.tenant-header',
    roleKey: TA,
    title: 'Login con X-Tenant-Slug',
    summary: 'Auth requiere header X-Tenant-Slug.',
    group: 'auth',
    status: 'live',
    steps: [
      {
        id: 'login',
        label: 'POST /auth/login',
        description: 'Login con email/password y X-Tenant-Slug.',
        endpoint: { method: 'POST', path: '/auth/login' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 401] },
        defaultPayload: { email: 'admin@demo.pe', password: 'Demo2026!' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'ta.users.invite-teacher',
    roleKey: TA,
    title: 'Invitar docente',
    summary: 'Enviar invitación a un docente.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'invite',
        label: 'POST /users/invitations',
        description: 'Crear invitación para un teacher.',
        endpoint: { method: 'POST', path: '/users/invitations' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la invitación. Se enviará email.',
        },
        defaultPayload: {
          email: `qa-${Date.now()}@edushift.pe`,
          firstName: 'QA',
          lastName: 'Teacher',
          roles: ['TEACHER'],
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'ta.users.invite-student',
    roleKey: TA,
    title: 'Invitar estudiante',
    summary: 'Enviar invitación a un estudiante.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'invite',
        label: 'POST /users/invitations',
        description: 'Crear invitación para un student.',
        endpoint: { method: 'POST', path: '/users/invitations' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la invitación. Se enviará email.',
        },
        defaultPayload: {
          email: `qa-student-${Date.now()}@edushift.pe`,
          firstName: 'QA',
          lastName: 'Student',
          roles: ['STUDENT'],
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'ta.users.invite-parent',
    roleKey: TA,
    title: 'Invitar padre/madre',
    summary: 'Enviar invitación a un parent.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'invite',
        label: 'POST /users/invitations',
        description: 'Crear invitación para un parent.',
        endpoint: { method: 'POST', path: '/users/invitations' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la invitación.',
        },
        defaultPayload: {
          email: `qa-parent-${Date.now()}@edushift.pe`,
          firstName: 'QA',
          lastName: 'Parent',
          roles: ['PARENT'],
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'ta.users.invite-staff',
    roleKey: TA,
    title: 'Invitar personal',
    summary: 'Enviar invitación a un STAFF (sin endpoint dedicado hoy).',
    group: 'system',
    status: 'planned',
    steps: [
      {
        id: 'manual',
        label: 'Sin endpoint',
        description: 'No existe endpoint dedicado para STAFF; el rol se asigna por invitación genérica.',
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Reportar como faltante: invitar STAFF con rol LMS_PAYMENT_ADMIN u operativos.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'ta.users.roles',
    roleKey: TA,
    title: 'Asignar roles LMS_* delegados',
    summary: 'Otorgar permisos LMS delegados.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'assign',
        label: 'PATCH /users/{id}/roles',
        description: 'Asignar un rol LMS delegado.',
        endpoint: { method: 'PATCH', path: '/users/00000000-0000-0000-0000-000000000000/roles' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma el cambio de rol.',
        },
        defaultPayload: { roles: ['LMS_PAYMENT_ADMIN'] },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'ta.academic.years',
    roleKey: TA,
    title: 'CRUD años académicos',
    summary: 'Crear / listar / editar años académicos.',
    group: 'academic',
    status: 'live',
    steps: [
      {
        id: 'list',
        label: 'GET /academic/years',
        description: 'Listar años académicos.',
        endpoint: { method: 'GET', path: '/academic/years' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'ta.academic.levels',
    roleKey: TA,
    title: 'CRUD niveles y grados',
    summary: 'Crear / listar / editar niveles y grados.',
    group: 'academic',
    status: 'live',
    steps: [
      {
        id: 'list',
        label: 'GET /academic/levels',
        description: 'Listar niveles.',
        endpoint: { method: 'GET', path: '/academic/levels' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'ta.dashboard.tenant',
    roleKey: TA,
    title: 'Dashboard del colegio',
    summary: 'KPIs tenant-scoped.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'kpis',
        label: 'GET /dashboard/tenant',
        description: 'Cargar KPIs del colegio actual.',
        endpoint: { method: 'GET', path: '/dashboard/tenant' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },

  // ---------------- TEACHER ----------------
  {
    id: 'te.login.mfa',
    roleKey: TE,
    title: 'Login TEACHER (sin header)',
    summary: 'Auth estándar con tenant header.',
    group: 'auth',
    status: 'live',
    steps: [
      {
        id: 'login',
        label: 'POST /auth/login',
        description: 'Login TEACHER.',
        endpoint: { method: 'POST', path: '/auth/login' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 401] },
        defaultPayload: { email: 'teacher@demo.pe', password: 'Demo2026!' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'te.dashboard',
    roleKey: TE,
    title: 'Panel del docente',
    summary: 'Vista de inicio.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'kpis',
        label: 'GET /dashboard/teacher',
        description: 'Cargar panel del docente.',
        endpoint: { method: 'GET', path: '/dashboard/teacher' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 404] },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'te.sessions.create',
    roleKey: TE,
    title: 'Crear sesión de aprendizaje',
    summary: 'POST /learning-sessions.',
    group: 'academic',
    status: 'live',
    steps: [
      {
        id: 'create',
        label: 'POST /learning-sessions',
        description: 'Crear sesión.',
        endpoint: { method: 'POST', path: '/learning-sessions' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la creación de la sesión.',
        },
        defaultPayload: {
          assignmentId: '00000000-0000-0000-0000-000000000000',
          date: new Date().toISOString().slice(0, 10),
          topic: 'QA',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'te.attendance.start',
    roleKey: TE,
    title: 'Iniciar asistencia (generar QR)',
    summary: 'POST /attendance/sessions/{id}/start.',
    group: 'attendance',
    status: 'live',
    steps: [
      {
        id: 'start',
        label: 'POST /attendance/sessions/{id}/start',
        description: 'Iniciar asistencia.',
        endpoint: { method: 'POST', path: '/attendance/sessions/00000000-0000-0000-0000-000000000000/start' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma el inicio de la asistencia.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'te.attendance.scan',
    roleKey: TE,
    title: 'Escanear QR de estudiante',
    summary: 'POST /attendance/scan.',
    group: 'attendance',
    status: 'live',
    steps: [
      {
        id: 'scan',
        label: 'POST /attendance/scan',
        description: 'Registrar escaneo.',
        endpoint: { method: 'POST', path: '/attendance/scan' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma el escaneo.',
        },
        defaultPayload: { qrToken: 'qa-token' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'te.evaluations.create',
    roleKey: TE,
    title: 'Crear evaluación con rúbrica',
    summary: 'POST /evaluations.',
    group: 'evaluations',
    status: 'live',
    steps: [
      {
        id: 'create',
        label: 'POST /evaluations',
        description: 'Crear evaluación.',
        endpoint: { method: 'POST', path: '/evaluations' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la creación de la evaluación.',
        },
        defaultPayload: { title: 'QA Eval', courseId: '00000000-0000-0000-0000-000000000000' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'te.lms.materials.upload',
    roleKey: TE,
    title: 'Publicar material en curso',
    summary: 'POST /materials.',
    group: 'lms',
    status: 'live',
    steps: [
      {
        id: 'upload',
        label: 'POST /materials',
        description: 'Publicar material.',
        endpoint: { method: 'POST', path: '/materials' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la subida del material.',
        },
        defaultPayload: { title: 'QA Material', courseId: '00000000-0000-0000-0000-000000000000' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'te.ai.assistant',
    roleKey: TE,
    title: 'Asistente IA (beta)',
    summary: 'POST /ai/chat.',
    group: 'lms',
    status: 'live',
    steps: [
      {
        id: 'chat',
        label: 'POST /ai/chat',
        description: 'Preguntar al asistente IA.',
        endpoint: { method: 'POST', path: '/ai/chat' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma el envío al asistente IA (consume cuota).',
        },
        defaultPayload: { prompt: 'Hola, ¿qué puedes hacer?' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },

  // ---------------- STUDENT ----------------
  {
    id: 'st.login.mfa',
    roleKey: ST,
    title: 'Login STUDENT',
    summary: 'Auth con tenant header.',
    group: 'auth',
    status: 'live',
    steps: [
      {
        id: 'login',
        label: 'POST /auth/login',
        description: 'Login STUDENT.',
        endpoint: { method: 'POST', path: '/auth/login' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 401] },
        defaultPayload: { email: 'student@demo.pe', password: 'Demo2026!' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'st.dashboard',
    roleKey: ST,
    title: 'Mi panel',
    summary: 'Vista de inicio del estudiante.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'kpis',
        label: 'GET /dashboard/student',
        description: 'Cargar panel del estudiante.',
        endpoint: { method: 'GET', path: '/dashboard/student' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 404] },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'st.attendance.scan',
    roleKey: ST,
    title: 'Escanear QR de asistencia',
    summary: 'POST /attendance/scan como STUDENT.',
    group: 'attendance',
    status: 'live',
    steps: [
      {
        id: 'scan',
        label: 'POST /attendance/scan',
        description: 'Registrar QR propio.',
        endpoint: { method: 'POST', path: '/attendance/scan' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma el escaneo del QR.',
        },
        defaultPayload: { qrToken: 'qa-token' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'st.quizzes.take',
    roleKey: ST,
    title: 'Tomar quiz',
    summary: 'POST /quizzes/{id}/attempt.',
    group: 'evaluations',
    status: 'live',
    steps: [
      {
        id: 'start',
        label: 'POST /quizzes/{id}/attempt',
        description: 'Iniciar intento.',
        endpoint: { method: 'POST', path: '/quizzes/00000000-0000-0000-0000-000000000000/attempt' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma el intento del quiz.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'st.assignments.submit',
    roleKey: ST,
    title: 'Entregar tarea',
    summary: 'POST /tasks/{id}/submit.',
    group: 'lms',
    status: 'live',
    steps: [
      {
        id: 'submit',
        label: 'POST /tasks/{id}/submit',
        description: 'Entregar tarea.',
        endpoint: { method: 'POST', path: '/tasks/00000000-0000-0000-0000-000000000000/submit' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la entrega.',
        },
        defaultPayload: { fileUrl: 'qa://noop' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },

  // ---------------- PARENT ----------------
  {
    id: 'pa.login.mfa',
    roleKey: PA,
    title: 'Login PARENT',
    summary: 'Auth con tenant header.',
    group: 'auth',
    status: 'live',
    steps: [
      {
        id: 'login',
        label: 'POST /auth/login',
        description: 'Login PARENT.',
        endpoint: { method: 'POST', path: '/auth/login' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 401] },
        defaultPayload: { email: 'parent@demo.pe', password: 'Demo2026!' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'pa.children.view',
    roleKey: PA,
    title: 'Ver mis hijos vinculados',
    summary: 'Sin controller propio todavía.',
    group: 'system',
    status: 'planned',
    steps: [
      {
        id: 'manual',
        label: 'Sin endpoint',
        description: 'Reportar como faltante: GET /family/children.',
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Reportar como faltante.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'pa.attendace.justify',
    roleKey: PA,
    title: 'Justificar inasistencia de mi hijo',
    summary: 'Endpoint por confirmar.',
    group: 'attendance',
    status: 'planned',
    steps: [
      {
        id: 'manual',
        label: 'Sin endpoint',
        description: 'Reportar como faltante.',
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Reportar como faltante.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'pa.grades.view',
    roleKey: PA,
    title: 'Ver calificaciones agregadas',
    summary: 'Sin controller dedicado — usar /students/{uuid}/grades.',
    group: 'evaluations',
    status: 'planned',
    steps: [
      {
        id: 'manual',
        label: 'GET /students/{uuid}/grades',
        description: 'Requiere uuid de un hijo vinculado.',
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Reportar como faltante: no existe endpoint dedicado para PARENT.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'pa.announcements.read',
    roleKey: PA,
    title: 'Leer anuncios del colegio',
    summary: 'GET /announcements.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'list',
        label: 'GET /announcements',
        description: 'Listar anuncios visibles para el parent.',
        endpoint: { method: 'GET', path: '/announcements' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: 200 },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },

  // ---------------- STAFF ----------------
  {
    id: 'sf.login.mfa',
    roleKey: SF,
    title: 'Login STAFF',
    summary: 'Auth con tenant header.',
    group: 'auth',
    status: 'live',
    steps: [
      {
        id: 'login',
        label: 'POST /auth/login',
        description: 'Login STAFF.',
        endpoint: { method: 'POST', path: '/auth/login' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 401] },
        defaultPayload: { email: 'staff@demo.pe', password: 'Demo2026!' },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sf.payments.reconcile',
    roleKey: SF,
    title: 'Conciliación de pagos',
    summary: 'POST /payments/{id}/reconcile (LMS_PAYMENT_ADMIN).',
    group: 'finance',
    status: 'live',
    steps: [
      {
        id: 'reconcile',
        label: 'POST /payments/{id}/reconcile',
        description: 'Conciliar un pago.',
        endpoint: { method: 'POST', path: '/payments/00000000-0000-0000-0000-000000000000/reconcile' },
        autoExecute: false,
        successCriteria: {
          kind: 'manualConfirm',
          prompt: 'Confirma la conciliación.',
        },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
  {
    id: 'sf.reports.operational',
    roleKey: SF,
    title: 'Reportes operativos',
    summary: 'GET /reports/operational.',
    group: 'system',
    status: 'live',
    steps: [
      {
        id: 'list',
        label: 'GET /reports/operational',
        description: 'Cargar reportes.',
        endpoint: { method: 'GET', path: '/reports/operational' },
        autoExecute: true,
        successCriteria: { kind: 'status', value: [200, 404] },
      },
    ],
    bugReportPath: BUG_REPORTS_PATH,
  },
];

export function capabilitiesForRole(roleKey: RoleKey | string): Capability[] {
  return CAPABILITIES.filter((c) => c.roleKey === roleKey);
}

export function findCapability(id: string): Capability | undefined {
  return CAPABILITIES.find((c) => c.id === id);
}

import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { PageContainerComponent, PageHeaderComponent, IconComponent } from "@shared/components";

@Component({
  selector: "app-pilot-guide",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, PageContainerComponent, PageHeaderComponent, IconComponent],
  template: `
    <app-page-container size="wide">
      <app-page-header
        eyebrow="Pilot TecnoSur"
        title="Guia de testing para tu rol"
        subtitle="Cada tester valida 6-8 horas en 1 semana. Esta pagina resume que hacer; la guia completa tiene 700+ lineas con todos los checklists."
      >
        <a class="btn btn-primary btn-sm" href="/assets/pilot-guide-print.html" target="_blank" rel="noopener">
          <app-icon name="download" [size]="14" />
          <span>Imprimir / PDF</span>
        </a>
        <a class="btn btn-outline btn-sm" href="/assets/pilot-user-testing-guide.md" target="_blank" rel="noopener">
          <app-icon name="file-text" [size]="14" />
          <span>Markdown</span>
        </a>
      </app-page-header>

      <section class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        @for (role of roles; track role.key) {
          <a [routerLink]="['/help/role', role.key]" class="card hover:shadow-md transition-shadow" [attr.data-testid]="'pilot-role-' + role.key">
            <div class="card-body">
              <div class="flex items-center gap-3">
                <span class="flex h-10 w-10 items-center justify-center rounded-full text-lg" [style.background]="role.color + '20'" [style.color]="role.color">
                  <app-icon [name]="role.icon" [size]="18" />
                </span>
                <div>
                  <p class="text-sm font-semibold text-content">{{ role.name }}</p>
                  <p class="text-xs text-content-muted">{{ role.count }} acciones</p>
                </div>
              </div>
              <p class="mt-2 text-xs text-content-muted">{{ role.summary }}</p>
            </div>
          </a>
        }
      </section>

      <section class="mt-8 grid gap-4 sm:grid-cols-2">
        <div class="card">
          <header class="card-header"><h2 class="card-title text-sm">Como reportar un bug</h2></header>
          <div class="card-body">
            <pre class="rounded-md bg-surface-muted/40 p-3 text-xs whitespace-pre-wrap text-content-muted"># Plantilla de bug
ROL:        [admin | docente | estudiante | apoderado | staff | super]
ACCION:    [que intentaste hacer]
PAGINA:    [URL completa]
PASOS:     [1. ... 2. ... 3. ...]
ESPERABA:  [que deberia pasar]
PASO:       [que paso en realidad]
CONSOLE:   [pegar errores de la consola del navegador]
SCREEN:    [screenshot si es visual]
SEVERIDAD: [P0 bloqueante | P1 molesto | P2 nice-to-have]</pre>
          </div>
        </div>

        <div class="card">
          <header class="card-header"><h2 class="card-title text-sm">Sign-off (entregar al test lead)</h2></header>
          <div class="card-body">
            <pre class="rounded-md bg-surface-muted/40 p-3 text-xs whitespace-pre-wrap text-content-muted">SESION:     [Fecha, hora de inicio, hora de fin]
RANGO:      [Paginas probadas / Modulos]
NAVEGADOR:  [Chrome / Firefox / Safari / Edge / Movil]
CASOS PROBADOS: [XX/YY]
CASOS QUE PASARON: [XX]
CASOS QUE FALLARON: [YY]
BUGS P0 ENCONTRADOS: [lista]
BUGS P1 ENCONTRADOS: [lista]
SUGERENCIAS: [lista]
LO RECOMENDARIAS? [0-10]
USARIAS ESTE PRODUCTO? [Si / No / Tal vez]</pre>
          </div>
        </div>
      </section>

      <section class="mt-8 card border-l-4 border-l-primary-500">
        <div class="card-body">
          <h3 class="text-sm font-semibold text-content">Regla de oro</h3>
          <p class="mt-1 text-sm text-content-muted">Si encuentras un bug, <strong>reportalo inmediatamente</strong> aunque sea chiquito. Mejor tener 30 P2 que 1 P0 que recien descubrimos al final.</p>
        </div>
      </section>
      <section class="mt-6">
        <h2 class="mb-3 text-sm font-semibold text-content">Tu turno del dia (walkthrough narrativo)</h2>
        <p class="text-sm text-content-muted">Segui el <strong>walkthrough narrativo</strong> (lunes 17 de marzo, 7:30 a 17:30) en orden. Tu turno asignado es el siguiente:</p>
        <ul class="mt-3 divide-y divide-border-subtle rounded-md border border-border bg-surface">
          <li class="flex items-center justify-between gap-3 p-3">
            <div>
              <p class="text-sm font-medium text-content">Director (Tenant Admin)</p>
              <p class="text-xs text-content-muted">Apertura del dia, pagos, reportes, anuncios, audit, logout</p>
            </div>
            <span class="badge badge-info">7:30 / 11:00 / 13:00 / 16:00 / 17:30</span>
          </li>
          <li class="flex items-center justify-between gap-3 p-3">
            <div>
              <p class="text-sm font-medium text-content">Docente Lengua</p>
              <p class="text-xs text-content-muted">Asistencia 5A, IA rubricas, aprobar justificaciones</p>
            </div>
            <span class="badge badge-info">7:45 / 14:00 / 17:00</span>
          </li>
          <li class="flex items-center justify-between gap-3 p-3">
            <div>
              <p class="text-sm font-medium text-content">Docente Matematica</p>
              <p class="text-xs text-content-muted">Horario, crear evaluacion, generar sesion IA</p>
            </div>
            <span class="badge badge-info">8:00</span>
          </li>
          <li class="flex items-center justify-between gap-3 p-3">
            <div>
              <p class="text-sm font-medium text-content">Estudiante</p>
              <p class="text-xs text-content-muted">Dashboard, QR, entregar tarea, ver notas, descargar material</p>
            </div>
            <span class="badge badge-info">8:15 / 12:00</span>
          </li>
          <li class="flex items-center justify-between gap-3 p-3">
            <div>
              <p class="text-sm font-medium text-content">Apoderado</p>
              <p class="text-xs text-content-muted">Justificar inasistencias, pagos, ver calificaciones</p>
            </div>
            <span class="badge badge-info">10:00 / 15:00</span>
          </li>
          <li class="flex items-center justify-between gap-3 p-3">
            <div>
              <p class="text-sm font-medium text-content">Staff (Personal)</p>
              <p class="text-xs text-content-muted">Pagos operativos, reportes</p>
            </div>
            <span class="badge badge-info">13:00</span>
          </li>
        </ul>
        <p class="mt-3 text-sm text-content-muted">El walkthrough completo (~30 acciones en 15+ modulos) esta en <code>docs/qa/pilot-scenario-walkthrough.md</code>. Si tenes 6+ horas, hace ademas el guide tecnico exhaustivo (~360 acciones).</p>
      </section>
    </app-page-container>
  `,
})
export class PilotGuidePageComponent {
  protected readonly roles: ReadonlyArray<{
    key: string;
    name: string;
    count: number;
    summary: string;
    icon: "user" | "graduation-cap" | "book-open" | "users" | "list-checks" | "shield-check";
    color: string;
  }> = [
    { key: "tenant-admin", name: "Tenant Admin (Director)", count: 150, summary: "Dashboard, usuarios, estudiantes, secciones, asistencia, IA, pagos, reportes.", icon: "user", color: "#4f46e5" },
    { key: "teacher", name: "Docente", count: 60, summary: "Sus secciones, asistencia, calificar, material, IA, horario.", icon: "graduation-cap", color: "#10b981" },
    { key: "student", name: "Estudiante", count: 30, summary: "Sus cursos, tareas, quizzes, MI asistencia, MI pago.", icon: "book-open", color: "#3b82f6" },
    { key: "parent", name: "Apoderado", count: 20, summary: "Sus hijos, calificaciones, pagos, anuncios.", icon: "users", color: "#8b5cf6" },
    { key: "staff", name: "Staff (Personal)", count: 15, summary: "Pagos, reportes, asistencia (read).", icon: "list-checks", color: "#0891b2" },
    { key: "super-admin", name: "Super Admin", count: 25, summary: "Cross-tenant, impersonation, planes, audit.", icon: "shield-check", color: "#dc2626" },
  ];
}



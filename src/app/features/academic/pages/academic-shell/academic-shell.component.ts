import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ROUTES } from '@core/constants';
import { IconComponent, PageContainerComponent, PageHeaderComponent } from '@shared/components';
import type { IconName } from '@shared/components/icon';

/**
 * Shell del módulo {@code academic}. Renderiza un header global y una
 * barra de tabs persistente; el {@code <router-outlet>} pinta el
 * sub-módulo activo.
 *
 * <h3>Tabs (Sprint 4)</h3>
 * <ul>
 *   <li><b>Años</b>      — FE-4.1 (este sprint, ya navegable).</li>
 *   <li><b>Niveles</b>   — FE-4.2 (entregado).</li>
 *   <li><b>Secciones</b> — FE-4.3 (entregado).</li>
 *   <li><b>Cursos</b>    — FE-4.4 (entregado).</li>
 *   <li><b>Periodos</b>  — FE-4.5 (entregado).</li>
 * </ul>
 *
 * <p>Sprint 4 cerró las cinco rutas. Los tabs futuros (ej. evaluaciones,
 * notas) seguirán el mismo patrón: agregar el {@code id/label/icon/route}
 * a {@link #tabs} y registrar la sub-ruta en {@code academic.routes.ts}.
 * El sistema soporta tabs en {@code route: null} como placeholders con
 * cursor de "no permitido" y badge "Próximamente".</p>
 */
@Component({
  selector: 'app-academic-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
  ],
  template: `
    <app-page-container size="wide">
      <app-page-header
        title="Académico"
        subtitle="Configura el calendario lectivo, los niveles, secciones, cursos y periodos del workspace."
      />

      <nav class="card mb-4 overflow-hidden" aria-label="Sub-módulos académicos">
        <ul class="flex flex-wrap items-center gap-1 border-b border-border-subtle px-2 py-2">
          @for (tab of tabs; track tab.id) {
            <li>
              @if (tab.route) {
                <a
                  [routerLink]="tab.route"
                  routerLinkActive="bg-primary-50 text-primary-700"
                  [routerLinkActiveOptions]="{ exact: false }"
                  class="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-subtle hover:text-content"
                >
                  <app-icon [name]="tab.icon" [size]="16" />
                  {{ tab.label }}
                </a>
              } @else {
                <span
                  class="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-content-subtle opacity-60"
                  title="Disponible en próximas iteraciones"
                  aria-disabled="true"
                >
                  <app-icon [name]="tab.icon" [size]="16" />
                  {{ tab.label }}
                  <span class="badge badge-neutral text-[10px]">Próximamente</span>
                </span>
              }
            </li>
          }
        </ul>
      </nav>

      <router-outlet />
    </app-page-container>
  `,
})
export class AcademicShellComponent {
  protected readonly tabs: ReadonlyArray<{
    id: string;
    label: string;
    icon: IconName;
    /** {@code null} marca el tab como placeholder (FE-4.2..4.5). */
    route: string | null;
  }> = [
    {
      id: 'years',
      label: 'Años',
      icon: 'calendar',
      route: ROUTES.ACADEMIC.YEARS.LIST,
    },
    {
      id: 'levels',
      label: 'Niveles',
      icon: 'layers',
      route: ROUTES.ACADEMIC.LEVELS.LIST,
    },
    {
      id: 'sections',
      label: 'Secciones',
      icon: 'columns',
      route: ROUTES.ACADEMIC.SECTIONS.LIST,
    },
    {
      id: 'courses',
      label: 'Cursos',
      icon: 'book-open',
      route: ROUTES.ACADEMIC.COURSES.LIST,
    },
    {
      id: 'periods',
      label: 'Periodos',
      icon: 'clock',
      route: ROUTES.ACADEMIC.PERIODS.LIST,
    },
  ];
}

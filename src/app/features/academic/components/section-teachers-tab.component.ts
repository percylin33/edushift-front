import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { TeacherAssignmentsStore } from '@features/teachers/store';
import { PERIOD_TYPE_LABELS } from '@features/academic/models';

/**
 * Sub-componente del tab "Docentes" en
 * {@code section-detail} (FE-4.7 / BE-4.7).
 *
 * <p>Reverse view: dada la sección, lista las assignments
 * activas agrupadas por {@code (teacher, course, period)}. Read-only
 * desde acá — la creación de asignaciones se hace desde el detalle
 * del docente para mantener un único origen de verdad.</p>
 */
@Component({
  selector: 'app-section-teachers-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, IconComponent, SpinnerComponent],
  template: `
    <section class="card">
      <header class="card-header">
        <div>
          <h3 class="card-title">Docentes asignados</h3>
          <p class="card-description">
            Listado de docentes con asignación activa en esta sección. Para crear una asignación, ve
            al detalle del docente.
          </p>
        </div>
      </header>

      <div class="card-body">
        @if (loading()) {
          <div class="flex items-center justify-center py-10">
            <app-spinner [size]="24" label="Cargando docentes…" />
          </div>
        } @else if (errorMessage()) {
          <div class="alert alert-danger">
            <app-icon name="alert-circle" [size]="18" />
            <p class="flex-1 text-sm">{{ errorMessage() }}</p>
            <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
              Reintentar
            </button>
          </div>
        } @else if (rows().length === 0) {
          <div class="py-10 text-center">
            <app-icon name="user" [size]="32" class="mx-auto mb-3 text-content-subtle" />
            <p class="text-sm font-medium text-content">Sin docentes asignados todavía</p>
            <p class="mx-auto mt-1 max-w-md text-xs text-content-muted">
              Las asignaciones se crean desde la pestaña
              <em>Asignaciones</em> del docente.
            </p>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Docente</th>
                  <th scope="col">Curso</th>
                  <th scope="col">Periodo</th>
                  <th scope="col">Inicio</th>
                </tr>
              </thead>
              <tbody>
                @for (a of rows(); track a.assignmentPublicUuid) {
                  <tr>
                    <td>
                      <a
                        [routerLink]="teacherRoute(a.teacherPublicUuid)"
                        class="-mx-2 -my-1 block rounded px-2 py-1 hover:bg-surface-muted"
                      >
                        <p class="font-medium text-content">
                          {{ a.teacherFullName }}
                        </p>
                        @if (a.teacherEmail) {
                          <p class="text-xs text-content-muted">
                            {{ a.teacherEmail }}
                          </p>
                        }
                      </a>
                    </td>
                    <td>
                      <span class="font-mono text-xs">{{ a.courseCode }}</span>
                      <span class="text-content-muted"> · </span>
                      <span>{{ a.courseName }}</span>
                    </td>
                    <td>
                      <span class="badge badge-secondary">
                        {{ periodLabel(a) }}
                      </span>
                    </td>
                    <td>
                      <span class="text-xs text-content-muted">
                        {{ a.assignedAt ? (a.assignedAt | date: 'mediumDate') : '—' }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class SectionTeachersTabComponent implements OnInit {
  private readonly store = inject(TeacherAssignmentsStore);

  readonly sectionPublicUuid = input.required<string>();

  protected readonly rows = this.store.sectionTeachers;
  protected readonly loading = this.store.loadingSection;
  protected readonly errorMessage = this.store.error;

  async ngOnInit(): Promise<void> {
    await this.store.loadSectionTeachers(this.sectionPublicUuid());
  }

  protected periodLabel(a: {
    periodType: keyof typeof PERIOD_TYPE_LABELS;
    periodOrdinal: number;
  }): string {
    return `${PERIOD_TYPE_LABELS[a.periodType]} ${a.periodOrdinal}`;
  }

  protected teacherRoute(publicUuid: string): string {
    return ROUTES.TEACHERS.detail(publicUuid);
  }

  protected async reload(): Promise<void> {
    this.store.clearError();
    await this.store.loadSectionTeachers(this.sectionPublicUuid());
  }
}

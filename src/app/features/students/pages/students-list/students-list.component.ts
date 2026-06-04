import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '@shared/components';

@Component({
  selector: 'app-students-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent, EmptyStateComponent, IconComponent],
  template: `
    <app-page-container size="wide">
      <app-page-header
        title="Estudiantes"
        subtitle="Listado activo del tenant."
      >
        <button type="button" class="btn btn-outline btn-sm">
          <app-icon name="search" [size]="16" />
          <span class="hidden sm:inline">Buscar</span>
        </button>
        <button type="button" class="btn btn-primary btn-sm">
          <app-icon name="users" [size]="16" />
          <span class="hidden sm:inline">Nuevo estudiante</span>
        </button>
      </app-page-header>

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="users"
            title="Aún no hay estudiantes"
            description="Empieza creando el primero o impórtalos desde un CSV.">
            <button type="button" class="btn btn-primary btn-sm">Nuevo estudiante</button>
            <button type="button" class="btn btn-ghost btn-sm">Importar CSV</button>
          </app-empty-state>
        </div>
      </div>
    </app-page-container>
  `
})
export class StudentsListComponent {}

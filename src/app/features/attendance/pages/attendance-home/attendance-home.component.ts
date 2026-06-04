import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '@shared/components';

@Component({
  selector: 'app-attendance-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent, EmptyStateComponent, IconComponent],
  template: `
    <app-page-container>
      <app-page-header
        title="Asistencia"
        subtitle="Control diario, historial y reportes."
      >
        <button type="button" class="btn btn-primary btn-sm">
          <app-icon name="calendar-check" [size]="16" />
          <span class="hidden sm:inline">Tomar asistencia</span>
        </button>
      </app-page-header>

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="calendar-check"
            title="Aún no hay registros"
            description="Esta es la vista de inicio del módulo de asistencia."
          />
        </div>
      </div>
    </app-page-container>
  `
})
export class AttendanceHomeComponent {}

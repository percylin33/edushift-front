import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EmptyStateComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '@shared/components';

@Component({
  selector: 'app-academic-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-container>
      <app-page-header
        title="Académico"
        subtitle="Cursos, clases, notas y horarios."
      />

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="book-open"
            title="Módulo académico"
            description="Selecciona una sección desde el sidebar para empezar."
          />
        </div>
      </div>
    </app-page-container>
  `
})
export class AcademicHomeComponent {}

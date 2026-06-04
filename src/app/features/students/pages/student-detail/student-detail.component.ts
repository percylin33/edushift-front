import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  EmptyStateComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '@shared/components';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-container>
      <app-page-header
        [title]="title()"
        [subtitle]="'ID: ' + (id() ?? '—')"
        eyebrow="Detalle de estudiante"
      >
        <button type="button" class="btn btn-outline btn-sm">Editar</button>
      </app-page-header>

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="user"
            title="Detalle pendiente"
            description="Aquí vivirán los datos del estudiante, historial académico y pagos."
          />
        </div>
      </div>
    </app-page-container>
  `
})
export class StudentDetailComponent {
  readonly id = input<string | null>(null);

  readonly title = computed(() => `Estudiante #${this.id() ?? '—'}`);
}

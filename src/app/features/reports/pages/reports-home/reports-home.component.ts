import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EmptyStateComponent,
  PageContainerComponent,
  PageHeaderComponent,
} from '@shared/components';

@Component({
  selector: 'app-reports-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-container size="wide">
      <app-page-header
        title="Reportes"
        subtitle="Indicadores académicos, financieros y operativos."
      />

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="bar-chart"
            title="Sin reportes generados"
            description="Crea tu primer reporte filtrando por fecha, grado o curso."
          />
        </div>
      </div>
    </app-page-container>
  `,
})
export class ReportsHomeComponent {}

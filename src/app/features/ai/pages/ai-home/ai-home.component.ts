import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
} from '@shared/components';

@Component({
  selector: 'app-ai-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    IconComponent,
  ],
  template: `
    <app-page-container size="narrow">
      <app-page-header
        title="Asistente IA"
        subtitle="Insights, automatizaciones y chat académico."
        eyebrow="Beta"
      >
        <a [routerLink]="chatLink" class="btn btn-primary btn-sm">
          <app-icon name="sparkles" [size]="16" />
          <span class="hidden sm:inline">Nuevo análisis</span>
        </a>
      </app-page-header>

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="sparkles"
            title="Sin conversaciones"
            description="Empieza una conversación con el asistente para generar insights del tenant."
          />
        </div>
      </div>
    </app-page-container>
  `,
})
export class AiHomeComponent {
  readonly chatLink = ROUTES.AI.CHAT;
}

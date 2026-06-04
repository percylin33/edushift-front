import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EmptyStateComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '@shared/components';

@Component({
  selector: 'app-notifications-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-container size="narrow">
      <app-page-header
        title="Notificaciones"
        subtitle="Centro de notificaciones del tenant."
      />

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="bell"
            title="Sin notificaciones"
            description="Te avisaremos aquí cuando ocurra algo importante."
          />
        </div>
      </div>
    </app-page-container>
  `
})
export class NotificationsHomeComponent {}

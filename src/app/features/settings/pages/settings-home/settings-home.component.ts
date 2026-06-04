import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EmptyStateComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '@shared/components';

@Component({
  selector: 'app-settings-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-container size="narrow">
      <app-page-header
        title="Configuración"
        subtitle="Ajustes del tenant: branding, usuarios, plan y preferencias."
      />

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="settings"
            title="Configuración por dominio"
            description="Aquí vivirán las secciones de branding, usuarios, billing y preferencias del tenant."
          />
        </div>
      </div>
    </app-page-container>
  `
})
export class SettingsHomeComponent {}

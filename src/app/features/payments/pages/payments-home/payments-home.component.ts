import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
} from '@shared/components';

@Component({
  selector: 'app-payments-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageContainerComponent, PageHeaderComponent, EmptyStateComponent, IconComponent],
  template: `
    <app-page-container>
      <app-page-header title="Pagos" subtitle="Facturas, transacciones y estado de cuenta.">
        <button type="button" class="btn btn-primary btn-sm">
          <app-icon name="credit-card" [size]="16" />
          <span class="hidden sm:inline">Registrar pago</span>
        </button>
      </app-page-header>

      <div class="card">
        <div class="card-body">
          <app-empty-state
            icon="credit-card"
            title="Sin movimientos"
            description="Cuando se generen facturas o se registren pagos los verás aquí."
          />
        </div>
      </div>
    </app-page-container>
  `,
})
export class PaymentsHomeComponent {}

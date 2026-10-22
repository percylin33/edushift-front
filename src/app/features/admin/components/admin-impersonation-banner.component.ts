import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AdminImpersonationService } from '../services';

@Component({
  selector: 'app-admin-impersonation-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (impersonation.active(); as state) {
      <div class="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-amber-300 px-4 py-2 text-sm font-medium text-amber-950" role="status">
        <span>Sesión de soporte: {{ state.fullName }} · {{ state.email }} · {{ state.tenantSlug }}</span>
        <button type="button" (click)="impersonation.stop()" [disabled]="impersonation.busy()" class="rounded bg-amber-950 px-3 py-1 text-white disabled:opacity-50">{{ impersonation.busy() ? 'Cerrando…' : 'Terminar soporte' }}</button>
        @if (impersonation.error(); as error) { <span class="basis-full text-xs">{{ error }}</span> }
      </div>
    }
  `,
})
export class AdminImpersonationBannerComponent {
  protected readonly impersonation = inject(AdminImpersonationService);
}

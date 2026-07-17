import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Auditoría</h1>
        <p class="mt-1 text-sm text-slate-400">Registro de impersonaciones y acciones de admin.</p>
      </div>
      <p class="mt-8 text-center text-sm text-slate-500">Próximamente.</p>
    </div>
  `,
})
export class AdminAuditComponent {}

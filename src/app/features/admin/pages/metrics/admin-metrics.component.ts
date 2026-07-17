import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { AdminMetricsService } from '../../services';

@Component({
  selector: 'app-admin-metrics',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <div>
        <h1 class="text-2xl font-bold text-white">Métricas</h1>
        <p class="mt-1 text-sm text-slate-400">Métricas detalladas por institución.</p>
      </div>

      <!-- Estudiantes -->
      <section class="mt-6">
        <h2 class="mb-3 text-lg font-semibold text-white">Estudiantes por institución</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr><th class="px-4 py-3">Institución</th><th class="px-4 py-3">Cantidad</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              @for (m of svc.students(); track m.tenantUuid) {
                <tr class="hover:bg-slate-800/50">
                  <td class="px-4 py-3 text-white">{{ m.tenantName }}</td>
                  <td class="px-4 py-3 text-slate-300">{{ m.value.toLocaleString('es-PE') }}</td>
                </tr>
              } @empty {
                <tr><td colspan="2" class="px-4 py-8 text-center text-slate-500">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Docentes -->
      <section class="mt-6">
        <h2 class="mb-3 text-lg font-semibold text-white">Docentes por institución</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr><th class="px-4 py-3">Institución</th><th class="px-4 py-3">Cantidad</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              @for (m of svc.teachers(); track m.tenantUuid) {
                <tr class="hover:bg-slate-800/50">
                  <td class="px-4 py-3 text-white">{{ m.tenantName }}</td>
                  <td class="px-4 py-3 text-slate-300">{{ m.value.toLocaleString('es-PE') }}</td>
                </tr>
              } @empty {
                <tr><td colspan="2" class="px-4 py-8 text-center text-slate-500">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Almacenamiento -->
      <section class="mt-6">
        <h2 class="mb-3 text-lg font-semibold text-white">Almacenamiento por institución</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr><th class="px-4 py-3">Institución</th><th class="px-4 py-3">Uso</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              @for (m of svc.storage(); track m.tenantUuid) {
                <tr class="hover:bg-slate-800/50">
                  <td class="px-4 py-3 text-white">{{ m.tenantName }}</td>
                  <td class="px-4 py-3 text-slate-300">{{ formatBytes(m.value) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="2" class="px-4 py-8 text-center text-slate-500">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Uso de IA -->
      <section class="mt-6">
        <h2 class="mb-3 text-lg font-semibold text-white">Uso de IA por institución</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-800">
          <table class="w-full text-sm">
            <thead class="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr><th class="px-4 py-3">Institución</th><th class="px-4 py-3">Consultas</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              @for (m of svc.ai(); track m.tenantUuid) {
                <tr class="hover:bg-slate-800/50">
                  <td class="px-4 py-3 text-white">{{ m.tenantName }}</td>
                  <td class="px-4 py-3 text-slate-300">{{ m.value.toLocaleString('es-PE') }}</td>
                </tr>
              } @empty {
                <tr><td colspan="2" class="px-4 py-8 text-center text-slate-500">Sin datos</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class AdminMetricsComponent implements OnInit {
  protected readonly svc = inject(AdminMetricsService);

  ngOnInit(): void {
    this.svc.loadAll();
  }

  protected formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }
}

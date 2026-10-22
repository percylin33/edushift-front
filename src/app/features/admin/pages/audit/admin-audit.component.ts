import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { API } from '@core/constants';
import { AdminAuditService } from '../../services';
import { AdminAuditEvent } from '../../models/audit.models';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-7xl p-4 sm:p-6">
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Control de plataforma</p>
          <h1 class="mt-1 text-2xl font-bold text-white">Auditoría</h1>
          <p class="mt-1 text-sm text-slate-400">Actividad administrativa e historial de cambios de las instituciones.</p>
        </div>
        <button type="button" (click)="exportCsv()" [disabled]="svc.loading()"
          class="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
          Exportar resultados
        </button>
      </header>

      <section class="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4" aria-label="Filtros de auditoría">
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="text-xs font-medium text-slate-400">Institución
            <input [(ngModel)]="tenantSearch" (keyup.enter)="applyFilters()" placeholder="Nombre o código de institución"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600" />
          </label>
          <label class="text-xs font-medium text-slate-400">Usuario
            <input [(ngModel)]="actorSearch" (keyup.enter)="applyFilters()" placeholder="Nombre, apellido o correo"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600" />
          </label>
          <label class="text-xs font-medium text-slate-400">Tipo de actividad
            <select [(ngModel)]="action" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
              <option value="">Todas las actividades</option>
              @for (option of actionOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </label>
          <div class="grid grid-cols-2 gap-2">
            <label class="text-xs font-medium text-slate-400">Desde
              <input type="datetime-local" [(ngModel)]="from" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2.5 text-xs text-white" />
            </label>
            <label class="text-xs font-medium text-slate-400">Hasta
              <input type="datetime-local" [(ngModel)]="to" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-2.5 text-xs text-white" />
            </label>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-slate-500">Busca por nombres; los identificadores técnicos están disponibles en el detalle de cada evento.</p>
          <div class="flex gap-2">
            <button type="button" (click)="clearFilters()" class="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Limpiar</button>
            <button type="button" (click)="applyFilters()" [disabled]="svc.loading()" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{{ svc.loading() ? 'Buscando…' : 'Buscar' }}</button>
          </div>
        </div>
      </section>

      @if (svc.error(); as error) {
        <p class="mt-4 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-300" role="alert">{{ error }}</p>
      }

      <section class="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-900" aria-label="Eventos de auditoría">
        <div class="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 class="text-sm font-semibold text-slate-200">Eventos registrados</h2>
          <span class="text-xs text-slate-400">{{ svc.totalElements() }} resultados</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[850px] text-left text-sm">
            <thead class="bg-slate-950/70 text-[11px] uppercase tracking-wide text-slate-500">
              <tr><th class="px-4 py-3">Fecha y hora</th><th class="px-4 py-3">Actividad</th><th class="px-4 py-3">Quién</th><th class="px-4 py-3">Institución</th><th class="px-4 py-3">Qué ocurrió</th><th class="px-4 py-3">Detalle</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              @for (event of svc.events(); track event.id) {
                <tr class="align-top hover:bg-slate-800/30">
                  <td class="whitespace-nowrap px-4 py-3 text-xs text-slate-300">{{ event.occurredAt | date:'dd/MM/yyyy, HH:mm:ss' }}</td>
                  <td class="px-4 py-3"><span class="inline-flex rounded-full bg-indigo-950 px-2.5 py-1 text-xs font-semibold text-indigo-200">{{ actionLabel(event.action) }}</span></td>
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-200">{{ event.actorName || (event.actorEmail ? 'Usuario' : 'Sistema') }}</p>
                    @if (event.actorEmail) { <p class="mt-0.5 text-xs text-slate-500">{{ event.actorEmail }}</p> }
                  </td>
                  <td class="px-4 py-3">
                    <p class="text-slate-200">{{ event.tenantName || (event.tenantId ? 'Institución' : 'Plataforma') }}</p>
                    @if (event.tenantSlug) { <p class="mt-0.5 text-xs text-slate-500">{{ event.tenantSlug }}</p> }
                  </td>
                  <td class="max-w-md px-4 py-3 text-slate-300">{{ event.summary || summaryFallback(event) }}</td>
                  <td class="px-4 py-3"><details class="group">
                    <summary class="cursor-pointer list-none whitespace-nowrap text-xs font-semibold text-indigo-300 hover:text-indigo-200">Ver datos técnicos</summary>
                    <div class="absolute z-10 mt-2 w-[min(34rem,85vw)] rounded-lg border border-slate-700 bg-slate-950 p-4 shadow-xl">
                      <dl class="grid gap-3 text-xs sm:grid-cols-2">
                        <div><dt class="text-slate-500">Recurso</dt><dd class="mt-1 text-slate-200">{{ resourceLabel(event.resourceType) }}</dd></div>
                        <div><dt class="text-slate-500">Fecha UTC</dt><dd class="mt-1 text-slate-200">{{ event.occurredAt }}</dd></div>
                        <div class="sm:col-span-2"><dt class="text-slate-500">ID del evento</dt><dd class="mt-1 break-all font-mono text-slate-300">{{ event.id }}</dd></div>
                        @if (event.actorId) { <div class="sm:col-span-2"><dt class="text-slate-500">ID del usuario</dt><dd class="mt-1 break-all font-mono text-slate-300">{{ event.actorId }}</dd></div> }
                        @if (event.tenantId) { <div class="sm:col-span-2"><dt class="text-slate-500">ID de institución</dt><dd class="mt-1 break-all font-mono text-slate-300">{{ event.tenantId }}</dd></div> }
                        @if (event.resourceId) { <div class="sm:col-span-2"><dt class="text-slate-500">ID del recurso</dt><dd class="mt-1 break-all font-mono text-slate-300">{{ event.resourceId }}</dd></div> }
                        @if (event.traceId) { <div class="sm:col-span-2"><dt class="text-slate-500">Trace ID</dt><dd class="mt-1 break-all font-mono text-slate-300">{{ event.traceId }}</dd></div> }
                        @if (event.metadata) { <div class="sm:col-span-2"><dt class="text-slate-500">Información adicional</dt><pre class="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-900 p-2 text-slate-300">{{ event.metadata | json }}</pre></div> }
                      </dl>
                    </div>
                  </details></td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-12 text-center">
                  <p class="text-sm font-medium text-slate-300">{{ svc.loading() ? 'Cargando actividad…' : 'No hay eventos para estos filtros.' }}</p>
                  @if (!svc.loading()) { <p class="mt-1 text-xs text-slate-500">Prueba ampliar el periodo o quitar algún filtro.</p> }
                </td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <footer class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <span>Página {{ svc.totalPages() ? page + 1 : 0 }} de {{ svc.totalPages() }} · {{ svc.totalElements() }} eventos</span>
        <div class="flex gap-2">
          <button type="button" (click)="changePage(page - 1)" [disabled]="page === 0 || svc.loading()" class="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40">Anterior</button>
          <button type="button" (click)="changePage(page + 1)" [disabled]="page + 1 >= svc.totalPages() || svc.loading()" class="rounded-lg border border-slate-700 px-3 py-2 disabled:opacity-40">Siguiente</button>
        </div>
      </footer>
    </main>
  `,
})
export class AdminAuditComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly svc = inject(AdminAuditService);
  private readonly http = inject(HttpClient);
  protected tenantSearch = '';
  protected actorSearch = '';
  protected action = '';
  protected from = '';
  protected to = '';
  protected page = 0;

  protected readonly actionOptions = [
    { value: 'LOGIN', label: 'Inicio de sesión' },
    { value: 'LOGOUT', label: 'Cierre de sesión' },
    { value: 'LOGIN_FAILED', label: 'Intento de acceso fallido' },
    { value: 'ACCESS_DENIED', label: 'Acceso denegado' },
    { value: 'CREATE', label: 'Creación' },
    { value: 'READ', label: 'Consulta' },
    { value: 'UPDATE', label: 'Actualización' },
    { value: 'DELETE', label: 'Eliminación' },
    { value: 'CONFIG_CHANGED', label: 'Cambio de configuración' },
    { value: 'IMPERSONATE', label: 'Acceso de soporte' },
    { value: 'EXPORT', label: 'Exportación' },
    { value: 'IMPORT', label: 'Importación' },
    { value: 'PERMISSION_GRANTED', label: 'Permiso otorgado' },
    { value: 'PERMISSION_REVOKED', label: 'Permiso retirado' },
    { value: 'ADMIN_REVOKE', label: 'Revocación administrativa' },
    { value: 'ADMIN_PASSWORD_RESET', label: 'Restablecimiento de contraseña' },
    { value: 'ADMIN_PASSWORD_RESET_FAILED', label: 'Restablecimiento fallido' },
    { value: 'JOB_EXECUTED', label: 'Proceso automático' },
    { value: 'CUSTOM', label: 'Otro evento' },
  ];

  ngOnInit(): void {
    this.tenantSearch = this.route.snapshot.queryParamMap.get('tenantName') ?? '';
    this.load();
  }

  protected applyFilters(): void { this.page = 0; this.load(); }

  protected clearFilters(): void {
    this.tenantSearch = '';
    this.actorSearch = '';
    this.action = '';
    this.from = '';
    this.to = '';
    this.page = 0;
    this.load();
  }

  protected changePage(page: number): void {
    this.page = Math.max(0, page);
    this.load();
  }

  protected load(): void {
    this.svc.load({
      tenantSearch: this.tenantSearch.trim() || undefined,
      actorSearch: this.actorSearch.trim() || undefined,
      action: this.action || undefined,
      from: this.from ? new Date(this.from).toISOString() : undefined,
      to: this.to ? new Date(this.to).toISOString() : undefined,
      page: this.page,
    });
  }

  protected actionLabel(action: string): string {
    return this.actionOptions.find((item) => item.value === action)?.label ?? this.humanize(action);
  }

  protected resourceLabel(resourceType: string | null | undefined): string {
    if (!resourceType) return 'Sin recurso asociado';
    const labels: Record<string, string> = {
      tenant: 'Institución', user: 'Usuario', admin: 'Administración', admin_mfa: 'Seguridad · MFA',
      impersonation: 'Sesión de soporte', subscription: 'Suscripción', invoice: 'Factura',
      payment: 'Pago', student: 'Estudiante', teacher: 'Docente', platform_plan: 'Plan de plataforma',
    };
    return labels[resourceType.toLowerCase()] ?? this.humanize(resourceType);
  }

  protected summaryFallback(event: AdminAuditEvent): string {
    const resource = this.resourceLabel(event.resourceType).toLowerCase();
    return `${this.actionLabel(event.action)} · ${resource}`;
  }

  protected exportCsv(): void {
    const params: Record<string, string> = {};
    if (this.tenantSearch.trim()) params['tenantSearch'] = this.tenantSearch.trim();
    if (this.actorSearch.trim()) params['actorSearch'] = this.actorSearch.trim();
    if (this.action) params['action'] = this.action;
    if (this.from) params['from'] = new Date(this.from).toISOString();
    if (this.to) params['to'] = new Date(this.to).toISOString();
    this.http.get(API.ADMIN.AUDIT_EXPORT, { params, responseType: 'blob', withCredentials: true }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'auditoria-edushift.csv';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.svc.error.set('No se pudo exportar la auditoría. Inténtalo nuevamente.'),
    });
  }

  private humanize(value: string): string {
    return value.toLowerCase().replaceAll('_', ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  }
}

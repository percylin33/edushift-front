import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ROUTES } from '@core/constants';
import { AdminInvoicesService, AdminPlansService, AdminTenantsService, PrepPackageVariant } from '../../services';
import { AdminTenantDetail } from '../../models';
import { tenantPublicUrl } from './tenant-url';

interface TenantModuleCard {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

@Component({
  selector: 'app-admin-tenant-detail',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
      <nav aria-label="Ruta de navegación" class="flex flex-wrap items-center gap-2 text-sm text-slate-400">
        <a [routerLink]="ROUTES.ADMIN.TENANTS" class="inline-flex items-center gap-2 text-indigo-300 hover:text-white">← Volver a instituciones</a>
        <span aria-hidden="true">/</span><span>Directorio</span><span aria-hidden="true">/</span>
        <span class="font-medium text-slate-200">{{ svc.selectedTenant()?.name ?? 'Institución' }}</span>
      </nav>

      @if (svc.loading() && !svc.selectedTenant()) {
        <section class="grid animate-pulse gap-4 lg:grid-cols-4" aria-label="Cargando institución">
          <div class="h-36 rounded-2xl bg-slate-900 lg:col-span-4"></div>
          @for (card of [1, 2, 3, 4]; track card) { <div class="h-40 rounded-2xl bg-slate-900"></div> }
          <div class="h-96 rounded-2xl bg-slate-900 lg:col-span-3"></div><div class="h-96 rounded-2xl bg-slate-900"></div>
        </section>
      } @else if (svc.error() && !svc.selectedTenant()) {
        <section class="rounded-2xl border border-red-900 bg-red-950/40 p-6" role="alert">
          <h1 class="text-lg font-semibold text-red-200">No se pudo cargar la institución</h1>
          <p class="mt-2 text-sm text-red-300">{{ svc.error() }}</p>
          <button type="button" (click)="reload()" class="mt-4 rounded-lg border border-red-800 px-4 py-2 text-sm text-red-100 hover:bg-red-900/50">Reintentar</button>
        </section>
      } @else {
        @if (svc.selectedTenant(); as t) {
        <header class="flex flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-5 sm:p-7 xl:flex-row xl:items-center xl:justify-between">
          <div class="flex min-w-0 items-start gap-4">
            <div class="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-950/60" aria-hidden="true">{{ initials(t.name) }}</div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-bold tracking-tight text-white sm:text-3xl">{{ t.name }}</h1>
                <span [class]="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
                <span class="rounded-md border border-indigo-500/30 bg-indigo-950/50 px-2.5 py-1 text-xs font-semibold text-indigo-200">{{ t.planName ?? t.plan ?? 'Sin plan' }}</span>
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-400">
                <span class="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1.5 font-mono text-xs text-slate-200">{{ tenantUrl(t) }}
                  <button type="button" (click)="copy(tenantUrl(t), 'URL')" class="text-indigo-300 hover:text-white" [attr.aria-label]="'Copiar URL de ' + t.name">Copiar</button>
                </span>
                <span class="text-xs">Slug: <span class="font-mono text-slate-300">{{ t.slug }}</span></span>
                <span class="text-xs">Creada {{ t.createdAt ? (t.createdAt | date:'dd MMM yyyy, HH:mm') : '—' }}</span>
              </div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>ID público <span class="font-mono text-slate-400">{{ t.publicUuid }}</span></span>
                <button type="button" (click)="copy(t.publicUuid, 'ID')" class="rounded border border-slate-700 px-2 py-1 text-indigo-300 hover:bg-slate-800">Copiar ID</button>
                @if (copied(); as copiedField) { <span class="text-emerald-300" role="status">{{ copiedField }} copiado</span> }
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 xl:justify-end">
            <a [routerLink]="ROUTES.ADMIN.AUDIT" [queryParams]="{ tenantName: t.name }" class="rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-semibold text-slate-200 hover:border-indigo-500 hover:text-white">Auditoría de actividad</a>
            @if (t.status === 'ACTIVE') {
              <a [routerLink]="ROUTES.ADMIN.SUPPORT" [queryParams]="{ tenant: t.publicUuid, tenantName: t.name }" class="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 hover:bg-indigo-500">Iniciar soporte →</a>
            }
          </div>
        </header>

        @if (actionError()) { <p role="alert" class="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">{{ actionError() }}</p> }
        @if (actionSuccess()) { <p role="status" class="rounded-lg border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">{{ actionSuccess() }}</p> }
        @if (svc.loading()) { <p class="text-xs text-slate-500" role="status">Actualizando información…</p> }

        <section aria-labelledby="resources-title">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="resources-title" class="text-sm font-semibold uppercase tracking-[0.12em] text-slate-400">Capacidad del tenant y recursos asignados</h2>
            <p class="text-xs text-slate-500">{{ t.metricsUpdatedAt ? ('Datos actualizados ' + (t.metricsUpdatedAt | date:'dd/MM/yyyy, HH:mm')) : '' }}</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div class="flex items-center justify-between text-sm text-slate-400"><h3>Estudiantes matriculados</h3><span class="rounded-lg bg-indigo-950 px-2 py-1 text-indigo-300">●</span></div>
              <p class="mt-4 text-3xl font-bold text-white">{{ fmt(t.activeStudents) }} <span class="text-sm font-normal text-slate-400">/ {{ formatCap(t.maxStudents) }} cupos</span></p>
              <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-indigo-500" [style.width.%]="usagePercent(t.activeStudents, t.maxStudents)"></div></div>
              <p class="mt-2 text-xs text-slate-400">{{ usagePercent(t.activeStudents, t.maxStudents) }}% de capacidad utilizada</p>
            </article>
            <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div class="flex items-center justify-between text-sm text-slate-400"><h3>Docentes activos</h3><span class="rounded-lg bg-emerald-950 px-2 py-1 text-emerald-300">●</span></div>
              <p class="mt-4 text-3xl font-bold text-white">{{ fmt(t.totalTeachers) }} <span class="text-sm font-normal text-slate-400">/ {{ formatCap(t.maxTeachers) }} asignados</span></p>
              <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-emerald-500" [style.width.%]="usagePercent(t.totalTeachers, t.maxTeachers)"></div></div>
              <p class="mt-2 text-xs text-slate-400">Cuentas activas con rol docente</p>
            </article>
            <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div class="flex items-center justify-between text-sm text-slate-400"><h3>Almacenamiento</h3><span class="rounded-lg bg-cyan-950 px-2 py-1 text-cyan-300">▤</span></div>
              <p class="mt-4 text-3xl font-bold text-white">{{ formatBytes(t.storageUsedBytes ?? 0) }} <span class="text-sm font-normal text-slate-400">/ {{ formatLimit(t.maxStorageMb) }}</span></p>
              <div class="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-cyan-500" [style.width.%]="storagePercent(t.storageUsedBytes, t.maxStorageMb)"></div></div>
              <p class="mt-2 text-xs text-slate-400">Archivos no eliminados</p>
            </article>
            <article class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <div class="flex items-center justify-between text-sm text-slate-400"><h3>Usuarios activos</h3><span class="rounded-lg bg-fuchsia-950 px-2 py-1 text-fuchsia-300">♙</span></div>
              <p class="mt-4 text-3xl font-bold text-white">{{ fmt(t.totalUsers) }}</p>
              <p class="mt-4 border-t border-slate-800 pt-3 text-xs text-slate-400">Incluye cuentas activas; docentes: {{ fmt(t.totalTeachers) }}</p>
            </article>
          </div>
        </section>

        <div class="grid items-start gap-5 xl:grid-cols-3">
          <div class="space-y-5 xl:col-span-2">
            <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7" aria-labelledby="modules-title">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div><h2 id="modules-title" class="text-lg font-bold text-white">Módulos y funciones</h2><p class="mt-1 text-sm text-slate-400">Disponibilidad según el plan y los indicadores configurados.</p></div>
                <span class="rounded-lg border border-indigo-900 bg-indigo-950/60 px-3 py-2 text-xs font-semibold text-indigo-200">{{ enabledModuleCount(t) }} activos</span>
              </div>
              <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                @for (module of moduleCards(t); track module.key) {
                  <article class="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <div class="flex items-start justify-between gap-3"><h3 class="font-semibold text-slate-100">{{ module.label }}</h3><span [class]="module.enabled ? 'rounded-full bg-emerald-950 px-2 py-1 text-[11px] text-emerald-300' : 'rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-400'">{{ module.enabled ? 'Activo' : 'Inactivo' }}</span></div>
                    <p class="mt-2 text-xs leading-5 text-slate-400">{{ module.description }}</p>
                  </article>
                } @empty {
                  <p class="rounded-xl border border-dashed border-slate-700 p-5 text-sm text-slate-400 sm:col-span-2 lg:col-span-3">Este plan no publica módulos configurables.</p>
                }
              </div>
            </section>

            <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7" aria-labelledby="billing-history-title">
              <div class="flex flex-wrap items-center justify-between gap-3"><div><h2 id="billing-history-title" class="text-lg font-bold text-white">Comprobantes B2B</h2><p class="mt-1 text-sm text-slate-400">Historial de cobro por institución.</p></div><a [routerLink]="ROUTES.ADMIN.INVOICES" class="text-sm font-semibold text-indigo-300 hover:text-white">Ver facturación →</a></div>
              @if (invoices.loading()) { <p class="mt-5 text-sm text-slate-400">Cargando comprobantes…</p> }
              @else if (invoices.error()) { <p class="mt-5 rounded-lg bg-red-950/40 p-3 text-sm text-red-300">{{ invoices.error() }}</p> }
              @else if (invoices.invoices().length) {
                <div class="mt-4 divide-y divide-slate-800">
                  @for (invoice of invoices.invoices().slice(0, 5); track invoice.publicUuid) {
                    <div class="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div><p class="text-sm font-medium text-slate-100">{{ invoice.period || 'Periodo sin especificar' }}</p><p class="mt-1 text-xs text-slate-500">Vence {{ invoice.dueDate ? (invoice.dueDate | date:'dd MMM yyyy') : '—' }}</p></div>
                      <div class="text-right"><p class="font-semibold text-white">{{ money(invoice.totalCents) }}</p><span [class]="invoiceStatusClass(invoice.status)">{{ invoiceStatusLabel(invoice.status) }}</span></div>
                    </div>
                  }
                </div>
              } @else { <p class="mt-5 rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">Todavía no hay comprobantes para esta institución.</p> }
            </section>

            <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7" aria-labelledby="prep-title">
              <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 id="prep-title" class="text-lg font-bold text-white">Pack de preparación y onboarding</h2><p class="mt-1 max-w-2xl text-sm text-slate-400">Genera plantillas para importar datos de {{ t.name }}.</p></div><span class="rounded border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400">Generador v2.4</span></div>
              <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <label class="flex-1 text-xs font-medium text-slate-400">Variante del paquete<select [(ngModel)]="prepVariant" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="PILOT">Piloto — conjunto mínimo de prueba</option><option value="PRODUCTION">Producción — padrón y conceptos de pago</option></select></label>
                <button type="button" (click)="downloadPrepPackage(t.name)" [disabled]="prepBusy()" class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{{ prepBusy() ? 'Generando…' : 'Descargar pack ZIP' }}</button>
              </div>
              @if (prepError()) { <p class="mt-3 text-sm text-red-300" role="alert">{{ prepError() }}</p> }
            </section>

            <details class="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <summary class="cursor-pointer text-sm font-semibold text-slate-200">Configuración técnica avanzada</summary>
              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                @for (entry of rawConfig(t); track entry.label) { <div><p class="text-xs uppercase tracking-wider text-slate-500">{{ entry.label }}</p><pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{{ entry.value | json }}</pre></div> }
                @if (!rawConfig(t).length) { <p class="text-sm text-slate-400">No hay configuración adicional.</p> }
              </div>
            </details>
          </div>

          <aside class="space-y-5">
            <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6" aria-labelledby="subscription-title">
              <div class="flex items-center justify-between gap-3"><h2 id="subscription-title" class="text-lg font-bold text-white">Suscripción B2B</h2><span [class]="subscriptionBadgeClass(t.subscription?.status)">{{ subscriptionStatusLabel(t.subscription?.status) }}</span></div>
              @if (t.subscription; as sub) {
                <dl class="mt-5 space-y-4 text-sm">
                  <div class="flex justify-between gap-3"><dt class="text-slate-400">Plan</dt><dd class="text-right font-medium text-white">{{ sub.planName ?? t.planName ?? t.plan ?? '—' }}</dd></div>
                  <div class="flex justify-between gap-3"><dt class="text-slate-400">Periodo desde</dt><dd class="text-right text-slate-200">{{ sub.currentPeriodStart ? (sub.currentPeriodStart | date:'dd MMM yyyy') : '—' }}</dd></div>
                  <div class="flex justify-between gap-3"><dt class="text-slate-400">Periodo hasta</dt><dd class="text-right text-slate-200">{{ sub.currentPeriodEnd ? (sub.currentPeriodEnd | date:'dd MMM yyyy') : '—' }}</dd></div>
                  <div class="flex justify-between gap-3 border-t border-slate-800 pt-4"><dt class="text-slate-400">Próximo cobro</dt><dd class="text-right font-semibold text-white">{{ sub.nextBillingAt ? (sub.nextBillingAt | date:'dd MMM yyyy') : '—' }}</dd></div>
                </dl>
                @if (sub.cancelAtPeriodEnd) { <p class="mt-4 rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-xs text-amber-200">Cancelación programada al cierre del periodo. {{ sub.cancellationReason || '' }}</p> }
              } @else { <p class="mt-4 rounded-lg border border-dashed border-slate-700 p-4 text-sm text-slate-400">No hay una suscripción registrada.</p> }
              <div class="mt-5 border-t border-slate-800 pt-5">
                <label class="block text-xs font-medium text-slate-400">Cambiar plan<select [(ngModel)]="selectedPlanUuid" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">Selecciona un plan</option>@for (plan of plans.plans(); track plan.publicUuid) { <option [value]="plan.publicUuid">{{ plan.name }} · {{ money(plan.pricePerStudentCents) }}/estudiante</option> }</select></label>
                @if (selectedPlan(); as plan) { <p class="mt-2 text-xs leading-5 text-slate-400">La facturación es variable según estudiantes activos. Límite: {{ fmt(plan.maxStudents) }} estudiantes · {{ fmt(plan.maxTeachers) }} docentes.</p> }
                <button type="button" (click)="assignPlan(t.publicUuid)" [disabled]="!selectedPlanUuid || actionBusy()" class="mt-3 w-full rounded-lg border border-indigo-500/50 px-4 py-2.5 text-sm font-semibold text-indigo-200 hover:bg-indigo-950/50 disabled:opacity-40">{{ actionBusy() === 'plan' ? 'Aplicando…' : 'Aplicar cambio de plan' }}</button>
              </div>
            </section>

            <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6" aria-labelledby="tenant-actions-title">
              <h2 id="tenant-actions-title" class="text-lg font-bold text-white">Administración</h2>
              <div class="mt-4 grid gap-2">
                @if (t.status === 'SUSPENDED') {
                  <button type="button" (click)="reactivate(t.publicUuid)" [disabled]="!!actionBusy()" class="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{{ actionBusy() === 'reactivate' ? 'Reactivando…' : 'Reactivar institución' }}</button>
                } @else {
                  <button type="button" (click)="showSuspend.set(true)" [disabled]="!!actionBusy()" class="rounded-lg border border-red-900 bg-red-950/30 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-950/70 disabled:opacity-50">Suspender institución</button>
                }
                <p class="text-xs leading-5 text-slate-500">Las acciones de soporte y los cambios administrativos quedan sujetos a auditoría.</p>
              </div>
            </section>

            <section class="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6" aria-labelledby="fiscal-title">
              <h2 id="fiscal-title" class="text-lg font-bold text-white">Información fiscal</h2>
              <p class="mt-3 text-sm leading-6 text-slate-400">No hay datos fiscales tipados disponibles para esta institución. Se mostrarán cuando estén registrados en el perfil de facturación.</p>
              <a [routerLink]="ROUTES.ADMIN.INVOICES" class="mt-4 inline-flex text-sm font-semibold text-indigo-300 hover:text-white">Ir a facturación →</a>
            </section>
          </aside>
        </div>
        } @else {
        <section class="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center"><h1 class="text-lg font-semibold text-white">Institución no encontrada</h1><p class="mt-2 text-sm text-slate-400">Verifica el enlace o vuelve al directorio.</p><a [routerLink]="ROUTES.ADMIN.TENANTS" class="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Volver al directorio</a></section>
        }
      }

      @if (showSuspend()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" (click)="closeSuspend()">
          <section role="dialog" aria-modal="true" aria-labelledby="suspend-title" class="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" (click)="$event.stopPropagation()">
            <h2 id="suspend-title" class="text-lg font-semibold text-white">Suspender institución</h2><p class="mt-2 text-sm text-slate-400">La suspensión y su motivo se conservarán en el registro de auditoría.</p>
            <label class="mt-4 block text-sm text-slate-300">Motivo<textarea [(ngModel)]="suspendReason" maxlength="500" rows="4" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"></textarea></label>
            <div class="mt-5 flex justify-end gap-2"><button type="button" (click)="closeSuspend()" class="rounded-lg border border-slate-700 px-4 py-2 text-slate-300 hover:bg-slate-800">Cancelar</button><button type="button" (click)="suspend()" [disabled]="!suspendReason.trim() || !!actionBusy()" class="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-40">{{ actionBusy() === 'suspend' ? 'Suspendiendo…' : 'Confirmar suspensión' }}</button></div>
          </section>
        </div>
      }
    </main>
  `,
})
export class AdminTenantDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly svc = inject(AdminTenantsService);
  protected readonly plans = inject(AdminPlansService);
  protected readonly invoices = inject(AdminInvoicesService);
  protected readonly ROUTES = ROUTES;
  protected readonly showSuspend = signal(false);
  protected readonly prepBusy = signal(false);
  protected readonly prepError = signal<string | null>(null);
  protected readonly actionBusy = signal<'suspend' | 'reactivate' | 'plan' | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly actionSuccess = signal<string | null>(null);
  protected readonly copied = signal<string | null>(null);
  protected tenantUrl(tenant: AdminTenantDetail): string {
    return tenantPublicUrl(tenant.slug);
  }
  protected prepVariant: PrepPackageVariant = 'PRODUCTION';
  protected suspendReason = '';
  protected selectedPlanUuid = '';

  ngOnInit(): void {
    this.reload();
    this.plans.loadCatalog();
  }

  protected reload(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (!uuid) return;
    this.svc.loadTenantDetail(uuid);
    this.invoices.loadTenantInvoices(uuid);
  }

  protected fmt(value: number | null | undefined): string {
    return typeof value === 'number' ? value.toLocaleString('es-PE') : '—';
  }

  protected formatCap(value: number | undefined): string {
    return typeof value === 'number' ? this.fmt(value) : 'sin límite';
  }

  protected initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'ED';
  }

  protected usagePercent(value: number | undefined, limit: number | undefined): number {
    if (typeof value !== 'number' || !limit || limit <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round(value / limit * 100)));
  }

  protected storagePercent(bytes: number | undefined, limitMb: number | undefined): number {
    if (typeof bytes !== 'number' || !limitMb || limitMb <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round(bytes / (limitMb * 1024 * 1024) * 100)));
  }

  protected formatBytes(value: number): string {
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
    return `${(value / (1024 * 1024 * 1024) >= 1 ? value / (1024 * 1024 * 1024) : value / (1024 * 1024)).toFixed(1)} ${value / (1024 * 1024 * 1024) >= 1 ? 'GB' : 'MB'}`;
  }

  protected formatLimit(value: number | undefined): string {
    if (typeof value !== 'number') return 'Sin límite configurado';
    return value >= 1024 ? `${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)} GB` : `${value} MB`;
  }

  protected statusClass(status: string): string {
    const styles: Record<string, string> = {
      ACTIVE: 'rounded-full border border-emerald-800 bg-emerald-950/70 px-3 py-1 text-xs font-semibold text-emerald-300',
      SUSPENDED: 'rounded-full border border-red-800 bg-red-950/70 px-3 py-1 text-xs font-semibold text-red-300',
      PENDING: 'rounded-full border border-amber-800 bg-amber-950/70 px-3 py-1 text-xs font-semibold text-amber-300',
      TRIAL: 'rounded-full border border-indigo-800 bg-indigo-950/70 px-3 py-1 text-xs font-semibold text-indigo-300',
    };
    return styles[status] ?? 'rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300';
  }

  protected statusLabel(status: string): string {
    return ({ ACTIVE: 'Activo', SUSPENDED: 'Suspendido', PENDING: 'Pendiente', TRIAL: 'Prueba' } as Record<string, string>)[status] ?? status;
  }

  protected subscriptionBadgeClass(status: string | undefined): string {
    if (status === 'ACTIVE') return 'rounded-md border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs font-semibold text-emerald-300';
    if (status === 'PAST_DUE' || status === 'TRIAL') return 'rounded-md border border-amber-800 bg-amber-950 px-2.5 py-1 text-xs font-semibold text-amber-300';
    return 'rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300';
  }

  protected subscriptionStatusLabel(status: string | undefined): string {
    return ({ ACTIVE: 'ACTIVA', TRIAL: 'PRUEBA', PAST_DUE: 'VENCIDA', CANCELED: 'CANCELADA', EXPIRED: 'EXPIRADA' } as Record<string, string>)[status ?? ''] ?? 'SIN SUSCRIPCIÓN';
  }

  protected moduleCards(tenant: AdminTenantDetail): TenantModuleCard[] {
    const descriptions: Record<string, [string, string]> = {
      LMS: ['Aula virtual', 'Cursos, materiales, tareas y actividades.'],
      REPORTS: ['Reportes', 'Indicadores académicos e informes.'],
      AI_GENERATE: ['Asistente IA', 'Funciones de generación con IA habilitadas por el plan.'],
      PAYMENTS: ['Pagos', 'Gestión de conceptos, cargos y conciliación.'],
      API_ACCESS: ['Acceso API', 'Integraciones mediante API de plataforma.'],
      DEDICATED_SUPPORT: ['Soporte dedicado', 'Atención prioritaria para la institución.'],
      ATTENDANCE: ['Asistencia', 'Registro y seguimiento de asistencia.'],
      EVALUATIONS: ['Evaluaciones', 'Calificaciones y evaluaciones académicas.'],
    };
    const flags = tenant.featureFlags ?? {};
    const keys = new Set([...(tenant.planFeatures ?? []), ...Object.keys(flags)]);
    return [...keys].sort().map((key) => {
      const [label, description] = descriptions[key] ?? [this.humanize(key), 'Función configurable de la plataforma.'];
      const override = flags[key];
      return { key, label, description, enabled: override === undefined ? (tenant.planFeatures ?? []).includes(key) : override === true };
    });
  }

  protected enabledModuleCount(tenant: AdminTenantDetail): number {
    return this.moduleCards(tenant).filter((module) => module.enabled).length;
  }

  protected rawConfig(tenant: AdminTenantDetail): Array<{ label: string; value: Record<string, unknown> }> {
    return [
      ...(tenant.branding && Object.keys(tenant.branding).length ? [{ label: 'Branding', value: tenant.branding }] : []),
      ...(tenant.featureFlags && Object.keys(tenant.featureFlags).length ? [{ label: 'Feature flags', value: tenant.featureFlags }] : []),
      ...(tenant.settings && Object.keys(tenant.settings).length ? [{ label: 'Settings', value: tenant.settings }] : []),
    ];
  }

  protected selectedPlan() {
    return this.plans.plans().find((plan) => plan.publicUuid === this.selectedPlanUuid) ?? null;
  }

  protected money(cents: number): string {
    return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  protected invoiceStatusLabel(status: string): string {
    return ({ PAID: 'Pagado', PENDING: 'Pendiente', OVERDUE: 'Vencido', CANCELLED: 'Anulado', REFUNDED: 'Reembolsado' } as Record<string, string>)[status] ?? status;
  }

  protected invoiceStatusClass(status: string): string {
    if (status === 'PAID') return 'text-xs text-emerald-300';
    if (status === 'OVERDUE') return 'text-xs text-red-300';
    return 'text-xs text-amber-300';
  }

  protected async copy(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.copied.set(label);
      window.setTimeout(() => this.copied.set(null), 1800);
    } catch {
      this.actionError.set('El navegador no permitió copiar el texto.');
    }
  }

  protected suspend(): void {
    const tenant = this.svc.selectedTenant();
    const reason = this.suspendReason.trim();
    if (!tenant || !reason || this.actionBusy()) return;
    this.runAction('suspend', this.svc.suspendTenant(tenant.publicUuid, reason), 'Institución suspendida.');
    this.showSuspend.set(false);
    this.suspendReason = '';
  }

  protected reactivate(uuid: string): void {
    if (this.actionBusy() || !window.confirm('¿Reactivar esta institución?')) return;
    this.runAction('reactivate', this.svc.reactivateTenant(uuid), 'Institución reactivada.');
  }

  protected assignPlan(tenantUuid: string): void {
    const plan = this.selectedPlan();
    if (!plan || this.actionBusy()) return;
    if (!window.confirm(`Aplicar ${plan.name} a esta institución? La facturación depende de los estudiantes activos.`)) return;
    this.runAction('plan', this.svc.assignPlan(tenantUuid, plan.publicUuid), 'Plan actualizado.');
    this.selectedPlanUuid = '';
  }

  private runAction(action: 'suspend' | 'reactivate' | 'plan', request: import('rxjs').Observable<void>, success: string): void {
    this.actionBusy.set(action);
    this.actionError.set(null);
    this.actionSuccess.set(null);
    request.pipe(finalize(() => this.actionBusy.set(null))).subscribe({
      next: () => this.actionSuccess.set(success),
      error: (error: { error?: { message?: string }; statusText?: string }) => this.actionError.set(error.error?.message ?? error.statusText ?? 'No se pudo completar la acción.'),
    });
  }

  protected closeSuspend(): void {
    if (this.actionBusy()) return;
    this.showSuspend.set(false);
    this.suspendReason = '';
  }

  protected downloadPrepPackage(schoolName: string): void {
    if (this.prepBusy()) return;
    this.prepBusy.set(true);
    this.prepError.set(null);
    this.svc.downloadPrepPackage(schoolName, this.prepVariant).subscribe({
      next: (blob) => {
        this.prepBusy.set(false);
        const slug = (schoolName || 'colegio').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'colegio';
        this.triggerBrowserDownload(blob, `prep-datos-${slug}.zip`);
      },
      error: (error: { error?: { message?: string }; statusText?: string }) => {
        this.prepBusy.set(false);
        this.prepError.set(error.error?.message ?? error.statusText ?? 'No se pudo descargar el pack.');
      },
    });
  }

  private triggerBrowserDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  private humanize(value: string): string {
    return value.toLowerCase().replaceAll('_', ' ').replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  }
}

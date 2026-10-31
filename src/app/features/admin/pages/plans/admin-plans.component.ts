import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminPlansService } from '../../services';
import { PlanAiPolicy, PlanAnalytics, PlatformPlan } from '../../models';
import { switchMap } from 'rxjs';

@Component({
  selector: 'app-admin-plans',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mx-auto max-w-[1600px] space-y-7 p-5 text-slate-100 md:p-8">
      <header class="flex flex-col justify-between gap-5 border-b border-slate-800 pb-6 lg:flex-row lg:items-center">
        <div>
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold tracking-tight md:text-3xl">Planes y Licencias B2B</h1>
            <span class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">{{ activePlanCount() }} planes activos</span>
          </div>
          <p class="mt-2 max-w-3xl text-sm text-slate-400">Precios, capacidades, módulos contratados y consumo de IA de las instituciones.</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="button" (click)="showProjection.set(true)" class="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700">Simular proyección MRR</button>
          <button type="button" (click)="openNew()" class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-500">＋ Nuevo plan</button>
        </div>
      </header>

      @if (svc.error(); as err) {
        <div role="alert" class="rounded-xl border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{{ err }}</div>
      }
      @if (pageError()) {
        <div role="alert" class="rounded-xl border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{{ pageError() }}</div>
      }
      @if (notice()) {
        <div role="status" class="rounded-xl border border-emerald-900/70 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">{{ notice() }}</div>
      }

      <section aria-label="Resumen del catálogo" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">MRR proyectado</p>
          <p class="mt-3 text-2xl font-bold">{{ money(totalMrrCents()) }}</p>
          <p class="mt-2 text-xs text-slate-500">Según matrículas y suscripciones activas</p>
        </article>
        <article class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Instituciones activas</p>
          <p class="mt-3 text-2xl font-bold">{{ totalInstitutions() }}</p>
          <p class="mt-2 text-xs text-slate-500">Con suscripción B2B activa</p>
        </article>
        <article class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Mayor MRR por plan</p>
          @if (topMrrPlan(); as top) {
            <p class="mt-3 text-xl font-bold">{{ planById(top.planId)?.name ?? 'Plan' }}</p>
            <p class="mt-2 text-xs text-slate-400">{{ money(top.projectedMrrCents) }} · {{ top.activeInstitutions }} instituciones</p>
          } @else {
            <p class="mt-3 text-xl font-bold">Sin datos</p>
            <p class="mt-2 text-xs text-slate-500">No hay suscripciones activas</p>
          }
        </article>
        <article class="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Uso global de tokens IA</p>
          @if (totalTokenQuota() > 0) {
            <p class="mt-3 text-2xl font-bold">{{ tokenPercent() }}<span class="ml-1 text-base text-slate-400">%</span></p>
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-cyan-400" [style.width.%]="tokenPercent()"></div></div>
          } @else {
            <p class="mt-3 text-xl font-bold">Sin cuota configurada</p>
          }
          <p class="mt-2 text-xs text-slate-500">{{ compact(totalTokensUsed()) }} de {{ compact(totalTokenQuota()) }} tokens asignados este mes</p>
        </article>
      </section>

      <section aria-labelledby="plan-cards-title">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div><h2 id="plan-cards-title" class="text-lg font-semibold">Estructura comercial</h2><p class="mt-1 text-sm text-slate-400">Precio por estudiante matriculado al mes, en soles.</p></div>
          <button type="button" (click)="svc.loadCatalog()" [disabled]="svc.loading()" class="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">Actualizar datos</button>
        </div>
        @if (svc.loading() && svc.plans().length === 0) {
          <div class="grid gap-4 lg:grid-cols-3">@for (item of [1, 2, 3]; track item) { <div class="h-64 animate-pulse rounded-2xl border border-slate-800 bg-slate-900"></div> }</div>
        } @else if (svc.plans().length === 0) {
          <div class="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-10 text-center text-slate-400">Todavía no hay planes. Crea el primer plan para configurar el catálogo.</div>
        } @else {
          <div class="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            @for (plan of svc.plans(); track plan.publicUuid) {
              <article class="flex flex-col rounded-2xl border bg-slate-900/80 p-5" [class]="plan.isActive ? 'flex flex-col rounded-2xl border border-indigo-500/70 bg-slate-900/80 p-5' : 'flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 p-5 opacity-70'">
                <div class="flex items-start justify-between gap-3">
                  <div><span class="rounded-md bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-300">{{ plan.code }}</span><h3 class="mt-3 text-xl font-bold">{{ plan.name }}</h3></div>
                  <span [class]="plan.isActive ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300' : 'rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400'">{{ plan.isActive ? 'Activo' : 'Inactivo' }}</span>
                </div>
                @if (plan.description) { <p class="mt-2 min-h-10 text-sm text-slate-400">{{ plan.description }}</p> }
                <div class="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4"><span class="text-2xl font-bold">{{ money(plan.pricePerStudentCents) }}</span><span class="ml-2 text-xs text-slate-400">/ estudiante / mes</span></div>
                <div class="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div class="rounded-lg bg-slate-800/70 p-2"><span class="block text-slate-500">Estudiantes</span><strong class="mt-1 block">{{ limit(plan.maxStudents) }}</strong></div>
                  <div class="rounded-lg bg-slate-800/70 p-2"><span class="block text-slate-500">Personal</span><strong class="mt-1 block">{{ limit(plan.maxTeachers) }}</strong></div>
                  <div class="rounded-lg bg-slate-800/70 p-2"><span class="block text-slate-500">Almacenamiento</span><strong class="mt-1 block">{{ storage(plan.maxStorageMb) }}</strong></div>
                </div>
                <div class="mt-4 flex-1"><p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Características</p><div class="mt-2 flex flex-wrap gap-1.5">
                  @for (feature of plan.features; track feature) { <span class="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[11px] text-indigo-200">{{ humanize(feature) }}</span> }
                  @if (!plan.features.length) { <span class="text-xs text-slate-500">Sin características asignadas</span> }
                </div></div>
                <div class="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-xs">
                  <span class="text-slate-400">{{ analyticsFor(plan.publicUuid)?.activeInstitutions ?? 0 }} instituciones · {{ analyticsFor(plan.publicUuid)?.enrolledStudents ?? 0 }} matrículas</span>
                  <span class="font-semibold text-slate-200">MRR {{ money(analyticsFor(plan.publicUuid)?.projectedMrrCents ?? 0) }}</span>
                </div>
                <div class="mt-4 flex gap-2"><button type="button" (click)="openEdit(plan)" class="flex-1 rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800">Configurar plan</button>
                  @if (plan.isActive) { <button type="button" (click)="toggleActive(plan, false)" [disabled]="busyPlanId() === plan.publicUuid" class="rounded-lg border border-rose-900/70 px-3 py-2 text-sm text-rose-300 hover:bg-rose-950/40 disabled:opacity-50">Desactivar</button> }
                  @else { <button type="button" (click)="toggleActive(plan, true)" [disabled]="busyPlanId() === plan.publicUuid" class="rounded-lg border border-emerald-900/70 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-950/40 disabled:opacity-50">Reactivar</button> }
                </div>
              </article>
            }
          </div>
        }
      </section>

      <section class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        <div class="flex flex-col gap-4 border-b border-slate-800 p-5 xl:flex-row xl:items-end xl:justify-between">
          <div><h2 class="text-lg font-semibold">Matriz de módulos y características</h2><p class="mt-1 text-sm text-slate-400">Compara límites, adopción y estado por plan.</p></div>
          <div class="flex flex-col gap-2 sm:flex-row">
            <label class="sr-only" for="plan-search">Buscar plan o característica</label><input id="plan-search" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Buscar plan, código o característica…" class="min-w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none" />
            <label class="sr-only" for="plan-status">Filtrar por estado</label><select id="plan-status" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"><option value="all">Todos los estados</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select>
            <button type="button" (click)="exportCsv()" class="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">Exportar CSV</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[850px] text-left text-sm">
            <thead class="bg-slate-950/70 text-[11px] uppercase tracking-wide text-slate-400"><tr><th class="px-5 py-3">Plan</th><th class="px-4 py-3">Precio / alumno</th><th class="px-4 py-3">Límites</th><th class="px-4 py-3">Módulos</th><th class="px-4 py-3">Instituciones</th><th class="px-4 py-3">Estado</th><th class="px-4 py-3">Acciones</th></tr></thead>
            <tbody class="divide-y divide-slate-800">
              @for (plan of filteredPlans(); track plan.publicUuid) {
                <tr class="hover:bg-slate-800/30"><td class="px-5 py-4"><strong>{{ plan.name }}</strong><span class="ml-2 font-mono text-xs text-slate-500">{{ plan.code }}</span></td><td class="px-4 py-4">{{ money(plan.pricePerStudentCents) }}</td><td class="px-4 py-4 text-xs text-slate-300">{{ limit(plan.maxStudents) }} alumnos<br />{{ limit(plan.maxTeachers) }} personal · {{ storage(plan.maxStorageMb) }}</td><td class="max-w-sm px-4 py-4"><div class="flex flex-wrap gap-1">@for (feature of plan.features; track feature) { <span class="rounded bg-slate-800 px-1.5 py-1 font-mono text-[10px] text-slate-300">{{ humanize(feature) }}</span> }</div></td><td class="px-4 py-4">{{ analyticsFor(plan.publicUuid)?.activeInstitutions ?? 0 }}</td><td class="px-4 py-4"><span [class.text-emerald-300]="plan.isActive" [class.text-slate-500]="!plan.isActive">{{ plan.isActive ? 'Activo' : 'Inactivo' }}</span></td><td class="px-4 py-4"><button type="button" (click)="openEdit(plan)" class="text-indigo-300 hover:text-indigo-200">Editar</button></td></tr>
              } @empty { <tr><td colspan="7" class="px-5 py-10 text-center text-slate-500">No hay planes que coincidan con estos filtros.</td></tr> }
            </tbody>
          </table>
        </div>
        <div class="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">Mostrando {{ filteredPlans().length }} de {{ svc.plans().length }} planes · Uso de tokens según contadores del mes UTC en curso.</div>
      </section>
    </main>

    @if (showForm()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" (click)="closeForm()" (keydown.escape)="closeForm()">
        <section role="dialog" aria-modal="true" aria-labelledby="plan-dialog-title" class="my-auto max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-4"><div><h2 id="plan-dialog-title" class="text-xl font-bold">{{ editingUuid() ? 'Configurar plan' : 'Crear plan' }}</h2><p class="mt-1 text-sm text-slate-400">El precio se expresa por estudiante matriculado y mes.</p></div><button type="button" (click)="closeForm()" [disabled]="saving()" aria-label="Cerrar" class="rounded-lg px-2 text-xl text-slate-400 hover:bg-slate-800">×</button></div>
          @if (formError()) { <div role="alert" class="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-200">{{ formError() }}</div> }
          <div class="mt-5 grid gap-4 md:grid-cols-2">
            <label class="text-sm text-slate-300">Nombre<input [(ngModel)]="form.name" maxlength="50" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
            <label class="text-sm text-slate-300">Código<input [(ngModel)]="form.code" maxlength="30" [disabled]="!!editingUuid()" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono uppercase text-white disabled:opacity-50" /></label>
            <label class="text-sm text-slate-300 md:col-span-2">Descripción<textarea [(ngModel)]="form.description" rows="2" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"></textarea></label>
            <label class="text-sm text-slate-300">Precio (S/ por alumno / mes)<input type="number" min="0.01" step="0.01" [(ngModel)]="form.priceSoles" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
            <label class="text-sm text-slate-300">Orden de visualización<input type="number" min="0" step="1" [(ngModel)]="form.sortOrder" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
            <label class="text-sm text-slate-300">Máximo de estudiantes <span class="text-slate-500">(vacío = sin límite)</span><input type="number" min="1" [(ngModel)]="form.maxStudents" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
            <label class="text-sm text-slate-300">Máximo de personal <span class="text-slate-500">(vacío = sin límite)</span><input type="number" min="1" [(ngModel)]="form.maxTeachers" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
            <label class="text-sm text-slate-300">Almacenamiento máximo (MB)<input type="number" min="1" step="1" [(ngModel)]="form.maxStorageMb" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
            <label class="text-sm text-slate-300 md:col-span-2">Módulos y características <span class="text-slate-500">(códigos separados por coma)</span><textarea [(ngModel)]="form.features" rows="3" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-white"></textarea></label>
          </div>
          <div class="mt-6 border-t border-slate-800 pt-5"><h3 class="font-semibold">Cuotas de IA</h3><p class="mt-1 text-xs text-slate-500">Límites del plan; la cuota efectiva por institución puede ser menor.</p>
            <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label class="text-sm text-slate-300">Solicitudes IA / día<input type="number" min="0" [(ngModel)]="form.ai.dailyRequestLimit" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
              <label class="text-sm text-slate-300">Tokens IA / mes<input type="number" min="0" [(ngModel)]="form.ai.monthlyTokenLimit" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
              <label class="text-sm text-slate-300">Mensajes tutor / alumno / día<input type="number" min="0" [(ngModel)]="form.ai.tutorMessagesPerStudentDay" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
              <label class="text-sm text-slate-300">Documentos institucionales<input type="number" min="0" [(ngModel)]="form.ai.institutionalDocumentLimit" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
              <label class="text-sm text-slate-300">Texto indexable (bytes)<input type="number" min="0" [(ngModel)]="form.ai.institutionalTextBytesLimit" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white" /></label>
            </div>
          </div>
          <div class="mt-7 flex justify-end gap-3"><button type="button" (click)="closeForm()" [disabled]="saving()" class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300">Cancelar</button><button type="button" (click)="save()" [disabled]="saving()" class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{{ saving() ? 'Guardando…' : 'Guardar cambios' }}</button></div>
        </section>
      </div>
    }

    @if (showProjection()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4" (click)="showProjection.set(false)">
        <section role="dialog" aria-modal="true" aria-labelledby="projection-title" class="my-auto w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" (click)="$event.stopPropagation()">
          <h2 id="projection-title" class="text-xl font-bold">Simular MRR</h2><p class="mt-1 text-sm text-slate-400">Ingresa una cantidad estimada de estudiantes por plan. El cálculo no modifica suscripciones ni facturas.</p>
          <div class="mt-5 space-y-3">@for (plan of activePlans(); track plan.publicUuid) { <label class="flex items-center justify-between gap-4 rounded-xl border border-slate-800 p-3"><span><strong>{{ plan.name }}</strong><small class="ml-2 text-slate-400">{{ money(plan.pricePerStudentCents) }} / alumno</small></span><input type="number" min="0" step="1" [ngModel]="projectionStudents()[plan.publicUuid]" (ngModelChange)="setProjectionStudents(plan.publicUuid, $event)" [attr.aria-label]="'Estudiantes estimados para ' + plan.name" class="w-28 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-right text-white" /></label> }</div>
          <div class="mt-5 flex items-center justify-between rounded-xl bg-indigo-950/50 p-4"><span class="text-sm text-indigo-200">MRR manual estimado</span><strong class="text-2xl">{{ money(projectedMrrCents()) }}</strong></div>
          <div class="mt-5 flex justify-end"><button type="button" (click)="showProjection.set(false)" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Cerrar</button></div>
        </section>
      </div>
    }
  `,
})
export class AdminPlansComponent implements OnInit {
  protected readonly svc = inject(AdminPlansService);
  protected readonly showForm = signal(false);
  protected readonly showProjection = signal(false);
  protected readonly editingUuid = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly busyPlanId = signal<string | null>(null);
  protected readonly notice = signal('');
  protected readonly pageError = signal('');
  protected readonly formError = signal('');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  protected readonly projectionStudents = signal<Record<string, number>>({});
  protected readonly form = this.emptyForm();
  protected readonly activePlans = computed(() => this.svc.plans().filter((plan) => plan.isActive));
  protected readonly activePlanCount = computed(() => this.activePlans().length);
  protected readonly filteredPlans = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.svc.plans().filter((plan) => {
      const statusMatches = this.statusFilter() === 'all' || (this.statusFilter() === 'active' ? plan.isActive : !plan.isActive);
      const textMatches = !query || `${plan.name} ${plan.code} ${plan.description ?? ''} ${plan.features.join(' ')}`.toLocaleLowerCase().includes(query);
      return statusMatches && textMatches;
    });
  });
  protected readonly totalMrrCents = computed(() => this.svc.analytics().reduce((sum, row) => sum + row.projectedMrrCents, 0));
  protected readonly totalInstitutions = computed(() => this.svc.analytics().reduce((sum, row) => sum + row.activeInstitutions, 0));
  protected readonly topMrrPlan = computed(() => this.svc.analytics().filter((row) => row.activeInstitutions > 0).sort((a, b) => b.projectedMrrCents - a.projectedMrrCents)[0]);
  protected readonly totalTokensUsed = computed(() => this.svc.analytics().reduce((sum, row) => sum + row.aiTokensUsedThisMonth, 0));
  protected readonly totalTokenQuota = computed(() => this.svc.analytics().reduce((sum, row) => sum + row.aiTokenQuotaThisMonth, 0));
  protected readonly tokenPercent = computed(() => this.totalTokenQuota() > 0 ? Math.min(100, Math.round(this.totalTokensUsed() * 100 / this.totalTokenQuota())) : 0);
  protected readonly projectedMrrCents = computed(() => this.activePlans().reduce((sum, plan) => sum + plan.pricePerStudentCents * (this.projectionStudents()[plan.publicUuid] ?? 0), 0));

  ngOnInit(): void { this.svc.loadCatalog(); }

  protected analyticsFor(uuid: string): PlanAnalytics | undefined { return this.svc.analytics().find((row) => row.planId === uuid); }
  protected planById(uuid: string): PlatformPlan | undefined { return this.svc.plans().find((plan) => plan.publicUuid === uuid); }
  protected money(cents: number): string { return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  protected compact(value: number): string { return new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
  protected limit(value?: number): string { return value == null ? 'Sin límite' : value.toLocaleString('es-PE'); }
  protected storage(value?: number): string { return value == null ? 'Sin límite' : value >= 1024 ? `${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)} GB` : `${value} MB`; }
  protected humanize(value: string): string { return value.toLocaleLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase()); }

  protected openNew(): void {
    this.editingUuid.set(null);
    Object.assign(this.form, this.emptyForm());
    this.formError.set('');
    this.showForm.set(true);
  }

  protected openEdit(plan: PlatformPlan): void {
    this.editingUuid.set(plan.publicUuid);
    const policy = this.svc.policies()[plan.publicUuid];
    Object.assign(this.form, {
      name: plan.name,
      code: plan.code,
      description: plan.description ?? '',
      priceSoles: plan.pricePerStudentCents / 100,
      maxStudents: plan.maxStudents == null ? '' : String(plan.maxStudents),
      maxTeachers: plan.maxTeachers == null ? '' : String(plan.maxTeachers),
      maxStorageMb: plan.maxStorageMb ?? 0,
      sortOrder: plan.sortOrder,
      features: plan.features.join(', '),
      ai: policy ? { ...policy } : this.emptyPolicy(plan.publicUuid),
    });
    this.formError.set('');
    this.showForm.set(true);
  }

  protected closeForm(): void { if (!this.saving()) this.showForm.set(false); }

  protected save(): void {
    this.formError.set('');
    const invalidCapacity = !this.validOptionalLimit(this.form.maxStudents) || !this.validOptionalLimit(this.form.maxTeachers);
    const quotas = Object.values(this.form.ai).filter((value): value is number => typeof value === 'number');
    if (!this.form.name.trim() || !this.form.code.trim() || !Number.isFinite(this.form.priceSoles) || Math.round(this.form.priceSoles * 100) < 1 || !Number.isInteger(this.form.maxStorageMb) || this.form.maxStorageMb < 1 || invalidCapacity || !Number.isInteger(this.form.sortOrder) || this.form.sortOrder < 0 || quotas.some((quota) => !Number.isInteger(quota) || quota < 0)) {
      this.formError.set('Revisa nombre, código, precio, capacidades, orden, almacenamiento y cuotas. Los límites deben ser enteros válidos.');
      return;
    }
    const uuid = this.editingUuid();
    const request = {
      name: this.form.name.trim(),
      code: this.form.code.trim().toUpperCase(),
      description: this.form.description.trim() || undefined,
      pricePerStudentCents: Math.round(this.form.priceSoles * 100),
      maxStudents: this.parseOptionalLimit(this.form.maxStudents),
      maxTeachers: this.parseOptionalLimit(this.form.maxTeachers),
      maxStorageMb: Math.round(this.form.maxStorageMb),
      sortOrder: Math.max(0, Math.round(this.form.sortOrder)),
      features: [...new Set(this.form.features.split(',').map((feature) => feature.trim()).filter(Boolean))],
    };
    const policy = { ...this.form.ai, planId: uuid ?? '' };
    let planSaved = false;
    this.saving.set(true);
    const savePlan$ = uuid
      ? this.svc.updatePlan(uuid, { ...request, clearMaxStudents: !String(this.form.maxStudents).trim(), clearMaxTeachers: !String(this.form.maxTeachers).trim() })
      : this.svc.createPlan(request);
    savePlan$.pipe(switchMap((plan) => {
      planSaved = true;
      return this.svc.saveAiPolicy({ ...policy, planId: plan.publicUuid });
    })).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.notice.set('Plan y cuotas de IA guardados.');
        this.svc.loadCatalog();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.formError.set(planSaved ? 'El plan se guardó, pero no se pudieron guardar sus cuotas de IA. Vuelve a editar el plan para reintentarlo.' : this.message(error));
        if (planSaved) this.svc.loadCatalog();
      },
    });
  }

  protected toggleActive(plan: PlatformPlan, active: boolean): void {
    const action = active ? 'reactivar' : 'desactivar';
    if (!window.confirm(`¿Quieres ${action} el plan ${plan.name}?`)) return;
    this.pageError.set('');
    this.busyPlanId.set(plan.publicUuid);
    this.svc.setPlanActive(plan.publicUuid, active).subscribe({
      next: () => { this.busyPlanId.set(null); this.notice.set(`Plan ${active ? 'reactivado' : 'desactivado'}.`); this.svc.loadCatalog(); },
      error: (error: unknown) => { this.busyPlanId.set(null); this.pageError.set(this.message(error)); },
    });
  }

  protected setProjectionStudents(uuid: string, value: number): void {
    const parsed = Number(value);
    this.projectionStudents.update((current) => ({ ...current, [uuid]: Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0 }));
  }

  protected exportCsv(): void {
    const rows = [['Plan', 'Código', 'Precio PEN por alumno', 'Máximo estudiantes', 'Máximo personal', 'Almacenamiento MB', 'Instituciones activas', 'Matrículas activas', 'MRR proyectado PEN', 'Estado', 'Características']];
    for (const plan of this.filteredPlans()) {
      const stats = this.analyticsFor(plan.publicUuid);
      rows.push([plan.name, plan.code, (plan.pricePerStudentCents / 100).toFixed(2), plan.maxStudents?.toString() ?? 'Sin límite', plan.maxTeachers?.toString() ?? 'Sin límite', plan.maxStorageMb?.toString() ?? 'Sin límite', String(stats?.activeInstitutions ?? 0), String(stats?.enrolledStudents ?? 0), ((stats?.projectedMrrCents ?? 0) / 100).toFixed(2), plan.isActive ? 'Activo' : 'Inactivo', plan.features.join('|')]);
    }
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'edushift-planes.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private parseOptionalLimit(value: string | number): number | undefined {
    const normalized = String(value).trim();
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
  }

  private validOptionalLimit(value: string | number): boolean {
    const normalized = String(value).trim();
    if (!normalized) return true;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0;
  }

  private message(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const payload = (error as { error?: { message?: unknown } }).error;
      if (typeof payload?.message === 'string') return payload.message;
    }
    return 'No se pudo guardar el cambio. Inténtalo nuevamente.';
  }

  private emptyPolicy(planId: string): PlanAiPolicy {
    return { planId, dailyRequestLimit: 0, monthlyTokenLimit: 0, tutorMessagesPerStudentDay: 0, institutionalDocumentLimit: 0, institutionalTextBytesLimit: 0 };
  }

  private emptyForm() {
    return { name: '', code: '', description: '', priceSoles: 0, maxStudents: '', maxTeachers: '', maxStorageMb: 0, sortOrder: 0, features: '', ai: this.emptyPolicy('') };
  }
}

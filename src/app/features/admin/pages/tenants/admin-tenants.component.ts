import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ROUTES } from '@core/constants';
import { AdminTenantsService, PrepPackageVariant, SchoolInvitationDto } from '../../services';
import { tenantPublicUrl } from './tenant-url';

@Component({
  selector: 'app-admin-tenants',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="space-y-5 p-4 sm:p-6">
      <header class="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h1 class="text-2xl font-bold text-white sm:text-3xl">Instituciones Educativas</h1>
            <span class="rounded-full border border-indigo-500/30 bg-indigo-950/50 px-2.5 py-1 text-xs text-indigo-300">
              {{ svc.totalElements().toLocaleString('es-PE') }} resultados
            </span>
            @if (svc.overview(); as overview) {
              <span class="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-300">
                {{ overview.activeTenants.toLocaleString('es-PE') }} activos
              </span>
            }
          </div>
          <p class="mt-1 text-sm text-slate-400">Directorio multiinstitucional, planes, capacidad y estado de cobranza.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" (click)="downloadPrepPackage()" [disabled]="prepBusy()"
            class="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 hover:border-indigo-500/60 disabled:opacity-50">
            {{ prepBusy() ? 'Generando pack…' : 'Descargar pack onboarding' }}
          </button>
          <button type="button" (click)="toggleInvite()"
            class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-500">
            {{ showInvite() ? 'Cerrar invitación' : '+ Invitar colegio' }}
          </button>
        </div>
      </header>

      @if (prepError(); as err) {
        <div role="alert" class="rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{{ err }}</div>
      }
      @if (copyError(); as err) {
        <div role="alert" class="rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{{ err }}</div>
      }

      @if (svc.overviewError(); as overviewError) {
        <div class="rounded-lg border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          {{ overviewError }} <button type="button" (click)="svc.loadOverview()" class="ml-2 underline">Reintentar</button>
        </div>
      }

      <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de plataforma">
        <article class="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Colegios activos</p>
          @if (svc.overviewLoading()) { <div class="mt-3 h-8 w-24 animate-pulse rounded bg-slate-800"></div> }
          @else { <p class="mt-2 text-3xl font-bold text-white">{{ overviewValue('activeTenants') }}</p> }
          <p class="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-500">Instituciones habilitadas en la plataforma</p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Padrón estudiantil</p>
          @if (svc.overviewLoading()) { <div class="mt-3 h-8 w-28 animate-pulse rounded bg-slate-800"></div> }
          @else { <p class="mt-2 text-3xl font-bold text-white">{{ overviewValue('activeStudents') }}</p> }
          <p class="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-500">Estudiantes matriculados en colegios activos</p>
        </article>
        <article class="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Ingreso mensual estimado</p>
          @if (svc.overviewLoading()) { <div class="mt-3 h-8 w-36 animate-pulse rounded bg-slate-800"></div> }
          @else { <p class="mt-2 text-3xl font-bold text-white">{{ overviewMoney('mrr') }}</p> }
          <p class="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-500">Estimado según planes y padrón activo</p>
        </article>
        <article class="rounded-xl border border-rose-900/50 bg-slate-900/80 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Cobranza vencida</p>
          @if (svc.overviewLoading()) { <div class="mt-3 h-8 w-36 animate-pulse rounded bg-slate-800"></div> }
          @else { <p class="mt-2 text-3xl font-bold text-rose-300">{{ overviewMoney('overdue') }}</p> }
          <p class="mt-2 border-t border-slate-800 pt-2 text-xs text-slate-500">{{ collectionRateLabel() }} de recaudación del mes</p>
        </article>
      </section>
      @if (svc.overview()?.lastUpdated; as updatedAt) {
        <p class="-mt-3 text-right text-[11px] text-slate-500">Indicadores actualizados: {{ updatedAt | date: 'short' }}</p>
      }

      @if (showInvite()) {
        <section class="grid gap-4 rounded-xl border border-indigo-900/70 bg-indigo-950/20 p-4 lg:grid-cols-[1.4fr_1fr] lg:p-5">
          <div>
            <div class="flex items-center gap-2">
              <span class="rounded-md bg-indigo-500/20 px-2 py-1 text-indigo-300">✉</span>
              <h2 class="font-semibold text-white">Aprovisionamiento rápido</h2>
              <span class="rounded bg-indigo-900/70 px-2 py-1 text-[10px] font-mono text-indigo-300">SETUP</span>
            </div>
            <p class="mt-2 max-w-2xl text-sm text-slate-400">Enviaremos un enlace para que el colegio registre sus datos y cree la cuenta administradora. El plan se asigna desde el detalle luego del alta.</p>
            <div class="mt-4 flex flex-col gap-2 sm:flex-row">
              <label class="sr-only" for="tenant-invite-email">Correo del administrador</label>
              <input id="tenant-invite-email" type="email" [(ngModel)]="inviteEmail" (keyup.enter)="sendInvite()"
                placeholder="directora@colegio.edu.pe" autocomplete="email"
                class="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
              <button type="button" (click)="sendInvite()" [disabled]="inviteBusy() || !inviteEmail.trim()"
                class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                {{ inviteBusy() ? 'Enviando…' : 'Enviar invitación →' }}
              </button>
            </div>
            @if (inviteMessage(); as msg) { <p role="status" class="mt-3 text-sm text-emerald-300">{{ msg }}</p> }
            @if (lastSetupUrl(); as url) {
              <div class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <span class="min-w-0 flex-1 break-all font-mono text-xs text-slate-300">{{ url }}</span>
                <button type="button" (click)="copyLastUrl()" class="text-xs font-medium text-indigo-300 hover:text-white">Copiar enlace</button>
              </div>
            }
            @if (inviteError(); as err) { <p role="alert" class="mt-3 text-sm text-rose-300">{{ err }}</p> }
          </div>
          <div class="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-slate-200">Pack de onboarding</h3><span class="text-xs text-slate-500">ZIP · PDF + Excel</span>
            </div>
            <p class="mt-2 text-xs leading-relaxed text-slate-400">Prepara plantillas y guía de carga antes de iniciar la configuración institucional.</p>
            <div class="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <label class="text-xs text-slate-400">Nombre del colegio
                <input type="text" [(ngModel)]="prepSchoolName" placeholder="Nombre opcional"
                  class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
              </label>
              <label class="text-xs text-slate-400">Variante
                <select [(ngModel)]="prepVariant" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                  <option value="PILOT">Piloto</option><option value="PRODUCTION">Producción</option>
                </select>
              </label>
            </div>
            <button type="button" (click)="downloadPrepPackage()" [disabled]="prepBusy()"
              class="mt-3 w-full rounded-lg border border-indigo-500/50 bg-indigo-950/40 px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-900/50 disabled:opacity-50">
              {{ prepBusy() ? 'Generando pack…' : '↓ Descargar ZIP' }}
            </button>
          </div>
          @if (pendingInvites().length > 0) {
            <div class="border-t border-slate-800 pt-3 lg:col-span-2">
              <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Invitaciones pendientes</h3>
              <ul class="mt-2 divide-y divide-slate-800/80">
                @for (inv of pendingInvites(); track inv.publicUuid) {
                  <li class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <span class="text-slate-200">{{ inv.email }}</span>
                    <span class="text-xs text-slate-500">Vence {{ inv.expiresAt ? (inv.expiresAt | date: 'mediumDate') : '—' }}</span>
                    <div class="flex gap-3">
                      <button type="button" class="text-xs text-indigo-300 hover:text-white" (click)="resendInvite(inv.publicUuid)">Reenviar</button>
                      <button type="button" class="text-xs text-rose-300 hover:text-white" (click)="cancelInvite(inv.publicUuid)">Cancelar</button>
                    </div>
                  </li>
                }
              </ul>
            </div>
          }
        </section>
      }

      <section class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 lg:flex-row lg:items-center" aria-label="Buscar y filtrar instituciones">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Buscar institución</span>
          <input type="search" [(ngModel)]="search" (keyup.enter)="applyFilters()"
            placeholder="Buscar por institución o slug…"
            class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none" />
        </label>
        <label><span class="sr-only">Filtrar por estado</span>
          <select [(ngModel)]="statusFilter" (change)="applyFilters()" class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none">
            <option value="">Todos los estados</option><option value="ACTIVE">Activo</option><option value="SUSPENDED">Suspendido</option><option value="PENDING">Pendiente</option><option value="TRIAL">Prueba</option>
          </select>
        </label>
        <label><span class="sr-only">Filtrar por plan</span>
          <select [(ngModel)]="planFilter" (change)="applyFilters()" class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none">
            <option value="">Todos los planes</option><option value="BASIC">Básico</option><option value="PRO">Pro</option><option value="ENTERPRISE">Enterprise</option><option value="TRIAL">Trial</option>
          </select>
        </label>
        <label><span class="sr-only">Ordenar instituciones</span>
          <select [(ngModel)]="sort" (change)="applyFilters()" class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none">
            <option value="recent">Más recientes</option><option value="students">Más alumnos</option><option value="billing">Próximo cobro</option><option value="name">Nombre A–Z</option>
          </select>
        </label>
        <label><span class="sr-only">Resultados por página</span>
          <select [(ngModel)]="pageSize" (change)="applyFilters()" class="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none">
            <option [ngValue]="10">10 / pág.</option><option [ngValue]="20">20 / pág.</option><option [ngValue]="50">50 / pág.</option>
          </select>
        </label>
        <button type="button" (click)="applyFilters()" class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500">Buscar</button>
      </section>

      @if (svc.error(); as err) {
        <div role="alert" class="rounded-lg border border-rose-900/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{{ err }} <button type="button" (click)="load()" class="ml-2 underline">Reintentar</button></div>
      }

      <section class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
          <h2 class="text-sm font-semibold text-white">Directorio de instituciones</h2>
          <span class="text-xs text-slate-500">{{ svc.totalElements().toLocaleString('es-PE') }} resultados</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[900px] text-sm">
            <thead class="sticky top-0 bg-slate-900 text-left text-[11px] uppercase tracking-wider text-slate-400">
              <tr><th scope="col" class="px-4 py-3">Institución</th><th scope="col" class="px-4 py-3">Slug</th><th scope="col" class="px-4 py-3">Plan</th><th scope="col" class="px-4 py-3">Alumnos / capacidad</th><th scope="col" class="px-4 py-3">Estado</th><th scope="col" class="px-4 py-3">Próximo cobro</th><th scope="col" class="px-4 py-3 text-right">Acciones</th></tr>
            </thead>
            <tbody class="divide-y divide-slate-800/80">
              @if (svc.loading() && svc.tenants().length === 0) {
                @for (row of [1, 2, 3, 4]; track row) { <tr><td colspan="7" class="px-4 py-4"><div class="h-9 animate-pulse rounded bg-slate-900"></div></td></tr> }
              } @else {
                @for (t of svc.tenants(); track t.publicUuid) {
                  <tr class="transition-colors hover:bg-slate-900/70" [class.opacity-60]="svc.loading()">
                    <td class="px-4 py-3"><div class="flex items-center gap-3"><span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-indigo-500/30 bg-indigo-950/60 text-xs font-bold text-indigo-200">{{ initials(t.name) }}</span><div class="min-w-0"><div class="max-w-[15rem] truncate font-semibold text-white">{{ t.name }}</div><div class="text-xs text-slate-500">{{ t.status === 'SUSPENDED' ? 'Acceso suspendido' : 'Institución educativa' }}</div></div></div></td>
                    <td class="px-4 py-3"><code class="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-300">{{ t.slug }}</code></td>
                    <td class="px-4 py-3"><span class="rounded-md border border-indigo-500/25 bg-indigo-950/40 px-2 py-1 text-xs text-indigo-200">{{ t.planName ?? t.plan ?? 'Sin plan' }}</span></td>
                    <td class="px-4 py-3"><div class="flex items-baseline gap-1.5"><span class="font-semibold text-white">{{ studentCount(t.activeStudents) }}</span><span class="text-xs text-slate-500">/ {{ t.maxStudents ?? '—' }}</span></div>@if (t.maxStudents && t.maxStudents > 0) { <div class="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-indigo-500" [style.width.%]="capacityPercent(t.activeStudents, t.maxStudents)"></div></div> }</td>
                    <td class="px-4 py-3"><span [class]="statusClass(t.status)">{{ statusLabel(t.status) }}</span></td>
                    <td class="px-4 py-3"><div class="text-slate-200">{{ t.nextBillingDate ? (t.nextBillingDate | date: 'mediumDate') : '—' }}</div><span class="text-xs text-slate-500">{{ t.nextBillingDate ? billingLabel(t.nextBillingDate) : 'Sin fecha programada' }}</span></td>
                    <td class="px-4 py-3"><div class="flex items-center justify-end gap-3"><button type="button" (click)="copyTenantUrl(t)" class="text-xs text-slate-400 hover:text-white">{{ copiedTenantUrl() === t.publicUuid ? 'URL copiada' : 'Copiar URL' }}</button><a [routerLink]="['/admin/tenants', t.publicUuid]" class="text-xs font-medium text-indigo-300 hover:text-white">Ver detalle</a>@if (t.status === 'ACTIVE') { <a [routerLink]="ROUTES.ADMIN.SUPPORT" [queryParams]="{ tenant: t.publicUuid, tenantName: t.name }" class="text-xs text-slate-400 hover:text-white">Soporte</a> }</div></td>
                  </tr>
                } @empty {
                  <tr><td colspan="7" class="px-4 py-10 text-center"><p class="font-medium text-slate-200">{{ svc.loading() ? 'Cargando instituciones…' : 'No se encontraron instituciones.' }}</p><p class="mt-1 text-xs text-slate-500">{{ search || statusFilter || planFilter ? 'Prueba ajustando los filtros.' : 'Invita al primer colegio para iniciar el onboarding.' }}</p>@if (!svc.loading() && !search && !statusFilter && !planFilter) { <button type="button" (click)="toggleInvite()" class="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Invitar colegio</button> }</td></tr>
                }
              }
            </tbody>
          </table>
        </div>
      </section>

      @if (svc.totalPages() > 1) {
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span class="text-xs text-slate-500">
            Mostrando {{ rangeStart() }}–{{ rangeEnd() }} de {{ svc.totalElements() }}
          </span>
          <nav class="flex items-center gap-1" aria-label="Paginación">
            <button
              (click)="goToPage(currentPage() - 1)"
              [disabled]="currentPage() === 0"
              class="rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              [class.text-slate-400]="currentPage() !== 0"
              [class.hover:bg-slate-800]="currentPage() !== 0"
              aria-label="Página anterior"
            >
              ← Anterior
            </button>

            @for (p of pages(); track $index) {
              @if (p === '…') {
                <span class="px-2 text-slate-600">…</span>
              } @else {
                <button
                  (click)="goToPage(+p)"
                  class="min-w-[2.25rem] rounded-lg px-3 py-1.5 text-sm transition-colors"
                  [class.bg-indigo-600]="+p === currentPage()"
                  [class.text-white]="+p === currentPage()"
                  [class.text-slate-400]="+p !== currentPage()"
                  [class.hover:bg-slate-800]="+p !== currentPage()"
                  [attr.aria-current]="+p === currentPage() ? 'page' : null"
                >
                  {{ +p + 1 }}
                </button>
              }
            }

            <button
              (click)="goToPage(currentPage() + 1)"
              [disabled]="currentPage() >= svc.totalPages() - 1"
              class="rounded-lg px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              [class.text-slate-400]="currentPage() < svc.totalPages() - 1"
              [class.hover:bg-slate-800]="currentPage() < svc.totalPages() - 1"
              aria-label="Página siguiente"
            >
              Siguiente →
            </button>
          </nav>
        </div>
      }
    </main>
  `,
})
export class AdminTenantsComponent implements OnInit {
  protected readonly svc = inject(AdminTenantsService);

  protected search = '';
  protected statusFilter = '';
  protected planFilter = '';
  protected sort: 'recent' | 'students' | 'billing' | 'name' = 'recent';
  protected pageSize = 10;
  protected readonly currentPage = signal(0);
  protected readonly pages = signal<(number | '…')[]>([]);
  protected readonly showInvite = signal(false);
  protected inviteEmail = '';
  protected readonly inviteBusy = signal(false);
  protected readonly inviteMessage = signal<string | null>(null);
  protected readonly inviteError = signal<string | null>(null);
  protected readonly lastSetupUrl = signal<string | null>(null);
  protected readonly pendingInvites = signal<SchoolInvitationDto[]>([]);
  protected prepSchoolName = '';
  protected prepVariant: PrepPackageVariant = 'PRODUCTION';
  protected readonly prepBusy = signal(false);
  protected readonly prepError = signal<string | null>(null);
  protected readonly copiedTenantUrl = signal<string | null>(null);
  protected readonly copyError = signal<string | null>(null);

  constructor() {
    // Recompute the visible page-window whenever totalPages or the
    // current page changes. Centralised here (instead of mutating from
    // the service callback) so the windowing logic stays in one place
    // and OnPush change detection sees a fresh signal reference.
    effect(() => {
      const total = this.svc.totalPages();
      const current = this.currentPage();
      this.pages.set(this.buildPageWindow(total, current));
    });
  }

  ngOnInit(): void {
    this.load();
    this.svc.loadOverview();
  }

  protected toggleInvite(): void {
    this.showInvite.update((open) => !open);
    if (this.showInvite()) {
      this.refreshInvites();
    }
  }

  protected sendInvite(): void {
    const email = this.inviteEmail.trim();
    if (!email || this.inviteBusy()) return;
    this.inviteBusy.set(true);
    this.inviteError.set(null);
    this.inviteMessage.set(null);
    this.svc.inviteSchool(email).subscribe({
      next: (res) => {
        const data = (res as { data?: SchoolInvitationDto }).data ?? (res as SchoolInvitationDto);
        this.inviteBusy.set(false);
        this.inviteEmail = '';
        this.lastSetupUrl.set(data.setupUrl ?? null);
        this.inviteMessage.set(
          data.emailSent
            ? 'Invitación enviada. El colegio recibirá el enlace por correo.'
            : 'Invitación creada. El correo no se envió (SMTP apagado); copia el enlace.',
        );
        this.refreshInvites();
      },
      error: (err) => {
        this.inviteBusy.set(false);
        this.inviteError.set(err?.error?.message ?? err?.error?.errors?.[0]?.message ?? 'No se pudo invitar.');
      },
    });
  }

  protected resendInvite(publicUuid: string): void {
    this.svc.resendSchoolInvitation(publicUuid).subscribe({
      next: (res) => {
        const data = (res as { data?: SchoolInvitationDto }).data ?? (res as SchoolInvitationDto);
        this.lastSetupUrl.set(data.setupUrl ?? null);
        this.inviteMessage.set(data.emailSent ? 'Invitación reenviada.' : 'Enlace regenerado. Cópialo abajo.');
        this.refreshInvites();
      },
      error: (err) => {
        this.inviteError.set(err?.error?.message ?? 'No se pudo reenviar.');
      },
    });
  }

  protected cancelInvite(publicUuid: string): void {
    this.svc.cancelSchoolInvitation(publicUuid).subscribe({
      next: () => this.refreshInvites(),
      error: (err) => {
        this.inviteError.set(err?.error?.message ?? 'No se pudo cancelar.');
      },
    });
  }

  protected copyLastUrl(): void {
    const url = this.lastSetupUrl();
    if (!url) return;
    void navigator.clipboard.writeText(url);
  }

  protected async copyTenantUrl(tenant: { publicUuid: string; slug: string; customDomain?: string }): Promise<void> {
    this.copyError.set(null);
    try {
      await navigator.clipboard.writeText(tenantPublicUrl(tenant.slug));
      this.copiedTenantUrl.set(tenant.publicUuid);
      window.setTimeout(() => {
        if (this.copiedTenantUrl() === tenant.publicUuid) this.copiedTenantUrl.set(null);
      }, 1800);
    } catch {
      this.copyError.set('El navegador no permitió copiar la URL del tenant.');
    }
  }

  protected downloadPrepPackage(): void {
    if (this.prepBusy()) return;
    this.prepBusy.set(true);
    this.prepError.set(null);
    const name = this.prepSchoolName.trim();
    this.svc.downloadPrepPackage(name, this.prepVariant).subscribe({
      next: (blob) => {
        this.prepBusy.set(false);
        const slug = (name || 'colegio')
          .toLowerCase()
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 60) || 'colegio';
        this.triggerBrowserDownload(blob, `prep-datos-${slug}.zip`);
      },
      error: (err) => {
        this.prepBusy.set(false);
        this.prepError.set(
          err?.error?.message ?? err?.statusText ?? 'No se pudo descargar el pack.',
        );
      },
    });
  }

  private triggerBrowserDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  private refreshInvites(): void {
    this.svc.loadSchoolInvitations().subscribe({
      next: (res) => this.pendingInvites.set(res.content ?? []),
      error: () => this.pendingInvites.set([]),
    });
  }

  protected load(): void {
    this.svc.loadTenants({
      search: this.search || undefined,
      status: this.statusFilter || undefined,
      plan: this.planFilter || undefined,
      sort: this.sort,
      page: this.currentPage(),
      size: this.pageSize,
    });
  }

  protected applyFilters(): void {
    this.currentPage.set(0);
    this.load();
  }

  protected goToPage(page: number): void {
    if (page < 0 || page >= this.svc.totalPages()) return;
    this.currentPage.set(page);
    this.load();
  }

  protected rangeStart(): number {
    return this.svc.totalElements() === 0 ? 0 : this.currentPage() * this.pageSize + 1;
  }

  protected rangeEnd(): number {
    return Math.min((this.currentPage() + 1) * this.pageSize, this.svc.totalElements());
  }

  protected overviewValue(metric: 'activeTenants' | 'activeStudents'): string {
    const value = this.svc.overview()?.[metric];
    return value === undefined ? '—' : value.toLocaleString('es-PE');
  }

  protected overviewMoney(metric: 'mrr' | 'overdue'): string {
    const value = this.svc.overview()?.[metric];
    return value === undefined
      ? '—'
      : new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
  }

  protected collectionRateLabel(): string {
    const rate = this.svc.overview()?.collectionRate;
    return rate === undefined ? 'Recaudación no disponible' : `${Math.round(rate * 100)}%`;
  }

  protected studentCount(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : value.toLocaleString('es-PE');
  }

  protected capacityPercent(students: number | null | undefined, maximum: number): number {
    if (!maximum || students === null || students === undefined) return 0;
    return Math.min(100, Math.max(0, (students / maximum) * 100));
  }

  protected initials(name: string | null | undefined): string {
    return (name ?? '').trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toUpperCase() || 'IE';
  }

  protected billingLabel(value: string): string {
    const dueDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(dueDate.getTime())) return 'Fecha de cobro';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return 'Fecha vencida';
    if (days === 0) return 'Vence hoy';
    if (days === 1) return 'Vence mañana';
    return `En ${days} días`;
  }

  protected statusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'rounded-full bg-emerald-900/50 px-2 py-0.5 text-xs text-emerald-300',
      SUSPENDED: 'rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-300',
      PENDING: 'rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300',
      TRIAL: 'rounded-full bg-indigo-900/50 px-2 py-0.5 text-xs text-indigo-300',
    };
    return map[status] ?? 'rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300';
  }

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'Activo',
      SUSPENDED: 'Suspendido',
      PENDING: 'Pendiente',
      TRIAL: 'Trial',
    };
    return map[status] ?? status;
  }

  /**
   * Builds a compact pagination window. Always shows the first, last and
   * current ±2 pages; the rest are collapsed into a single `'…'` slot so
   * the bar never wraps awkwardly when n is large.
   */
  private buildPageWindow(total: number, current: number): (number | '…')[] {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i);
    }
    const window = new Set<number>([0, total - 1, current, current - 1, current + 1]);
    const sorted = [...window].filter(p => p >= 0 && p < total).sort((a, b) => a - b);
    const result: (number | '…')[] = [];
    let prev = -1;
    for (const p of sorted) {
      if (prev !== -1 && p - prev > 1) result.push('…');
      result.push(p);
      prev = p;
    }
    return result;
  }

  protected readonly ROUTES = ROUTES;
}

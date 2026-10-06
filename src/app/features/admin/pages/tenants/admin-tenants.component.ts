import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ROUTES } from '@core/constants';
import { AdminTenantsService, PrepPackageVariant, SchoolInvitationDto } from '../../services';

@Component({
  selector: 'app-admin-tenants',
  standalone: true,
  imports: [RouterLink, FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-white">Instituciones</h1>
          <p class="mt-1 text-sm text-slate-400">Gestiona los tenants de la plataforma.</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="toggleInvite()"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Invitar colegio
          </button>
          <span class="text-xs text-slate-500">
            {{ svc.totalElements() }} registros
            @if (svc.totalPages() > 1) {
              <span class="ml-2 text-slate-600">
                · página {{ currentPage() + 1 }} de {{ svc.totalPages() }}
              </span>
            }
          </span>
        </div>
      </div>

      @if (showInvite()) {
        <section class="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 class="text-sm font-semibold text-white">Nueva institución por invitación</h2>
          <p class="mt-1 text-xs text-slate-400">
            Enviamos un correo con el enlace para que el colegio configure nombre, slug y
            contraseña de administrador.
          </p>
          <div class="mt-3 flex flex-wrap items-end gap-3">
            <label class="min-w-[16rem] flex-1 text-xs text-slate-400">
              Correo del administrador
              <input
                type="email"
                [(ngModel)]="inviteEmail"
                placeholder="directora@colegio.edu.pe"
                class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <button
              type="button"
              (click)="sendInvite()"
              [disabled]="inviteBusy() || !inviteEmail.trim()"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {{ inviteBusy() ? 'Enviando…' : 'Enviar invitación' }}
            </button>
          </div>

          <div class="mt-4 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pack de preparación de datos
            </h3>
            <p class="mt-1 text-xs text-slate-400">
              Descarga la guía PDF y plantillas Excel personalizadas con el nombre del colegio
              (antes o después de invitar).
            </p>
            <div class="mt-3 flex flex-wrap items-end gap-3">
              <label class="min-w-[14rem] flex-1 text-xs text-slate-400">
                Nombre del colegio
                <input
                  type="text"
                  [(ngModel)]="prepSchoolName"
                  placeholder="Colegio San Marcos"
                  class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label class="text-xs text-slate-400">
                Variante
                <select
                  [(ngModel)]="prepVariant"
                  class="mt-1 block rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="PILOT">Piloto</option>
                  <option value="PRODUCTION">Producción</option>
                </select>
              </label>
              <button
                type="button"
                (click)="downloadPrepPackage()"
                [disabled]="prepBusy()"
                class="rounded-lg border border-indigo-500/60 bg-indigo-950/40 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-900/50 disabled:opacity-50"
              >
                {{ prepBusy() ? 'Generando…' : 'Descargar pack ZIP' }}
              </button>
            </div>
            <p class="mt-2 text-xs text-slate-500">
              Piloto: lo mínimo para probar. Producción: padrón completo e incluye conceptos de pago.
            </p>
            @if (prepError(); as err) {
              <p class="mt-2 text-sm text-red-300">{{ err }}</p>
            }
          </div>

          @if (inviteMessage(); as msg) {
            <p class="mt-3 text-sm text-emerald-300">{{ msg }}</p>
          }
          @if (lastSetupUrl(); as url) {
            <p class="mt-2 break-all font-mono text-xs text-indigo-300">{{ url }}</p>
            <button type="button" (click)="copyLastUrl()" class="mt-1 text-xs text-indigo-400 hover:text-indigo-300">
              Copiar enlace
            </button>
          }
          @if (inviteError(); as err) {
            <p class="mt-3 text-sm text-red-300">{{ err }}</p>
          }

          @if (pendingInvites().length > 0) {
            <h3 class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Pendientes</h3>
            <ul class="mt-2 space-y-2">
              @for (inv of pendingInvites(); track inv.publicUuid) {
                <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm">
                  <span class="text-slate-200">{{ inv.email }}</span>
                  <span class="text-xs text-slate-500">vence {{ inv.expiresAt | date: 'short' }}</span>
                  <div class="flex gap-3">
                    <button type="button" class="text-xs text-indigo-400 hover:text-indigo-300" (click)="resendInvite(inv.publicUuid)">
                      Reenviar
                    </button>
                    <button type="button" class="text-xs text-red-400 hover:text-red-300" (click)="cancelInvite(inv.publicUuid)">
                      Cancelar
                    </button>
                  </div>
                </li>
              }
            </ul>
          }
        </section>
      }

      <div class="mt-4 flex flex-wrap gap-3">
        <input
          type="text"
          [(ngModel)]="search"
          (keyup.enter)="applyFilters()"
          placeholder="Buscar por nombre..."
          class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <select
          [(ngModel)]="statusFilter"
          (change)="applyFilters()"
          class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVE">Activo</option>
          <option value="SUSPENDED">Suspendido</option>
          <option value="PENDING">Pendiente</option>
        </select>
        <button
          (click)="applyFilters()"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Filtrar
        </button>
        <select
          [(ngModel)]="pageSize"
          (change)="applyFilters()"
          class="ml-auto rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
          title="Resultados por página"
        >
          <option [ngValue]="10">10 / pág.</option>
          <option [ngValue]="20">20 / pág.</option>
          <option [ngValue]="50">50 / pág.</option>
        </select>
      </div>

      @if (svc.error(); as err) {
        <div class="mt-4 rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{{ err }}</div>
      }

      <div class="mt-4 overflow-x-auto rounded-xl border border-slate-800">
        <table class="w-full text-sm">
          <thead class="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th class="px-4 py-3">Nombre</th>
              <th class="px-4 py-3">Slug</th>
              <th class="px-4 py-3">Plan</th>
              <th class="px-4 py-3 text-right">Estudiantes</th>
              <th class="px-4 py-3">Estado</th>
              <th class="px-4 py-3">Próximo cobro</th>
              <th class="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800">
            @for (t of svc.tenants(); track t.publicUuid) {
              <tr class="hover:bg-slate-800/50">
                <td class="px-4 py-3 font-medium text-white">{{ t.name }}</td>
                <td class="px-4 py-3 text-slate-400">{{ t.slug }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full bg-indigo-900/50 px-2 py-0.5 text-xs text-indigo-300">
                    {{ t.planName ?? t.plan ?? '—' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right text-slate-300">
                  {{ t.activeStudents !== null && t.activeStudents !== undefined ? t.activeStudents.toLocaleString('es-PE') : '—' }}
                </td>
                <td class="px-4 py-3">
                  <span [class]="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
                </td>
                <td class="px-4 py-3 text-slate-400">
                  {{ t.nextBillingDate ? (t.nextBillingDate | date: 'mediumDate') : '—' }}
                </td>
                <td class="px-4 py-3">
                  <a
                    [routerLink]="['/admin/tenants', t.publicUuid]"
                    class="text-indigo-400 hover:text-indigo-300"
                  >
                    Ver detalle
                  </a>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-500">
                  {{ svc.loading() ? 'Cargando…' : 'No se encontraron instituciones.' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

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
    </div>
  `,
})
export class AdminTenantsComponent implements OnInit {
  protected readonly svc = inject(AdminTenantsService);

  protected search = '';
  protected statusFilter = '';
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

  private load(): void {
    this.svc.loadTenants({
      search: this.search || undefined,
      status: this.statusFilter || undefined,
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

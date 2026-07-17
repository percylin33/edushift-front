import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ROUTES } from '@core/constants';
import { AdminTenantsService } from '../../services';

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
        <span class="text-xs text-slate-500">
          {{ svc.totalElements() }} registros
          @if (svc.totalPages() > 1) {
            <span class="ml-2 text-slate-600">
              · página {{ currentPage() + 1 }} de {{ svc.totalPages() }}
            </span>
          }
        </span>
      </div>

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

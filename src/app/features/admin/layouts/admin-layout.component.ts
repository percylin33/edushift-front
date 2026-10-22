import '../charts/chart-registration';

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { environment } from '../../../../environments/environment';
import { AdminAuthApiService } from '../services/admin-auth-api.service';

interface AdminNavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  exactMatch: boolean;
}

interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen bg-slate-950 text-white">
      @if (mobileNavOpen()) {
        <button
          type="button"
          aria-label="Cerrar menú"
          class="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          (click)="closeMobileNav()"
        ></button>
      }

      <aside
        class="fixed inset-y-0 left-0 z-50 flex w-[17rem] flex-col border-r border-slate-800 bg-slate-900 transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0"
        [class.-translate-x-full]="!mobileNavOpen()"
      >
        <div class="flex h-[4.25rem] shrink-0 items-center gap-2 border-b border-slate-800 px-4">
          <img src="/branding/logos/fondo-oscuro.png" alt="EduShift" class="h-8 w-auto" />
          <span class="rounded-md border border-indigo-400/20 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
            Admin
          </span>
        </div>

        <div class="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-xs">
          <span class="h-2 w-2 rounded-full" [class.bg-emerald-400]="environmentName() === 'Producción'" [class.bg-amber-400]="environmentName() !== 'Producción'"></span>
          <span class="text-slate-400">Entorno:</span>
          <span class="font-medium text-slate-200">{{ environmentName() }}</span>
        </div>

        <nav aria-label="Navegación de administración" class="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          @for (group of navGroups; track group.label) {
            <section>
              <h2 class="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{{ group.label }}</h2>
              <div class="space-y-1">
                @for (item of group.items; track item.id) {
                  <a
                    #activeRoute="routerLinkActive"
                    [routerLink]="item.route"
                    routerLinkActive="border-indigo-400/30 bg-indigo-500/15 text-indigo-200"
                    [routerLinkActiveOptions]="{ exact: item.exactMatch }"
                    [attr.aria-current]="activeRoute.isActive ? 'page' : null"
                    (click)="closeMobileNav()"
                    class="group flex min-h-10 items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    <span aria-hidden="true" class="grid h-5 w-5 shrink-0 place-items-center text-sm text-slate-400 group-hover:text-indigo-300">{{ item.icon }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
                  </a>
                }
              </div>
            </section>
          }
        </nav>

        <div class="shrink-0 border-t border-slate-800 p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-indigo-300/20 bg-indigo-600 text-xs font-bold shadow-lg shadow-indigo-950/40">
              {{ initials() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-white">{{ userName() }}</p>
              <p class="truncate text-xs text-slate-400">{{ userEmail() }}</p>
            </div>
            <button
              type="button"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              (click)="logout()"
              class="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <svg aria-hidden="true" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2M3 12h12m0 0-4-4m4 4-4 4" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div class="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 lg:hidden">
          <button
            type="button"
            aria-label="Abrir menú"
            [attr.aria-expanded]="mobileNavOpen()"
            (click)="toggleMobileNav()"
            class="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-200"
          >
            <svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span class="text-sm font-semibold">EduShift <span class="text-indigo-300">Admin</span></span>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class AdminLayoutComponent {
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AdminAuthApiService);
  readonly mobileNavOpen = signal(false);
  readonly environmentName = computed(() =>
    environment.production ? 'Producción' : environment.uatMode ? 'UAT' : 'Desarrollo',
  );

  readonly userName = computed(() => {
    const user = this.auth.user();
    const fullName = user?.fullName;
    if (fullName && fullName.trim()) return fullName;
    return user?.email ?? 'Super Admin';
  });

  readonly userEmail = computed(() => this.auth.user()?.email ?? '');
  readonly initials = computed(() => {
    const name = this.userName();
    return name.split(' ').map((part) => part.charAt(0)).join('').toUpperCase().slice(0, 2);
  });

  protected readonly navGroups: AdminNavGroup[] = [
    {
      label: 'Supervisión global',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '▦', route: ROUTES.ADMIN.DASHBOARD, exactMatch: true },
        { id: 'tenants', label: 'Instituciones', icon: '▤', route: ROUTES.ADMIN.TENANTS, exactMatch: false },
        { id: 'plans', label: 'Planes y licencias', icon: '▣', route: ROUTES.ADMIN.PLANS, exactMatch: false },
        { id: 'ai-global-sources', label: 'Fuentes RAG EduShift', icon: '⌕', route: ROUTES.ADMIN.AI_GLOBAL_SOURCES, exactMatch: false },
      ],
    },
    {
      label: 'Facturación y cobranza',
      items: [
        { id: 'invoices', label: 'Facturas', icon: '▧', route: ROUTES.ADMIN.INVOICES, exactMatch: false },
        { id: 'payments', label: 'Pagos y conciliación', icon: '⇄', route: ROUTES.ADMIN.PAYMENTS, exactMatch: false },
      ],
    },
    {
      label: 'Control y sistema',
      items: [
        { id: 'metrics', label: 'Métricas y telemetría', icon: '⌁', route: ROUTES.ADMIN.METRICS, exactMatch: false },
        { id: 'audit', label: 'Auditoría de acciones', icon: '⌕', route: ROUTES.ADMIN.AUDIT, exactMatch: false },
        { id: 'super-admins', label: 'Cuentas de plataforma', icon: '♙', route: ROUTES.ADMIN.SUPER_ADMINS, exactMatch: false },
        { id: 'claims', label: 'Reclamos y tickets', icon: '△', route: '/admin/claims', exactMatch: false },
        { id: 'support', label: 'Soporte e impersonación', icon: '♧', route: ROUTES.ADMIN.SUPPORT, exactMatch: false },
      ],
    },
  ];

  toggleMobileNav(): void {
    this.mobileNavOpen.update((open) => !open);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  logout(): void {
    this.authApi.logout().subscribe({
      complete: () => this.leave(),
      error: () => this.leave(),
    });
  }

  private leave(): void {
    this.auth.clearSession();
    window.location.href = ROUTES.ADMIN.LOGIN;
  }
}

import '../charts/chart-registration';

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen bg-slate-950 text-white">
      <aside class="flex w-64 flex-col border-r border-slate-800 bg-slate-900">
        <div class="flex h-16 items-center gap-2 border-b border-slate-800 px-6">
          <span class="text-lg font-bold tracking-tight">EduShift</span>
          <span class="rounded bg-indigo-600 px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider">
            Admin
          </span>
        </div>

        <nav class="flex-1 space-y-1 overflow-y-auto p-4">
          @for (item of navItems; track item.id) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-indigo-600/20 text-indigo-300"
              [routerLinkActiveOptions]="{ exact: item.exactMatch }"
              class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <span class="text-base">{{ item.icon }}</span>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="border-t border-slate-800 p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold">
              {{ initials() }}
            </div>
            <div class="flex-1 truncate">
              <p class="truncate text-sm font-medium">{{ userName() }}</p>
              <p class="truncate text-xs text-slate-400">{{ userEmail() }}</p>
            </div>
          </div>
          <button
            (click)="logout()"
            class="mt-3 w-full rounded-lg px-3 py-2 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main class="flex flex-1 flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class AdminLayoutComponent {
  private readonly auth = inject(AuthService);

  readonly userName = computed(() => {
    const user = this.auth.user();
    const fullName = user?.fullName;
    if (fullName && fullName.trim()) return fullName;
    return user?.email ?? 'Super Admin';
  });

  readonly userEmail = computed(() => this.auth.user()?.email ?? '');
  readonly initials = computed(() => {
    const name = this.userName();
    const parts = name.split(' ');
    return parts
      .map((p) => p.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  });

  protected readonly navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', route: ROUTES.ADMIN.DASHBOARD, exactMatch: true },
    { id: 'tenants', label: 'Instituciones', icon: '🏢', route: ROUTES.ADMIN.TENANTS, exactMatch: false },
    { id: 'plans', label: 'Planes', icon: '📋', route: ROUTES.ADMIN.PLANS, exactMatch: false },
    { id: 'invoices', label: 'Facturas', icon: '🧾', route: ROUTES.ADMIN.INVOICES, exactMatch: false },
    { id: 'payments', label: 'Pagos', icon: '💳', route: ROUTES.ADMIN.PAYMENTS, exactMatch: false },
    { id: 'metrics', label: 'Métricas', icon: '📈', route: ROUTES.ADMIN.METRICS, exactMatch: false },
    { id: 'audit', label: 'Auditoría', icon: '🔍', route: ROUTES.ADMIN.AUDIT, exactMatch: false },
  ];

  logout(): void {
    this.auth.clearSession();
    window.location.href = ROUTES.ADMIN.LOGIN;
  }
}

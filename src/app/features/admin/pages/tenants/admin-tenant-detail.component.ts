import { ChangeDetectionStrategy, Component, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ROUTES } from '@core/constants';
import { ConfirmDialogService } from '@shared/components';
import { AdminTenantsService, PrepPackageVariant } from '../../services';

@Component({
  selector: 'app-admin-tenant-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, JsonPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <a
        [routerLink]="ROUTES.ADMIN.TENANTS"
        class="mb-4 inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
      >
        ← Volver a instituciones
      </a>

      @if (svc.loading()) {
        <p class="text-slate-400">Cargando detalle…</p>
      } @else if (svc.error()) {
        <div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">{{ svc.error() }}</div>
      } @else {
        @let t = svc.selectedTenant();
        @if (t) {
          <div class="grid gap-6 lg:grid-cols-3">
            <!-- ─────────── LEFT: Identity + counters ─────────── -->
            <div class="lg:col-span-2 space-y-6">
              <div class="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h1 class="text-2xl font-bold text-white">{{ t.name }}</h1>
                    <p class="mt-1 text-sm text-slate-400">{{ t.slug }}</p>
                    @if (t.customDomain) {
                      <p class="mt-1 text-xs text-slate-500">{{ t.customDomain }}</p>
                    }
                  </div>
                  <span [class]="statusClass(t.status)">{{ statusLabel(t.status) }}</span>
                </div>

                <div class="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <span class="text-slate-400">Plan</span>
                    <p class="mt-0.5 font-medium text-white">
                      {{ t.planName ?? t.plan ?? '—' }}
                    </p>
                  </div>
                  <div>
                    <span class="text-slate-400">Trial hasta</span>
                    <p class="mt-0.5 font-medium text-white">
                      {{ t.trialEndsAt ? (t.trialEndsAt | date: 'medium') : '—' }}
                    </p>
                  </div>
                  <div>
                    <span class="text-slate-400">Tenant ID</span>
                    <p class="mt-0.5 font-mono text-xs text-slate-300">{{ t.publicUuid }}</p>
                  </div>
                  <div>
                    <span class="text-slate-400">Estudiantes activos</span>
                    <p class="mt-0.5 font-medium text-white">
                      {{ fmt(t.activeStudents) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-slate-400">Usuarios totales</span>
                    <p class="mt-0.5 font-medium text-white">
                      {{ fmt(t.totalUsers) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-slate-400">Profesores</span>
                    <p class="mt-0.5 font-medium text-white">
                      {{ fmt(t.totalTeachers) }}
                    </p>
                  </div>
                  <div>
                    <span class="text-slate-400">Máx. estudiantes</span>
                    <p class="mt-0.5 font-medium text-white">{{ fmt(t.maxStudents) }}</p>
                  </div>
                  <div>
                    <span class="text-slate-400">Máx. profesores</span>
                    <p class="mt-0.5 font-medium text-white">{{ fmt(t.maxTeachers) }}</p>
                  </div>
                  <div>
                    <span class="text-slate-400">Storage</span>
                    <p class="mt-0.5 font-medium text-white">
                      {{ t.maxStorageMb !== null && t.maxStorageMb !== undefined ? t.maxStorageMb + ' MB' : '—' }}
                    </p>
                  </div>
                  <div>
                    <span class="text-slate-400">Creado</span>
                    <p class="mt-0.5 font-medium text-white">
                      {{ t.createdAt ? (t.createdAt | date: 'medium') : '—' }}
                    </p>
                  </div>
                  <div>
                    <span class="text-slate-400">Actualizado</span>
                    <p class="mt-0.5 font-medium text-white">
                      {{ t.updatedAt ? (t.updatedAt | date: 'medium') : '—' }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- Branding + feature flags raw view -->
              @if (hasRawMaps()) {
                <div class="rounded-xl border border-slate-800 bg-slate-900 p-6">
                  <h2 class="text-sm font-medium text-white">Configuración</h2>
                  <div class="mt-4 grid gap-4 sm:grid-cols-2">
                    @if (t.branding && objectKeys(t.branding).length > 0) {
                      <div>
                        <span class="text-xs uppercase tracking-wider text-slate-500">Branding</span>
                        <pre
                          class="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300"
                        >{{ t.branding | json }}</pre>
                      </div>
                    }
                    @if (t.featureFlags && objectKeys(t.featureFlags).length > 0) {
                      <div>
                        <span class="text-xs uppercase tracking-wider text-slate-500">
                          Feature flags
                        </span>
                        <pre
                          class="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300"
                        >{{ t.featureFlags | json }}</pre>
                      </div>
                    }
                    @if (t.settings && objectKeys(t.settings).length > 0) {
                      <div class="sm:col-span-2">
                        <span class="text-xs uppercase tracking-wider text-slate-500">Settings</span>
                        <pre
                          class="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300"
                        >{{ t.settings | json }}</pre>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- ─────────── RIGHT: Subscription + actions ─────────── -->
            <div class="space-y-6">
              <div class="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <h2 class="text-sm font-medium text-white">Suscripción B2B</h2>
                @if (t.subscription; as sub) {
                  <div class="mt-4 space-y-3 text-sm">
                    <div>
                      <span class="text-slate-400">Plan</span>
                      <p class="font-medium text-white">{{ sub.planName ?? '—' }}</p>
                    </div>
                    <div>
                      <span class="text-slate-400">Estado</span>
                      <p class="font-medium" [class]="subStatusClass(sub.status)">
                        {{ sub.status }}
                      </p>
                    </div>
                    @if (sub.currentPeriodStart) {
                      <div>
                        <span class="text-slate-400">Inicio período</span>
                        <p class="text-white">{{ sub.currentPeriodStart | date: 'mediumDate' }}</p>
                      </div>
                    }
                    @if (sub.currentPeriodEnd) {
                      <div>
                        <span class="text-slate-400">Fin período</span>
                        <p class="text-white">{{ sub.currentPeriodEnd | date: 'mediumDate' }}</p>
                      </div>
                    }
                    @if (sub.nextBillingAt) {
                      <div>
                        <span class="text-slate-400">Próximo cobro</span>
                        <p class="font-medium text-white">
                          {{ sub.nextBillingAt | date: 'mediumDate' }}
                        </p>
                      </div>
                    }
                    @if (sub.cancelAtPeriodEnd) {
                      <div class="rounded-lg border border-amber-800 bg-amber-950/50 p-3 text-xs text-amber-300">
                        ⚠️ Cancelará al final del período
                        @if (sub.cancellationReason) {
                          <p class="mt-1 text-amber-400">Motivo: {{ sub.cancellationReason }}</p>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <p class="mt-4 text-sm text-slate-500">Sin suscripción activa</p>
                }
              </div>

              <div class="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <h2 class="text-sm font-medium text-white">Acciones</h2>
                <div class="mt-4 flex flex-col gap-2">
                  @if (t.status === 'SUSPENDED') {
                    <button
                      (click)="reactivate(t.publicUuid)"
                      class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                    >
                      Reactivar institución
                    </button>
                  } @else {
                    <button
                      (click)="suspend(t.publicUuid)"
                      class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
                    >
                      Suspender institución
                    </button>
                  }

                  <div class="mt-2 border-t border-slate-800 pt-3">
                    <p class="text-xs text-slate-400">Pack de preparación de datos</p>
                    <label class="mt-2 block text-xs text-slate-500">
                      Variante
                      <select
                        [(ngModel)]="prepVariant"
                        class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="PILOT">Piloto</option>
                        <option value="PRODUCTION">Producción</option>
                      </select>
                    </label>
                    <p class="mt-2 text-xs text-slate-500">
                      Piloto: lo mínimo para probar. Producción: padrón completo e incluye conceptos de pago.
                    </p>
                    <button
                      type="button"
                      (click)="downloadPrepPackage(t.name)"
                      [disabled]="prepBusy()"
                      class="mt-2 w-full rounded-lg border border-indigo-500/60 bg-indigo-950/40 px-4 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-900/50 disabled:opacity-50"
                    >
                      {{ prepBusy() ? 'Generando…' : 'Descargar pack ZIP' }}
                    </button>
                    @if (prepError(); as err) {
                      <p class="mt-2 text-xs text-red-300">{{ err }}</p>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class AdminTenantDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly svc = inject(AdminTenantsService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  protected readonly ROUTES = ROUTES;

  /** Stable reference for `Object.keys` inside the template. */
  protected readonly objectKeys = Object.keys;

  /** Convenience signal — true when ANY of the raw maps has content. */
  private readonly hasRawMapsSig = signal(false);
  protected readonly hasRawMaps = this.hasRawMapsSig.asReadonly();

  protected prepVariant: PrepPackageVariant = 'PRODUCTION';
  protected readonly prepBusy = signal(false);
  protected readonly prepError = signal<string | null>(null);

  constructor() {
    // Recompute "has raw maps" whenever the selected tenant changes so
    // the JSON blocks render conditionally without polling.
    effect(() => {
      const t = this.svc.selectedTenant();
      const hasAny = !!(
        t && (
          (t.branding && Object.keys(t.branding).length > 0) ||
          (t.featureFlags && Object.keys(t.featureFlags).length > 0) ||
          (t.settings && Object.keys(t.settings).length > 0)
        )
      );
      this.hasRawMapsSig.set(hasAny);
    });
  }

  ngOnInit(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) this.svc.loadTenantDetail(uuid);
  }

  protected fmt(n: number | undefined | null): string {
    return typeof n === 'number' ? n.toLocaleString('es-PE') : '—';
  }

  protected statusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'rounded-full bg-emerald-900/50 px-3 py-1 text-xs text-emerald-300',
      SUSPENDED: 'rounded-full bg-red-900/50 px-3 py-1 text-xs text-red-300',
      PENDING: 'rounded-full bg-yellow-900/50 px-3 py-1 text-xs text-yellow-300',
      TRIAL: 'rounded-full bg-indigo-900/50 px-3 py-1 text-xs text-indigo-300',
    };
    return map[status] ?? 'rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300';
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

  protected subStatusClass(status: string): string {
    const map: Record<string, string> = {
      ACTIVE: 'text-emerald-400',
      TRIAL: 'text-indigo-400',
      PAST_DUE: 'text-amber-400',
      CANCELED: 'text-red-400',
      EXPIRED: 'text-red-400',
    };
    return map[status] ?? 'text-white';
  }

  protected async suspend(uuid: string): Promise<void> {
    const ok = await this.confirmDialog.open({
      title: 'Suspender institución',
      message: '¿Suspender esta institución?',
      confirmLabel: 'Suspender',
      variant: 'danger',
      icon: 'trash',
    });
    if (!ok) return;
    this.svc.suspendTenant(uuid);
  }

  protected reactivate(uuid: string): void {
    this.svc.reactivateTenant(uuid);
  }

  protected downloadPrepPackage(schoolName: string): void {
    if (this.prepBusy()) return;
    this.prepBusy.set(true);
    this.prepError.set(null);
    this.svc.downloadPrepPackage(schoolName, this.prepVariant).subscribe({
      next: (blob) => {
        this.prepBusy.set(false);
        const slug = (schoolName || 'colegio')
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
}

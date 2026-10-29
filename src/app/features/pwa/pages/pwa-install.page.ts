import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon';
import { PwaInstallService } from '@core/services/pwa-install.service';

@Component({
  selector: 'app-install-page',
  standalone: true,
  imports: [IconComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section class="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300">
          <app-icon name="download" [size]="30" />
        </div>
        <p class="mt-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300">EduShift para tu celular</p>
        <h1 class="mt-2 text-center text-2xl font-bold">Instala EduShift</h1>
        <p class="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-slate-300">
          Accede más rápido desde tu pantalla de inicio y recibe las notificaciones de tu institución.
        </p>

        @if (installer.showInstallButton()) {
          <button
            type="button"
            class="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            (click)="install()"
          >
            <app-icon name="download" [size]="18" />
            Instalar ahora
          </button>
        } @else {
          <div class="mt-7 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-center text-sm text-emerald-200" role="status">
            EduShift ya está instalado en este dispositivo.
          </div>
        }

        @if (installer.instructions(); as instructions) {
          <div class="mt-4 rounded-xl border border-white/10 bg-slate-950/70 p-4 text-sm leading-6 text-slate-200" role="status" aria-live="polite">
            <p>{{ instructions }}</p>
            @if (installer.isAndroid()) {
              <button
                type="button"
                class="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                (click)="openInChrome()"
              >
                Abrir esta página en Chrome
              </button>
            }
          </div>
        }

        <a
          class="mt-6 flex min-h-11 w-full items-center justify-center rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          routerLink="/auth/login"
          [queryParams]="tenantQueryParams"
        >
          Continuar a EduShift
        </a>

        <p class="mt-5 text-center text-xs leading-5 text-slate-400">
          Tu navegador mostrará una confirmación antes de instalar la aplicación.
        </p>
      </section>
    </main>
  `,
})
export class InstallPageComponent {
  protected readonly installer = inject(PwaInstallService);
  private readonly route = inject(ActivatedRoute);
  protected readonly tenantQueryParams = this.readTenantQuery();

  protected async install(): Promise<void> {
    await this.installer.promptInstall();
  }

  protected openInChrome(): void {
    this.installer.openInChrome();
  }

  private readTenantQuery(): Record<string, string> {
    const tenant = this.route.snapshot.queryParamMap.get('tenant');
    return tenant ? { tenant } : {};
  }
}

import { ChangeDetectionStrategy, Component, input, inject, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon';
import { PwaInstallService } from '@core/services/pwa-install.service';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-pwa-install-button',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (installer.showInstallButton()) {
      <div class="relative">
        <button
          type="button"
          class="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-primary-500/25 bg-primary-500/10 px-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 dark:text-primary-200"
          [class.w-9]="compact()"
          [class.px-0]="compact()"
          [attr.aria-label]="compact() ? 'Instalar EduShift' : null"
          [attr.aria-expanded]="installer.instructions() !== null"
          (click)="handleInstallClick()"
        >
          <app-icon name="download" [size]="17" />
          @if (!compact()) {
            <span>Instalar app</span>
          }
        </button>

        @if (installer.instructions(); as instructions) {
          <section
            class="absolute right-0 top-full z-[60] mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface-raised p-4 text-left shadow-soft-lg"
            aria-live="polite"
            role="status"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-700 dark:text-primary-200"
              >
                <app-icon name="phone" [size]="18" />
              </span>
              <div class="min-w-0 flex-1">
                <h2 class="text-sm font-semibold text-content">Instala EduShift</h2>
                <p class="mt-1 text-xs leading-5 text-content-muted">{{ instructions }}</p>
                @if (installer.showQrCode()) {
                  <div class="mt-4 rounded-lg border border-border bg-white p-3 text-center">
                    @if (qrDataUrl(); as qrUrl) {
                      <img
                        class="mx-auto h-40 w-40"
                        [src]="qrUrl"
                        alt="Código QR para abrir EduShift en el celular"
                      />
                    } @else {
                      <p class="py-16 text-xs text-content-muted">Preparando código QR…</p>
                    }
                    <p class="mt-2 text-xs text-slate-600">Escanéalo con la cámara del celular</p>
                  </div>
                }
                <button
                  type="button"
                  class="mt-3 text-xs font-semibold text-primary-700 hover:underline dark:text-primary-200"
                  (click)="installer.dismissInstructions()"
                >
                  Entendido
                </button>
              </div>
            </div>
          </section>
        }
      </div>
    }
  `,
})
export class PwaInstallButtonComponent {
  readonly compact = input(false);
  protected readonly installer = inject(PwaInstallService);
  protected readonly qrDataUrl = signal<string | null>(null);

  protected async handleInstallClick(): Promise<void> {
    await this.installer.promptInstall();
    if (this.installer.showQrCode()) {
      try {
        const installUrl = new URL('/install', window.location.origin);
        const tenantSlug = new URLSearchParams(window.location.search).get('tenant');
        if (tenantSlug) installUrl.searchParams.set('tenant', tenantSlug);
        this.qrDataUrl.set(await QRCode.toDataURL(installUrl.toString(), {
          width: 240,
          margin: 2,
          errorCorrectionLevel: 'M',
        }));
      } catch {
        this.qrDataUrl.set(null);
      }
    }
  }
}

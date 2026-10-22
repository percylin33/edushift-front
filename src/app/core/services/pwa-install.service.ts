import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly platformId = inject(PLATFORM_ID);
  private deferredPrompt: InstallPromptEvent | null = null;

  readonly showInstallButton = signal(false);
  readonly instructions = signal<string | null>(null);
  readonly showQrCode = signal(false);
  readonly isAndroid = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.showInstallButton.set(!this.isRunningStandalone());
    this.showQrCode.set(!this.isMobileDevice());
    this.isAndroid.set(/Android/i.test(navigator.userAgent));
    window.addEventListener('beforeinstallprompt', this.captureInstallPrompt);
    window.addEventListener('appinstalled', this.onInstalled);
  }

  async promptInstall(): Promise<void> {
    this.instructions.set(null);
    const installPrompt = this.deferredPrompt;
    if (!installPrompt) {
      this.instructions.set(this.manualInstructions());
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      this.deferredPrompt = null;
      if (choice.outcome === 'accepted') {
        this.showInstallButton.set(false);
        return;
      }
      this.instructions.set('Puedes instalar EduShift más tarde desde este botón.');
    } catch {
      this.instructions.set(this.manualInstructions());
    }
  }

  dismissInstructions(): void {
    this.instructions.set(null);
  }

  openInChrome(): void {
    if (!isPlatformBrowser(this.platformId) || !this.isAndroid()) return;

    const installUrl = new URL('/install', window.location.origin);
    const tenant = new URLSearchParams(window.location.search).get('tenant');
    if (tenant) installUrl.searchParams.set('tenant', tenant);

    // Android Chrome accepts an intent URL that moves this page out of an
    // embedded QR/browser WebView and into Chrome, where PWA install is supported.
    const chromeIntent = `intent://${installUrl.host}${installUrl.pathname}${installUrl.search}` +
      '#Intent;scheme=https;package=com.android.chrome;end';
    window.location.assign(chromeIntent);
  }

  private readonly captureInstallPrompt = (event: Event): void => {
    event.preventDefault();
    this.deferredPrompt = event as InstallPromptEvent;
    this.showInstallButton.set(true);
  };

  private readonly onInstalled = (): void => {
    this.deferredPrompt = null;
    this.instructions.set(null);
    this.showInstallButton.set(false);
  };

  private isRunningStandalone(): boolean {
    const safariNavigator = navigator as Navigator & { standalone?: boolean };
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      safariNavigator.standalone === true
    );
  }

  private isMobileDevice(): boolean {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  private manualInstructions(): string {
    const userAgent = navigator.userAgent;
    const isAppleMobile =
      /iPhone|iPad|iPod/i.test(userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (isAppleMobile) {
      return 'Abre este enlace en Safari, toca Compartir y luego “Añadir a pantalla de inicio”. Confirma y abre EduShift desde el nuevo icono.';
    }

    if (/Android/i.test(userAgent)) {
      return 'Este navegador no mostró la instalación directa. Abre EduShift en Chrome y usa el menú ⋮ → “Instalar aplicación” o “Añadir a pantalla principal”.';
    }

    return 'Abre el menú del navegador y elige “Instalar app” o “Añadir a pantalla principal”; el navegador te pedirá confirmarlo.';
  }
}

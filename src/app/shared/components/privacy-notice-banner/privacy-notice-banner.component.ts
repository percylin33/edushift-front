import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-privacy-notice-banner',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (showNotice()) {
      <div
        class="fixed top-0 left-0 right-0 z-50 bg-slate-950/95 border-b border-slate-700/50 text-slate-100 animate-in fade-in-up sm:animate-in fade-in-up-lg"
        role="alert"
        aria-live="polite"
      >
      <div class="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div class="flex items-start justify-between gap-4 max-w-xl">
          <div class="flex items-start gap-3">
            <svg
              class="w-5 h-5 text-amber-400 shrink-0 flex-shrink-0 flex-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16H-a10 10 0 1 1 10-9.998M9 10l2 2 4-4m6.2-l.8-3.2a3.5 3.5 0 1 0-5 1.8l3.2.8a3.5 3.5 0 0 0 1.8-5l-.8-3.2z"
              />
            </svg>
            <div>
              <p class="font-medium text-sm text-slate-200">
                Al ingresar a EduShift, te informamos que cumplimos con la <a
                  href="/politica-privacidad"
                  class="text-amber-300 hover:text-amber-200 underline decoration-amber-200"
                  target="_blank"
                >Política de Privacidad</a> en cumplimiento de la Ley N° 29733 de Protección de Datos Personales.
              </p>
              <p class="text-xs text-slate-400 mt-1">
                Tus datos son confidenciales y se utilizan únicamente para fines
                educativos. Puedes retirar tu consentimiento en cualquier momento.
              </p>
            </div>
          </div>
          <button
            (click)="dismissNotice()"
            class="p-1 rounded-lg hover:bg-slate-800 transition-colors data-[state=focused]:outline-none"
            aria-label="Cerrar aviso de privacidad"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
      </div>
    }
  `,
})
export class PrivacyNoticeBannerComponent {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  private readonly shown = signal<boolean>(false);

  readonly showNotice = computed(() => {
    if (this.shown()) return false;

    // Check if we're on a route that should show the notice
    // Show on auth routes and dashboard, but not on privacy policy itself
    const url = this.router.url;
    const excludedRoutes = ['/politica-privacidad', '/terminos-y-condiciones', '/auth/'];

    return !this.shown() && !excludedRoutes.some((route) => url.startsWith(route));
  });

  constructor() {
    // Check localStorage to see if notice was already dismissed
    const stored = localStorage.getItem('privacyNoticeDismissed');
    if (stored === '1') {
      this.shown.set(true);
    }

    // Optionally fetch or validate the privacy policy version
    effect(() => {
      if (this.showNotice()) {
        // Could fetch policy version here if needed
      }
    });
  }

  dismissNotice(): void {
    this.shown.set(true);
    localStorage.setItem('privacyNoticeDismissed', '1');
    // Navigate away or just hide - user chose to dismiss
  }
}

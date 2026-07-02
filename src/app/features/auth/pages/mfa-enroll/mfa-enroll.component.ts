import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import * as QRCode from 'qrcode';

import { ApiError } from '@core/models';
import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { IconComponent, SpinnerComponent } from '@shared/components';

import { AuthApiService } from '../../services/auth-api.service';

/**
 * MFA enrollment screen (Sprint 17 / FE-17.3).
 *
 * <h3>Flow</h3>
 * <ol>
 *   <li>Mount → {@code GET /auth/mfa/enroll/start} → BE returns
 *       {@link MfaEnrollmentStart} with a base32 secret, the
 *       {@code otpauth://} URI, and a placeholder for the QR code
 *       data URL. We render the QR with the {@code qrcode} package
 *       client-side (small, zero-dep, offline-capable).</li>
 *   <li>User scans the QR with Google Authenticator / Authy / 1Password
 *       and types the 6-digit code.</li>
 *   <li>{@code POST /auth/mfa/enroll/verify} with the code + the secret
 *       → BE returns 10 recovery codes (plaintext, shown once).</li>
 *   <li>User saves the codes (copy-to-clipboard button) → confirm →
 *       redirect to the profile page (or wherever they came from).</li>
 * </ol>
 *
 * <h3>Why we render the QR client-side</h3>
 * The BE returns the {@code otpauth://} URI (not a data URL) so the
 * payload size stays small and the BE doesn't need a QR library. The
 * SPA turns it into a data URL on the client. Keeping the QR
 * generation out of the BE also means we can swap the rendering
 * library (e.g. a server-rendered SVG) without a server change.
 */
@Component({
  selector: 'app-mfa-enroll',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">
          Activar verificación en dos pasos
        </h1>
        <p class="text-sm text-content-muted">
          Escanea el código QR con tu aplicación autenticadora (Google Authenticator, Authy,
          1Password…).
        </p>
      </header>

      @if (stage() === 'loading') {
        <div class="flex items-center gap-2 text-sm text-content-muted">
          <app-spinner [size]="14" />
          Generando código QR…
        </div>
      } @else if (stage() === 'scan') {
        <section class="rounded-lg border border-border bg-surface-raised p-6">
          <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div class="flex flex-col items-center gap-3">
              @if (qrDataUrl(); as url) {
                <img
                  [src]="url"
                  alt="QR para configurar el autenticador"
                  class="h-48 w-48 rounded-md border border-border bg-white p-2"
                />
              } @else {
                <div
                  class="flex h-48 w-48 items-center justify-center rounded-md border border-border bg-surface-muted text-xs text-content-subtle"
                >
                  QR no disponible
                </div>
              }
              <p class="text-center text-xs text-content-subtle">
                Escanea con la cámara de tu app autenticadora.
              </p>
            </div>
            <div class="space-y-3">
              <div class="space-y-1.5">
                <label for="code" class="block text-sm font-medium text-content"
                  >Código de 6 dígitos</label
                >
                <input
                  id="code"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  [value]="code()"
                  (input)="onCodeInput($event)"
                  placeholder="123 456"
                  maxlength="6"
                  class="w-full rounded-md border border-border bg-surface px-3 py-2 text-center font-mono text-2xl tracking-[0.3em] text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>
              @if (errorMessage(); as msg) {
                <p role="alert" class="text-sm text-danger">{{ msg }}</p>
              }
              <button
                type="button"
                (click)="onVerify()"
                [disabled]="verifying() || code().length !== 6"
                class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                @if (verifying()) {
                  <app-spinner [size]="14" />
                  Verificando…
                } @else {
                  Activar
                }
              </button>
              <details class="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm">
                <summary class="cursor-pointer text-content">
                  ¿No puedes escanear? Ingresa el código manualmente
                </summary>
                <code
                  class="mt-2 block break-all rounded bg-surface px-2 py-1 font-mono text-xs text-content"
                  >{{ enrollment()?.secretBase32 }}</code
                >
              </details>
            </div>
          </div>
        </section>
      } @else if (stage() === 'codes') {
        <section class="rounded-lg border border-warning/30 bg-warning/10 p-6">
          <h2 class="text-base font-semibold text-content">Guarda tus códigos de recuperación</h2>
          <p class="mt-1 text-sm text-content-muted">
            Estos 10 códigos son la única forma de acceder a tu cuenta si pierdes el dispositivo.
            Guárdalos en un lugar seguro. <strong>No se vuelven a mostrar.</strong>
          </p>
          <ul class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            @for (code of recoveryCodes(); track code) {
              <li
                class="rounded-md border border-border bg-surface px-2 py-1.5 text-center font-mono text-sm tracking-wide text-content"
              >
                {{ code }}
              </li>
            }
          </ul>
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="onCopyCodes()"
              class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
            >
              <app-icon name="upload" [size]="14" />
              {{ copyLabel() }}
            </button>
          </div>
          <button
            type="button"
            (click)="onConfirmCodes()"
            class="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          >
            Ya los guardé, finalizar
          </button>
        </section>
      }
    </div>
  `,
})
export class MfaEnrollComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  protected readonly profileRoute = ROUTES.PROFILE.ROOT;

  // ---------------------------------------------------------------------
  // Stage machine: loading → scan → codes
  // ---------------------------------------------------------------------
  protected readonly stage = signal<'loading' | 'scan' | 'codes'>('loading');
  protected readonly enrollment = signal<{ secretBase32: string } | null>(null);
  protected readonly qrDataUrl = signal<string | null>(null);
  protected readonly code = signal('');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly verifying = signal(false);
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly copyLabel = signal('Copiar códigos');

  // Refresh the cached user when MFA flips on, so the profile page
  // (and the user menu) show the new state without a hard reload.
  private readonly _syncMfaEnabledToAuth = effect(() => {
    const u = this.auth.user();
    if (u && this.stage() === 'codes') {
      this.auth.setUser({ ...u, mfaEnabled: true });
    }
  });

  ngOnInit(): void {
    this.startEnrollment();
  }

  private startEnrollment(): void {
    this.errorMessage.set(null);
    this.authApi.startMfaEnrollment().subscribe({
      next: async (res) => {
        this.enrollment.set({ secretBase32: res.secretBase32 });
        // Render QR client-side from the otpauth:// URI. We use a
        // 256-px PNG so it stays crisp on retina screens.
        try {
          const dataUrl = await QRCode.toDataURL(res.otpauthUri, {
            width: 256,
            margin: 1,
            errorCorrectionLevel: 'M',
          });
          this.qrDataUrl.set(dataUrl);
        } catch {
          // Fallback to whatever the BE sent (also useful when the
          // qrcode library isn't available, e.g. SSR).
          this.qrDataUrl.set(res.qrCodeDataUrl);
        }
        this.stage.set('scan');
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.toMessage(err));
      },
    });
  }

  protected onCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.code.set(input.value.replace(/\D/g, '').slice(0, 6));
    input.value = this.code();
  }

  protected onVerify(): void {
    const code = this.code();
    const enrollment = this.enrollment();
    if (!enrollment || code.length !== 6 || this.verifying()) return;

    this.errorMessage.set(null);
    this.verifying.set(true);

    this.authApi
      .verifyMfaEnrollment({ secret: enrollment.secretBase32, totpCode: code })
      .pipe(finalize(() => this.verifying.set(false)))
      .subscribe({
        next: (codes) => {
          this.recoveryCodes.set(codes);
          this.stage.set('codes');
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(this.toMessage(err));
        },
      });
  }

  protected onCopyCodes(): void {
    const text = this.recoveryCodes().join('\n');
    if (!navigator?.clipboard) {
      this.copyLabel.set('Copia no disponible');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => this.copyLabel.set('Copiado ✓'))
      .catch(() => this.copyLabel.set('Error al copiar'));
  }

  protected onConfirmCodes(): void {
    // Caller decides where to go next. We default to /profile so the
    // user can see the new MFA status reflected in the security card.
    this.router.navigateByUrl(this.profileRoute);
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    if (err.status === 400) {
      const body = err.error as ApiError | null | undefined;
      if (body?.code === 'MFA_ALREADY_ENABLED') {
        return 'MFA ya está activado. Recarga la página.';
      }
      return body?.message ?? 'Código incorrecto. Inténtalo de nuevo.';
    }
    if (err.status === 401) {
      return 'El código no coincide. Verifica la hora de tu dispositivo e inténtalo de nuevo.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }
    return 'No se pudo activar MFA.';
  }
}

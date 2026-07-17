import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';
import * as QRCode from 'qrcode';

import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import {
  AlertComponent,
  FormFieldComponent,
  IconComponent,
  SubmitButtonComponent,
} from '@shared/components';

import { AuthApiService } from '../../services/auth-api.service';

/**
 * MFA enrollment screen (Sprint 17 / FE-17.3).
 *
 * <h3>Flow</h3>
 * <ol>
 *   <li>Mount → {@code GET /auth/mfa/enroll/start} → BE returns
 *       a base32 secret + the {@code otpauth://} URI. We render the QR
 *       with the {@code qrcode} package client-side.</li>
 *   <li>User scans the QR with Google Authenticator / Authy / 1Password
 *       and types the 6-digit code into a {@code FormControl}.</li>
 *   <li>{@code POST /auth/mfa/enroll/verify} with the code + the secret
 *       → BE returns 10 recovery codes (plaintext, shown once).</li>
 *   <li>User saves the codes (copy-to-clipboard button) → confirm →
 *       redirect to the profile page.</li>
 * </ol>
 */
@Component({
  selector: 'app-mfa-enroll',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    FormFieldComponent,
    IconComponent,
    SubmitButtonComponent,
  ],
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
          <app-icon name="refresh" [size]="14" class="animate-spin" />
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
              <app-form-field
                fieldId="code"
                [control]="codeCtrl"
                label="Código de 6 dígitos"
                placeholder="123 456"
                autocomplete="one-time-code"
                inputmode="numeric"
                [maxlength]="6"
                [error]="codeError()"
                extraInputClass="text-center font-mono text-2xl tracking-[0.3em]"
              />

              @if (errorMessage(); as msg) {
                <app-alert variant="error" [message]="msg" />
              }
              <app-submit-button
                [loading]="verifying()"
                [disabled]="form.invalid"
                [showArrow]="false"
                label="Activar"
                loadingLabel="Verificando…"
              />
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
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  protected readonly profileRoute = ROUTES.PROFILE.ROOT;

  protected readonly stage = signal<'loading' | 'scan' | 'codes'>('loading');
  protected readonly enrollment = signal<{ secretBase32: string } | null>(null);
  protected readonly qrDataUrl = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly verifying = signal(false);
  protected readonly recoveryCodes = signal<string[]>([]);
  protected readonly copyLabel = signal('Copiar códigos');

  protected readonly form: FormGroup = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  protected readonly codeCtrl = this.form.get('code') as FormControl<string>;

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
        try {
          const dataUrl = await QRCode.toDataURL(res.otpauthUri, {
            width: 256,
            margin: 1,
            errorCorrectionLevel: 'M',
          });
          this.qrDataUrl.set(dataUrl);
        } catch {
          this.qrDataUrl.set(res.qrCodeDataUrl);
        }
        this.stage.set('scan');
      },
      error: (err: HttpErrorResponse) => {
        this.errorMessage.set(this.toMessage(err));
      },
    });
  }

  protected codeError(): string | null {
    const ctrl = this.codeCtrl;
    if (!ctrl.errors || (!ctrl.dirty && !ctrl.touched)) return null;
    if (ctrl.errors['required']) return 'Ingresa el código.';
    if (ctrl.errors['pattern']) return 'El código debe tener exactamente 6 dígitos.';
    return null;
  }

  protected onVerify(): void {
    if (this.form.invalid || this.verifying()) {
      this.form.markAllAsTouched();
      return;
    }
    const enrollment = this.enrollment();
    if (!enrollment) return;
    const code = this.codeCtrl.value;

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
    this.router.navigateByUrl(this.profileRoute);
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    if (err.status === 400) {
      const body = err.error as { code?: string; message?: string } | null | undefined;
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
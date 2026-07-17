import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { AlertComponent, FormFieldComponent, SubmitButtonComponent } from '@shared/components';

import { AuthApiService } from '../../services/auth-api.service';

/**
 * MFA challenge screen (Sprint 17 / FE-17.3).
 *
 * <h3>How the user lands here</h3>
 * After {@code POST /auth/login} returns {@link LoginResultMfaRequired}
 * the login page redirects here with the {@code mfaToken} in the
 * router state. The {@code AuthService} stashes the token on its
 * signal store.
 *
 * <h3>What the user does</h3>
 * Types the 6-digit code from their authenticator app, OR a
 * 10-character recovery code (the BE accepts either).
 */
@Component({
  selector: 'app-mfa-challenge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AlertComponent, FormFieldComponent, SubmitButtonComponent],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">
          Verificación en dos pasos
        </h1>
        <p class="text-sm text-content-muted">
          Ingresa el código de 6 dígitos de tu aplicación autenticadora o un código de recuperación.
        </p>
      </header>

      @if (mfaMissing()) {
        <div class="space-y-4">
          <app-alert
            variant="error"
            message="Tu sesión MFA ha expirado. Vuelve a iniciar sesión."
          />
          <a
            [href]="loginRoute"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            Volver a iniciar sesión
          </a>
        </div>
      } @else {
        @if (errorMessage(); as msg) {
          <app-alert variant="error" [message]="msg" />
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
          <app-form-field
            fieldId="code"
            [control]="codeCtrl"
            label="Código"
            placeholder="123 456"
            autocomplete="one-time-code"
            inputmode="numeric"
            [maxlength]="11"
            [error]="codeError()"
            hint="6 dígitos (Google Authenticator, Authy, 1Password…) o un código de recuperación de 10 caracteres."
            extraInputClass="text-center font-mono text-2xl tracking-[0.5em]"
          />

          <app-submit-button
            [loading]="submitting()"
            [showArrow]="false"
            label="Verificar"
            loadingLabel="Verificando…"
          />
        </form>

        <p class="text-center text-xs text-content-muted">
          Perdiste tu dispositivo? Usa un
          <a
            [href]="loginRoute"
            class="font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            código de recuperación
          </a>
          y vuelve a iniciar sesión.
        </p>
      }
    </div>
  `,
})
export class MfaChallengeComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  protected readonly loginRoute = ROUTES.AUTH.LOGIN;

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly mfaToken = this.auth.mfaToken;
  protected readonly mfaMissing = signal(false);

  protected readonly form: FormGroup = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(11)]],
  });

  protected readonly codeCtrl = this.form.get('code') as FormControl<string>;

  private readonly _watchMfaToken = effect(() => {
    if (!this.mfaToken()) {
      this.mfaMissing.set(true);
    }
  });

  ngOnInit(): void {
    void this.mfaToken;
  }

  protected codeError(): string | null {
    const ctrl = this.codeCtrl;
    if (!ctrl.errors || (!ctrl.dirty && !ctrl.touched)) return null;
    if (ctrl.errors['required']) return 'Ingresa el código.';
    if (ctrl.errors['minlength']) return 'El código es demasiado corto.';
    if (ctrl.errors['maxlength']) return 'El código es demasiado largo.';
    return null;
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting() || this.mfaMissing()) {
      this.form.markAllAsTouched();
      return;
    }
    const token = this.mfaToken();
    if (!token) {
      this.mfaMissing.set(true);
      return;
    }
    const { code } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.authApi
      .challengeMfa({ code: code.replace(/\s+/g, '') })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (session) => {
          this.auth.setSession(session);
          this.auth.clearMfaToken();
          this.router.navigateByUrl(ROUTES.DASHBOARD.ROOT);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(this.toMessage(err));
        },
      });
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    if (err.status === 401) {
      const body = err.error as { code?: string; message?: string } | null | undefined;
      if (body?.code === 'MFA_TOKEN_MISSING' || body?.code === 'MFA_TOKEN_INVALID') {
        this.auth.clearMfaToken();
        this.mfaMissing.set(true);
        return 'Tu sesión MFA ha expirado. Vuelve a iniciar sesión.';
      }
      return body?.message ?? 'El código es incorrecto o ha expirado.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }
    return 'No se pudo verificar el código.';
  }
}
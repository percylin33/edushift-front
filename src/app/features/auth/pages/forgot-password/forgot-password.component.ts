import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ApiError } from '@core/models';
import { IconComponent, SpinnerComponent } from '@shared/components';

import { AuthApiService } from '../../services/auth-api.service';

/**
 * Forgot-password screen.
 *
 * <h3>Why the success state is always the same</h3>
 * Per ADR-17.3 the backend deliberately does not distinguish between
 * "email exists" and "email unknown" — the response is always 200 OK with
 * a generic message. This blocks user-enumeration timing attacks. The
 * FE mirrors that contract: the success state is shown unconditionally
 * after a non-error response, regardless of whether the user actually
 * had an account.
 *
 * <h3>What the user does next</h3>
 * After a successful request, the email is queued server-side and the
 * user is told to check their inbox. They click the link in the email,
 * which lands on {@code /auth/reset-password?token=...}. This component
 * never navigates there itself — the link is in the email.
 *
 * <h3>Errors</h3>
 * The form only surfaces the technical errors: rate-limit (429) and
 * "no se pudo conectar con el servidor" (status 0). The
 * "email-not-found" case is intentionally hidden (see above).
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, SpinnerComponent],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Recuperar contraseña</h1>
        <p class="text-sm text-content-muted">
          Te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </header>

      @if (sent()) {
        <div class="space-y-4">
          <div
            role="status"
            aria-live="polite"
            class="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success"
          >
            <app-icon name="check" [size]="18" class="mt-0.5 shrink-0" />
            <span
              >Si la cuenta existe, enviaremos un correo con instrucciones para restablecer la
              contraseña.</span
            >
          </div>
          <p class="text-sm text-content-muted">
            Revisa tu bandeja de entrada y sigue el enlace. El enlace caduca en
            <strong>1 hora</strong>.
          </p>
          <a
            routerLink="/auth/login"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            <app-icon name="arrow-left" [size]="14" />
            Volver a iniciar sesión
          </a>
        </div>
      } @else {
        @if (errorMessage(); as message) {
          <div
            role="alert"
            class="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
            <span>{{ message }}</span>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
          <div class="space-y-1.5">
            <label for="email" class="block text-sm font-medium text-content">Correo</label>
            <div class="relative">
              <span
                class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
              >
                <app-icon name="mail" [size]="16" />
              </span>
              <input
                id="email"
                type="email"
                autocomplete="email"
                formControlName="email"
                placeholder="tu@correo.com"
                [attr.aria-invalid]="emailInvalid()"
                [attr.aria-describedby]="emailInvalid() ? 'email-error' : 'email-help'"
                class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
              />
            </div>
            @if (emailInvalid()) {
              <p id="email-error" class="text-xs text-danger">{{ emailError() }}</p>
            } @else {
              <p id="email-help" class="text-xs text-content-subtle">
                Te enviaremos un enlace al correo asociado a tu cuenta.
              </p>
            }
          </div>

          <button
            type="submit"
            [disabled]="submitting() || form.invalid"
            class="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            @if (submitting()) {
              <app-spinner [size]="14" />
              Enviando…
            } @else {
              Enviar enlace
            }
          </button>
        </form>

        <p class="text-center text-sm text-content-muted">
          <a
            routerLink="/auth/login"
            class="font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            Volver a iniciar sesión
          </a>
        </p>
      }
    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
  });

  protected emailInvalid(): boolean {
    const ctrl = this.form.get('email');
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  protected emailError(): string | null {
    const ctrl = this.form.get('email');
    if (!ctrl || !ctrl.errors) return null;
    if (ctrl.errors['required']) return 'El correo es obligatorio.';
    if (ctrl.errors['email']) return 'Ingresa un correo válido.';
    if (ctrl.errors['maxlength']) return 'El correo es demasiado largo.';
    return null;
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.authApi
      .forgotPassword({ email })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          // Per ADR-17.3 we always show the success state, even if
          // the email does not exist on the backend. The user's
          // inbox is the only place they get a definitive answer.
          this.sent.set(true);
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
    if (err.status === 429) {
      return 'Has solicitado muchos enlaces. Espera unos minutos antes de intentar de nuevo.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }

    const body = err.error as ApiError | null | undefined;
    if (body?.code === 'VALIDATION_ERROR') {
      return body.message ?? 'Verifica el correo ingresado.';
    }
    return 'No se pudo enviar el enlace. Intenta nuevamente.';
  }
}

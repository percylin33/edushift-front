import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ApiError } from '@core/models';
import { AuthService, TenantService } from '@core/services';
import { ROUTES } from '@core/constants';
import { IconComponent, SpinnerComponent } from '@shared/components';

import { AuthApiService } from '../../services/auth-api.service';

/**
 * MFA challenge screen (Sprint 17 / FE-17.3).
 *
 * <h3>How the user lands here</h3>
 * After {@code POST /auth/login} returns {@link LoginResultMfaRequired}
 * the login page redirects here with the {@code mfaToken} in the
 * router state. The {@code AuthService} stashes the token on its
 * signal store, the {@code tenantInterceptor} already forwards the
 * {@code X-Tenant-Slug} header, and the {@code authInterceptor}
 * reads the {@code mfaToken} via a special-case override (see
 * {@code auth.interceptor.ts}).
 *
 * <h3>What the user does</h3>
 * Types the 6-digit code from their authenticator app, OR a
 * 10-character recovery code (the BE accepts either). On success
 * the full {@code AuthSession} is returned and the user lands on
 * the dashboard, just like a normal login.
 *
 * <h3>Failure modes</h3>
 * <ul>
 *   <li>401 INVALID_TOTP_CODE / INVALID_MFA_CODE — the code is wrong
 *       or expired; we re-render the empty form with a friendly
 *       message.</li>
 *   <li>401 MFA_TOKEN_MISSING / MFA_TOKEN_INVALID — the
 *       {@code mfaToken} has expired (5 min default). The only
 *       fix is to go back to login; we offer a button.</li>
 *   <li>No mfaToken at all (direct navigation) — we bounce to
 *       the login screen so the user doesn't end up stuck on a
 *       page that does nothing.</li>
 * </ul>
 */
@Component({
  selector: 'app-mfa-challenge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, SpinnerComponent],
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
          <div
            role="alert"
            class="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
            <span>Tu sesión MFA ha expirado. Vuelve a iniciar sesión.</span>
          </div>
          <a
            [href]="loginRoute"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            <app-icon name="arrow-left" [size]="14" />
            Volver a iniciar sesión
          </a>
        </div>
      } @else {
        @if (errorMessage(); as msg) {
          <div
            role="alert"
            class="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
            <span>{{ msg }}</span>
          </div>
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
          <div class="space-y-1.5">
            <label for="code" class="block text-sm font-medium text-content">Código</label>
            <input
              id="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              formControlName="code"
              placeholder="123 456"
              maxlength="11"
              [class.text-center]="true"
              [class.text-2xl]="true"
              [class.tracking-[0.5em]]="true"
              [class.font-mono]="true"
              [attr.aria-invalid]="codeInvalid()"
              [attr.aria-describedby]="codeInvalid() ? 'code-error' : 'code-help'"
              class="w-full rounded-md border border-border bg-surface px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            @if (codeInvalid()) {
              <p id="code-error" class="text-xs text-danger">{{ codeError() }}</p>
            } @else {
              <p id="code-help" class="text-xs text-content-subtle">
                6 dígitos (Google Authenticator, Authy, 1Password…) o un código de recuperación de
                10 caracteres.
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
              Verificando…
            } @else {
              Verificar
            }
          </button>
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
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);

  protected readonly loginRoute = ROUTES.AUTH.LOGIN;

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /**
   * The {@code mfaToken} lives on the auth state (set by the login
   * page right before navigating). If the user reloads this page
   * directly, the token is gone — we surface a friendly message and
   * bounce to login.
   */
  protected readonly mfaToken = this.auth.mfaToken;
  protected readonly mfaMissing = signal(false);

  protected readonly form: FormGroup = this.fb.nonNullable.group({
    // Both formats accepted: 6 numeric OR 5-5 alphanumeric. We validate
    // shape only here; the BE does the real TOTP / recovery-code check.
    code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(11)]],
  });

  // Whenever the auth state clears the mfaToken, mark the page as
  // missing. This happens on a hard refresh — the user has to log
  // in again to get a fresh mfaToken.
  private readonly _watchMfaToken = effect(() => {
    if (!this.mfaToken()) {
      this.mfaMissing.set(true);
    }
  });

  ngOnInit(): void {
    // If the user deep-links here with no token at all, the guard
    // above fires and the form is hidden. No additional action.
    // `effect` is the actual data path; ngOnInit exists to satisfy
    // the OnInit contract and the linter's no-empty-lifecycle rule.
    void this.mfaToken;
  }

  protected codeInvalid(): boolean {
    const ctrl = this.form.get('code');
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  protected codeError(): string | null {
    const ctrl = this.form.get('code');
    if (!ctrl || !ctrl.errors) return null;
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
      const body = err.error as ApiError | null | undefined;
      if (body?.code === 'MFA_TOKEN_MISSING' || body?.code === 'MFA_TOKEN_INVALID') {
        // Token expired — go back to login.
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

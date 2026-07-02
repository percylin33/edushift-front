import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { AuthApiService } from '../../services/auth-api.service';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { ApiError } from '@core/models';

/**
 * Reset-password screen.
 *
 * <h3>Flow</h3>
 * <ol>
 *   <li>User clicks the link in the "forgot password" email, which
 *       points to {@code /auth/reset-password?token=...}.</li>
 *   <li>This page mounts, calls
 *       {@code GET /v1/auth/reset-password/validate?token=...} to know
 *       whether the token is still usable.</li>
 *   <li>If valid, the user types a new password twice. The submit calls
 *       {@code POST /v1/auth/reset-password} with the same token + the
 *       new password. On success every active refresh token for the user
 *       is revoked, so the user lands logged-out (intentional — they
 *       log in again with the new password).</li>
 * </ol>
 *
 * <h3>Why we validate up front</h3>
 * The validate endpoint is a read-only {@code GET} that the user can
 * reach by clicking the email link. We use it to surface a friendly
 * error copy before the user has typed anything — otherwise the only
 * signal that the link is expired is the POST failing on submit, by
 * which point the user has already invested in the form.
 *
 * <h3>Why we don't auto-login after reset</h3>
 * The backend intentionally revokes all active refresh tokens on a
 * successful reset (anti-hijack). So even if we wanted to keep the
 * session alive, the only safe move is to bounce the user to the login
 * screen.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, SpinnerComponent],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Restablecer contraseña</h1>
        <p class="text-sm text-content-muted">Ingresa tu nueva contraseña.</p>
      </header>

      @if (validationState() === 'invalid') {
        <div class="space-y-4">
          <div
            role="alert"
            class="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
            <span>{{ validationError() }}</span>
          </div>
          <a
            routerLink="/auth/forgot-password"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            <app-icon name="arrow-left" [size]="14" />
            Solicitar un nuevo enlace
          </a>
        </div>
      } @else if (validationState() === 'validating') {
        <div class="flex items-center gap-2 text-sm text-content-muted">
          <app-spinner [size]="14" />
          Validando enlace…
        </div>
      } @else if (success()) {
        <div class="space-y-4">
          <div
            role="status"
            aria-live="polite"
            class="flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success"
          >
            <app-icon name="check" [size]="18" class="mt-0.5 shrink-0" />
            <span>Tu contraseña fue actualizada. Inicia sesión con tu nueva contraseña.</span>
          </div>
          <a
            routerLink="/auth/login"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            <app-icon name="arrow-left" [size]="14" />
            Ir a iniciar sesión
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
            <label for="password" class="block text-sm font-medium text-content"
              >Nueva contraseña</label
            >
            <div class="relative">
              <span
                class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
              >
                <app-icon name="lock" [size]="16" />
              </span>
              <input
                id="password"
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="new-password"
                formControlName="password"
                [attr.aria-invalid]="passwordInvalid()"
                [attr.aria-describedby]="passwordInvalid() ? 'password-error' : 'password-help'"
                class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-10 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
              />
              <button
                type="button"
                (click)="togglePasswordVisibility()"
                [attr.aria-label]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-content-subtle hover:text-content"
              >
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="16" />
              </button>
            </div>
            @if (passwordInvalid()) {
              <p id="password-error" class="text-xs text-danger">{{ passwordError() }}</p>
            } @else {
              <p id="password-help" class="text-xs text-content-subtle">Mínimo 8 caracteres.</p>
            }
          </div>

          <div class="space-y-1.5">
            <label for="passwordConfirmation" class="block text-sm font-medium text-content"
              >Confirmar contraseña</label
            >
            <div class="relative">
              <span
                class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-subtle"
              >
                <app-icon name="lock" [size]="16" />
              </span>
              <input
                id="passwordConfirmation"
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="new-password"
                formControlName="passwordConfirmation"
                [attr.aria-invalid]="confirmationInvalid()"
                [attr.aria-describedby]="confirmationInvalid() ? 'confirmation-error' : null"
                class="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70"
              />
            </div>
            @if (confirmationInvalid()) {
              <p id="confirmation-error" class="text-xs text-danger">
                Las contraseñas no coinciden.
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
              Actualizando…
            } @else {
              Restablecer contraseña
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
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);
  protected readonly success = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /**
   * Lifecycle of the validate-only check at mount time.
   * - `validating` — request in flight (also the initial state)
   * - `valid`     — token is usable, render the form
   * - `invalid`   — token is expired / used / missing / cross-tenant
   */
  protected readonly validationState = signal<'validating' | 'valid' | 'invalid'>('validating');
  protected readonly validationError = signal<string>('El enlace no es válido o ha caducado.');
  protected readonly token = signal<string | null>(null);

  protected readonly form: FormGroup = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      passwordConfirmation: ['', [Validators.required]],
    },
    { validators: [this.passwordsMatch] },
  );

  // Re-validate the form whenever the password fields change so the
  // "passwords must match" check updates on keystroke.
  private readonly _revalidate = effect(() => {
    this.form.get('password')?.valueChanges.subscribe(() => this.form.updateValueAndValidity());
    this.form
      .get('passwordConfirmation')
      ?.valueChanges.subscribe(() => this.form.updateValueAndValidity());
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.validationState.set('invalid');
      this.validationError.set('Falta el token de restablecimiento. Usa el enlace del correo.');
      return;
    }
    this.token.set(token);

    this.authApi
      .validateResetToken(token)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          this.validationState.set('invalid');
          this.validationError.set(this.toValidationMessage(err));
          return of(null);
        }),
      )
      .subscribe((res) => {
        if (res === null) return; // already handled
        if (res.valid) {
          this.validationState.set('valid');
        } else {
          this.validationState.set('invalid');
          this.validationError.set(this.toValidationReasonMessage(res.reasonCode));
        }
      });
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  protected passwordInvalid(): boolean {
    const ctrl = this.form.get('password');
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  protected passwordError(): string | null {
    const ctrl = this.form.get('password');
    if (!ctrl || !ctrl.errors) return null;
    if (ctrl.errors['required']) return 'La contraseña es obligatoria.';
    if (ctrl.errors['minlength']) return 'La contraseña debe tener al menos 8 caracteres.';
    if (ctrl.errors['maxlength']) return 'La contraseña es demasiado larga.';
    return null;
  }

  protected confirmationInvalid(): boolean {
    const ctrl = this.form.get('passwordConfirmation');
    if (!ctrl || (!ctrl.dirty && !ctrl.touched)) return false;
    if (ctrl.errors?.['required']) return true;
    const matchError = this.form.errors?.['passwordsMismatch'];
    return !!matchError;
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting() || this.token() === null) {
      this.form.markAllAsTouched();
      return;
    }
    const { password, passwordConfirmation } = this.form.getRawValue();
    if (password !== passwordConfirmation) {
      return; // re-validation handles the message
    }
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.authApi
      .resetPassword({ token: this.token()!, password, passwordConfirmation })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.success.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(this.toMessage(err));
        },
      });
  }

  // Form-level validator: passwords must match. We use a custom key so
  // the message is friendly (`passwordsMismatch`).
  private passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const p = group.get('password')?.value;
    const c = group.get('passwordConfirmation')?.value;
    if (p && c && p !== c) {
      return { passwordsMismatch: true };
    }
    return null;
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    if (err.status === 401) {
      return 'El enlace ha caducado o ya fue utilizado.';
    }
    if (err.status === 400) {
      const body = err.error as ApiError | null | undefined;
      if (body?.code === 'PASSWORD_CONFIRM_MISMATCH') {
        return 'Las contraseñas no coinciden.';
      }
      if (body?.code === 'VALIDATION_ERROR') {
        return body.message ?? 'La contraseña no cumple los requisitos.';
      }
      return body?.message ?? 'La contraseña no es válida.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }
    return 'No se pudo restablecer la contraseña.';
  }

  private toValidationMessage(err: HttpErrorResponse): string {
    const body = err.error as ApiError | null | undefined;
    // The validate endpoint always returns 200 with `valid: false` for
    // bad tokens; we only land here for transport errors.
    return body?.message ?? 'No se pudo validar el enlace. Intenta nuevamente.';
  }

  private toValidationReasonMessage(code: string | null | undefined): string {
    switch (code) {
      case 'RESET_TOKEN_EXPIRED':
        return 'El enlace ha caducado. Solicita uno nuevo.';
      case 'RESET_TOKEN_USED':
        return 'Este enlace ya fue utilizado.';
      case 'RESET_TOKEN_SUPERSEDED':
        return 'Este enlace fue reemplazado por uno más reciente.';
      case 'RESET_TOKEN_MISSING':
        return 'Falta el token en el enlace.';
      case 'RESET_TOKEN_TENANT_NOT_FOUND':
        return 'La institución asociada al enlace ya no existe.';
      case 'RESET_TOKEN_MALFORMED':
        return 'El enlace está malformado.';
      case 'RESET_TOKEN_INVALID':
      case 'RESET_TOKEN_WRONG_TYPE':
      default:
        return 'El enlace no es válido o ha caducado.';
    }
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of } from 'rxjs';

import { AuthApiService } from '../../services/auth-api.service';
import {
  AlertComponent,
  IconComponent,
  PasswordFieldComponent,
  SubmitButtonComponent,
} from '@shared/components';
import { mapHttpError } from '@shared/utils';

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
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    IconComponent,
    PasswordFieldComponent,
    SubmitButtonComponent,
  ],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Restablecer contraseña</h1>
        <p class="text-sm text-content-muted">Ingresa tu nueva contraseña.</p>
      </header>

      @if (validationState() === 'invalid') {
        <div class="space-y-4">
          <app-alert variant="error" [message]="validationError()" />
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
          <app-icon name="refresh" [size]="14" class="animate-spin" />
          Validando enlace…
        </div>
      } @else if (success()) {
        <div class="space-y-4">
          <app-alert
            variant="success"
            message="Tu contraseña fue actualizada. Inicia sesión con tu nueva contraseña."
          />
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
          <app-alert variant="error" [message]="message" />
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
          <app-password-field
            fieldId="password"
            [control]="passwordCtrl"
            label="Nueva contraseña"
            autocomplete="new-password"
            placeholder="••••••••"
            [error]="passwordError()"
            hint="Mínimo 8 caracteres."
          />

          <app-password-field
            fieldId="passwordConfirmation"
            [control]="confirmationCtrl"
            label="Confirmar contraseña"
            autocomplete="new-password"
            [error]="confirmationError()"
          />

          <app-submit-button
            [loading]="submitting()"
            [showArrow]="false"
            label="Restablecer contraseña"
            loadingLabel="Actualizando…"
          />
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
  private readonly destroyRef = inject(DestroyRef);

  protected readonly submitting = signal(false);
  protected readonly success = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

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

  protected readonly passwordCtrl = this.form.get('password') as FormControl<string>;
  protected readonly confirmationCtrl = this.form.get('passwordConfirmation') as FormControl<string>;

  /** Whether the form-level "passwords must match" validator is currently failing. */
  private readonly _mismatch = signal(false);
  private readonly _confirmationTouched = signal(false);

  constructor() {
    this.passwordCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.updateValueAndValidity({ emitEvent: false }));
    this.confirmationCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.form.updateValueAndValidity({ emitEvent: false }));

    effect(() => {
      this._mismatch.set(!!this.form.errors?.['passwordsMismatch']);
    });
  }

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
        if (res === null) return;
        if (res.valid) {
          this.validationState.set('valid');
        } else {
          this.validationState.set('invalid');
          this.validationError.set(this.toValidationReasonMessage(res.reasonCode));
        }
      });
  }

  protected passwordError(): string | null {
    const ctrl = this.passwordCtrl;
    if (!ctrl.errors || (!ctrl.dirty && !ctrl.touched)) return null;
    if (ctrl.errors['required']) return 'La contraseña es obligatoria.';
    if (ctrl.errors['minlength']) return 'La contraseña debe tener al menos 8 caracteres.';
    if (ctrl.errors['maxlength']) return 'La contraseña es demasiado larga.';
    return null;
  }

  protected confirmationError(): string | null {
    if (!this._confirmationTouched()) return null;
    if (this.confirmationCtrl.errors?.['required']) return 'Confirma tu nueva contraseña.';
    if (this._mismatch()) return 'Las contraseñas no coinciden.';
    return null;
  }

  protected onSubmit(): void {
    if (this.form.invalid || this.submitting() || this.token() === null) {
      this.form.markAllAsTouched();
      this._confirmationTouched.set(true);
      return;
    }
    const { password, passwordConfirmation } = this.form.getRawValue();
    if (password !== passwordConfirmation) {
      this._confirmationTouched.set(true);
      return;
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

  // Form-level validator: passwords must match.
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
      const body = err.error as { code?: string; message?: string } | null | undefined;
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
    return mapHttpError(err, { fallback: 'No se pudo restablecer la contraseña.' });
  }

  private toValidationMessage(err: HttpErrorResponse): string {
    const body = err.error as { message?: string } | null | undefined;
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
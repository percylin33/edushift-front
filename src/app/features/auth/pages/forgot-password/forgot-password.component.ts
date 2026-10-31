import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  AlertComponent,
  FormFieldComponent,
  IconComponent,
  SubmitButtonComponent,
} from '@shared/components';
import { mapHttpError } from '@shared/utils';

import { AuthApiService } from '../../services/auth-api.service';
import { TenantService } from '@core/services';

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
 * <h3>Tenant from URL (same as login)</h3>
 * Institution identity comes from the hostname in local development and
 * the configured strategy elsewhere, resolved at boot by
 * {@link TenantService}. There is no "Institución" field; the hostname
 * scopes the request locally.
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    FormFieldComponent,
    IconComponent,
    SubmitButtonComponent,
  ],
  template: `
    <div class="space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Recuperar contraseña</h1>
        <p class="text-sm text-content-muted">
          @if (schoolName(); as name) {
            Te enviaremos un enlace para restablecer tu contraseña en {{ name }}.
          } @else {
            Te enviaremos un enlace para restablecer tu contraseña.
          }
        </p>
      </header>

      @if (sent()) {
        <div class="space-y-4">
          <app-alert
            variant="success"
            message="Si la cuenta existe, enviaremos un correo con instrucciones para restablecer la contraseña."
          />
          <p class="text-sm text-content-muted">
            Revisa tu bandeja de entrada y sigue el enlace. El enlace caduca en
            <strong>1 hora</strong>.
          </p>
          <a
            routerLink="/auth/login"
            [queryParams]="loginQueryParams()"
            class="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
          >
            <app-icon name="arrow-left" [size]="14" />
            Volver a iniciar sesión
          </a>
        </div>
      } @else {
        @if (errorMessage(); as message) {
          <app-alert variant="error" [message]="message" />
        }

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4" novalidate>
          <app-form-field
            fieldId="email"
            [control]="emailCtrl"
            label="Correo"
            icon="mail"
            type="email"
            placeholder="tu@correo.com"
            autocomplete="email"
            [error]="emailError()"
            hint="Te enviaremos un enlace al correo asociado a tu cuenta."
          />

          <app-submit-button
            [loading]="submitting()"
            [showArrow]="false"
            label="Enviar enlace"
            loadingLabel="Enviando…"
          />
        </form>

        <p class="text-center text-sm text-content-muted">
          <a
            routerLink="/auth/login"
            [queryParams]="loginQueryParams()"
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
  private readonly tenant = inject(TenantService);

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly schoolName = computed(() => {
    const t = this.tenant.tenant();
    if (!t?.name || !t.id || t.id === t.slug) return null;
    return t.name;
  });

  protected loginQueryParams(): Record<string, string> {
    const slug = this.tenant.tenantSlug();
    return slug ? { tenant: slug } : {};
  }

  protected readonly form: FormGroup = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
  });

  protected readonly emailCtrl = this.form.get('email') as FormControl<string>;

  emailError(): string | null {
    const ctrl = this.emailCtrl;
    if (!ctrl.errors || (!ctrl.dirty && !ctrl.touched)) return null;
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

    const tenantSlug = this.tenant.tenantSlug()?.trim().toLowerCase();
    if (!tenantSlug) {
      this.errorMessage.set(
        'Pide a tu institución el enlace de acceso y luego selecciona «¿Olvidaste tu contraseña?».',
      );
      return;
    }

    const { email } = this.form.getRawValue();
    this.tenant.setSlug(tenantSlug);
    this.errorMessage.set(null);
    this.submitting.set(true);

    this.authApi
      .forgotPassword({ tenantSlug, email })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          this.sent.set(true);
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage.set(
            mapHttpError(err, {
              rateLimit: 'Has solicitado muchos enlaces. Espera unos minutos antes de intentar de nuevo.',
              fallback: 'No se pudo enviar el enlace. Intenta nuevamente.',
            }),
          );
        },
      });
  }
}

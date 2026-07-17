import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { AuthService } from '@core/services';
import {
  AlertComponent,
  IconComponent,
  PasswordFieldComponent,
  SpinnerComponent,
  SubmitButtonComponent,
} from '@shared/components';
import { AuthApiService } from '@features/auth/services/auth-api.service';
import { UsersApiService } from '../../services';
import { InvitationPreflight } from '../../models';

/**
 * Public landing for redeeming an invitation token.
 *
 * <h3>Lifecycle</h3>
 * <ol>
 *   <li>On mount, read {@code :token} from the URL and call
 *       {@link UsersApiService#previewInvitation}.</li>
 *   <li>Map error responses to actionable copy:
 *     <ul>
 *       <li><b>404</b> → "Enlace inválido"</li>
 *       <li><b>410</b> → "El enlace ya no es válido" with a sub-reason.</li>
 *     </ul>
 *   </li>
 *   <li>Once the password form is submitted, call
 *       {@link UsersApiService#acceptInvitation}, persist the resulting
 *       session via {@link AuthService}, and navigate to the
 *       dashboard.</li>
 * </ol>
 */
@Component({
  selector: 'app-invitation-accept',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AlertComponent,
    IconComponent,
    PasswordFieldComponent,
    SpinnerComponent,
    SubmitButtonComponent,
  ],
  template: `
    <div class="space-y-6">
      @if (preflight(); as p) {
        <header class="space-y-1.5 text-center">
          <p class="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
            {{ p.tenantName }}
          </p>
          <h1 class="text-2xl font-semibold tracking-tight text-content">
            ¡Bienvenido{{ p.firstName ? ', ' + p.firstName : '' }}!
          </h1>
          <p class="text-sm text-content-muted">
            Estás a un paso de unirte al workspace. Crea una contraseña para activar tu cuenta.
          </p>
        </header>

        @if (errorMessage(); as err) {
          <app-alert variant="error" [message]="err" />
        }

        <form class="space-y-4" [formGroup]="form" (ngSubmit)="onSubmit()">
          <div class="space-y-1.5">
            <label for="invitation-email" class="block text-sm font-medium text-content">Correo</label>
            <input
              id="invitation-email"
              type="email"
              [value]="p.email"
              disabled
              autocomplete="username"
              class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <app-password-field
            fieldId="invitation-password"
            [control]="passwordCtrl"
            label="Contraseña"
            autocomplete="new-password"
            placeholder="Mínimo 8 caracteres"
            [maxlength]="128"
            hint="Al menos 8 caracteres. Recomendamos una frase larga."
          />

          <app-password-field
            fieldId="invitation-password-confirm"
            [control]="confirmCtrl"
            label="Confirmar contraseña"
            autocomplete="new-password"
            [error]="confirmError()"
          />

          <app-submit-button
            [loading]="saving()"
            [disabled]="!canSubmit()"
            label="Activar cuenta"
            loadingLabel="Activando…"
          />
        </form>

        <p class="text-center text-xs text-content-muted">
          Al activar aceptas los términos del workspace
          <span class="font-medium text-content">{{ p.tenantName }}</span
          >.
        </p>
      } @else if (loading()) {
        <div class="flex items-center justify-center py-12">
          <app-spinner [size]="28" label="Validando enlace…" />
        </div>
      } @else {
        <div class="space-y-4 text-center">
          <div
            class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger"
          >
            <app-icon name="alert-circle" [size]="28" />
          </div>
          <header class="space-y-1.5">
            <h1 class="text-2xl font-semibold tracking-tight text-content">
              {{ blockerTitle() }}
            </h1>
            <p class="text-sm text-content-muted">{{ blockerMessage() }}</p>
          </header>
          <a
            [routerLink]="loginRoute"
            class="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-content hover:bg-surface-muted"
          >
            Ir al inicio de sesión
          </a>
        </div>
      }
    </div>
  `,
})
export class InvitationAcceptComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UsersApiService);
  private readonly authApi = inject(AuthApiService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loginRoute = ROUTES.AUTH.LOGIN;

  protected readonly form: FormGroup = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
      passwordConfirm: ['', [Validators.required]],
    },
    { validators: [this.passwordsMatch] },
  );

  protected readonly passwordCtrl = this.form.get('password') as FormControl<string>;
  protected readonly confirmCtrl = this.form.get('passwordConfirm') as FormControl<string>;

  protected readonly preflight = signal<InvitationPreflight | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly blockerTitle = signal('Enlace inválido');
  protected readonly blockerMessage = signal(
    'No pudimos validar tu invitación. Pídele al administrador un enlace nuevo.',
  );

  protected readonly passwordsMismatch = computed(() => !!this.form.errors?.['passwordsMismatch']);
  protected readonly canSubmit = computed(
    () => !!this.preflight() && this.passwordCtrl.value.length >= 8 && !this.passwordsMismatch(),
  );

  private token: string | null = null;

  async ngOnInit(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) {
      this.loading.set(false);
      return;
    }
    this.token = token;

    try {
      const preview = await firstValueFrom(this.api.previewInvitation(token));
      this.preflight.set(preview);
    } catch (err) {
      this.applyPreflightError(err);
      this.preflight.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected confirmError(): string | null {
    if (!this.confirmCtrl.touched && !this.confirmCtrl.dirty) return null;
    if (this.confirmCtrl.errors?.['required']) return 'Confirma tu nueva contraseña.';
    if (this.passwordsMismatch()) return 'Las contraseñas no coinciden.';
    return null;
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit() || !this.token) return;
    this.confirmCtrl.markAsTouched();

    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const session = await firstValueFrom(
        this.api.acceptInvitation({ token: this.token, password: this.passwordCtrl.value }),
      );
      this.authService.setSession(session);
      try {
        const user = await firstValueFrom(this.authApi.me());
        this.authService.setUser(user);
      } catch {
        /* best-effort role hydration */
      }
      await this.router.navigate([ROUTES.DASHBOARD.ROOT]);
    } catch (err) {
      this.errorMessage.set(this.toErrorMessage(err));
    } finally {
      this.saving.set(false);
    }
  }

  private applyPreflightError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const apiErr = (err.error as { error?: { code?: string } } | null | undefined)?.error;
      const code = apiErr?.code ?? '';

      if (err.status === 404) {
        this.blockerTitle.set('Enlace no encontrado');
        this.blockerMessage.set(
          'El enlace que abriste ya no existe. Pídele al administrador uno nuevo.',
        );
        return;
      }
      if (err.status === 410) {
        this.blockerTitle.set('Enlace no disponible');
        this.blockerMessage.set(this.goneReason(code));
        return;
      }
    }

    this.blockerTitle.set('Enlace inválido');
    this.blockerMessage.set(
      'No pudimos validar tu invitación. Pídele al administrador un enlace nuevo.',
    );
  }

  private goneReason(code: string): string {
    switch (code) {
      case 'INVITATION_ALREADY_ACCEPTED':
        return 'Esta invitación ya fue aceptada. Inicia sesión con la contraseña que creaste.';
      case 'INVITATION_CANCELLED':
        return 'El administrador canceló esta invitación. Pídele uno nuevo.';
      case 'INVITATION_EXPIRED':
        return 'El enlace expiró antes de ser activado. Solicita una nueva invitación.';
      default:
        return 'El enlace ya no se puede usar. Pídele al administrador uno nuevo.';
    }
  }

  private toErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const apiErr = (err.error as { error?: { message?: string } } | null | undefined)?.error;
      if (apiErr?.message) return apiErr.message;
      if (err.status === 0) return 'No pudimos contactar al servidor. Revisa tu conexión.';
    }
    if (err && typeof err === 'object') {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === 'string') return msg;
    }
    return 'No pudimos activar tu cuenta. Inténtalo de nuevo.';
  }

  private passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const p = group.get('password')?.value;
    const c = group.get('passwordConfirm')?.value;
    if (p && c && p !== c) return { passwordsMismatch: true };
    return null;
  }
}
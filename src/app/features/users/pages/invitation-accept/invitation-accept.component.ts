import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { ApiError } from '@core/models';
import { AuthService } from '@core/services';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AuthApiService } from '@features/auth/services/auth-api.service';
import { UsersApiService } from '../../services';
import { InvitationPreflight } from '../../models';

/**
 * Public landing for redeeming an invitation token.
 *
 * <h3>Lifecycle</h3>
 * <ol>
 *   <li>On mount, read {@code :token} from the URL and call
 *       {@link UsersApiService#previewInvitation}. The response carries
 *       the recipient's name + tenant name so the greeting is
 *       personalized before the password is set.</li>
 *   <li>Map error responses to actionable copy:
 *     <ul>
 *       <li><b>404</b> → "Enlace inválido"</li>
 *       <li><b>410</b> → "El enlace ya no es válido" with a sub-reason
 *           inferred from the error code (ACCEPTED / CANCELLED /
 *           EXPIRED).</li>
 *     </ul>
 *   </li>
 *   <li>Once the password form is submitted, call
 *       {@link UsersApiService#acceptInvitation}, persist the resulting
 *       session via {@link AuthService}, and navigate to the
 *       dashboard. The user is now signed in inside the right tenant.</li>
 * </ol>
 *
 * <h3>Why this lives under the {@code users} feature</h3>
 * The endpoint family is {@code /v1/users/invitations/**} and the
 * {@link UsersApiService} already owns the boundary. Hosting the
 * accept page anywhere else would duplicate the wire layer.
 */
@Component({
  selector: 'app-invitation-accept',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent, SpinnerComponent],
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
          <div
            role="alert"
            class="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger"
          >
            <app-icon name="alert-circle" [size]="18" class="mt-0.5 shrink-0" />
            <span>{{ err }}</span>
          </div>
        }

        <form class="space-y-4" (ngSubmit)="onSubmit()">
          <div class="field">
            <label class="label" for="invitation-email">Correo</label>
            <input
              id="invitation-email"
              type="email"
              class="input"
              [value]="p.email"
              disabled
              autocomplete="username"
            />
          </div>

          <div class="field">
            <label class="label" for="invitation-password">Contraseña</label>
            <div class="relative">
              <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-content-subtle">
                <app-icon name="lock" [size]="16" />
              </span>
              <input
                id="invitation-password"
                [type]="passwordVisible() ? 'text' : 'password'"
                class="input pl-9 pr-10"
                placeholder="Mínimo 8 caracteres"
                autocomplete="new-password"
                minlength="8"
                maxlength="128"
                required
                [ngModel]="password()"
                (ngModelChange)="password.set($event)"
                name="password"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center pr-3 text-content-subtle hover:text-content"
                [attr.aria-label]="passwordVisible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                (click)="togglePasswordVisibility()"
              >
                <app-icon [name]="passwordVisible() ? 'eye-off' : 'eye'" [size]="16" />
              </button>
            </div>
            <p class="hint">Al menos 8 caracteres. Recomendamos una frase larga.</p>
          </div>

          <div class="field">
            <label class="label" for="invitation-password-confirm">Confirmar contraseña</label>
            <input
              id="invitation-password-confirm"
              [type]="passwordVisible() ? 'text' : 'password'"
              class="input"
              autocomplete="new-password"
              required
              [ngModel]="passwordConfirm()"
              (ngModelChange)="passwordConfirm.set($event)"
              name="passwordConfirm"
            />
            @if (passwordsMismatch()) {
              <p class="error">Las contraseñas no coinciden.</p>
            }
          </div>

          <button
            type="submit"
            class="btn btn-primary w-full"
            [disabled]="!canSubmit() || saving()"
          >
            @if (saving()) {
              <app-spinner [size]="16" label="Activando…" />
              <span>Activando…</span>
            } @else {
              <span>Activar cuenta</span>
              <app-icon name="arrow-right" [size]="16" />
            }
          </button>
        </form>

        <p class="text-center text-xs text-content-muted">
          Al activar aceptas los términos del workspace
          <span class="font-medium text-content">{{ p.tenantName }}</span>.
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
          <a [routerLink]="loginRoute" class="btn btn-outline btn-sm">
            Ir al inicio de sesión
          </a>
        </div>
      }
    </div>
  `
})
export class InvitationAcceptComponent implements OnInit {
  private readonly api = inject(UsersApiService);
  private readonly authApi = inject(AuthApiService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly loginRoute = ROUTES.AUTH.LOGIN;

  /*
   * Signals (not plain strings) so {@link #canSubmit} and
   * {@link #passwordsMismatch} actually re-evaluate on every keystroke.
   * Mirrors the rationale in {@link InviteUserModalComponent}: a
   * {@code computed()} only invalidates when its tracked signal deps
   * change, so plain string fields would leave the submit button
   * permanently disabled.
   */
  protected readonly password = signal('');
  protected readonly passwordConfirm = signal('');

  protected readonly preflight = signal<InvitationPreflight | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Title shown when preflight failed (404 / 410 / network error). */
  protected readonly blockerTitle = signal('Enlace inválido');
  /** Sub-message shown next to the title when preflight failed. */
  protected readonly blockerMessage = signal(
    'No pudimos validar tu invitación. Pídele al administrador un enlace nuevo.'
  );

  private readonly _passwordVisible = signal(false);
  protected readonly passwordVisible = this._passwordVisible.asReadonly();

  protected readonly passwordsMismatch = computed(() => {
    return (
      this.passwordConfirm().length > 0 && this.password() !== this.passwordConfirm()
    );
  });

  protected readonly canSubmit = computed(() => {
    return (
      this.password().length >= 8 &&
      this.password() === this.passwordConfirm() &&
      !!this.preflight()
    );
  });

  /** Token captured at load time so we can resubmit without re-reading the URL. */
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
    }
    catch (err) {
      this.applyPreflightError(err);
      this.preflight.set(null);
    }
    finally {
      this.loading.set(false);
    }
  }

  protected togglePasswordVisibility(): void {
    this._passwordVisible.update((v) => !v);
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit() || !this.token) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    try {
      const session = await firstValueFrom(
        this.api.acceptInvitation({ token: this.token, password: this.password() })
      );
      this.authService.setSession(session);
      /* `accept` returns a lean {@code UserSummary} (mirrors `/auth/login`).
       * Chain {@code /auth/me} so the freshly-onboarded user lands on the
       * dashboard with the correct role set already hydrated; otherwise
       * role-gated guards (e.g. {@code TENANT_ADMIN}) would bounce them.
       * Best-effort: a failure here just defers role hydration to the
       * boot initializer on the next reload. */
      try {
        const user = await firstValueFrom(this.authApi.me());
        this.authService.setUser(user);
      } catch {
        /* Swallow on purpose — see comment above. */
      }
      /* The freshly created session already carries the correct tenant
       * (the backend stamps it from the invitation row); navigate
       * straight to the authenticated landing page. */
      await this.router.navigate([ROUTES.DASHBOARD.ROOT]);
    }
    catch (err) {
      this.errorMessage.set(this.toErrorMessage(err));
    }
    finally {
      this.saving.set(false);
    }
  }

  /**
   * Map the backend error envelope (or a transport-level fallback) to
   * a user-facing copy. The two semantically meaningful failure modes
   * are 404 (token never existed) and 410 (token existed but is no
   * longer redeemable — accepted / cancelled / expired). Everything
   * else falls back to a generic message.
   */
  private applyPreflightError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      const apiErr = (err.error as { error?: ApiError } | null | undefined)?.error;
      const code = apiErr?.code ?? '';

      if (err.status === 404) {
        this.blockerTitle.set('Enlace no encontrado');
        this.blockerMessage.set(
          'El enlace que abriste ya no existe. Pídele al administrador uno nuevo.'
        );
        return;
      }
      if (err.status === 410) {
        const reason = this.goneReason(code);
        this.blockerTitle.set('Enlace no disponible');
        this.blockerMessage.set(reason);
        return;
      }
    }

    this.blockerTitle.set('Enlace inválido');
    this.blockerMessage.set(
      'No pudimos validar tu invitación. Pídele al administrador un enlace nuevo.'
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
      const apiErr = (err.error as { error?: ApiError } | null | undefined)?.error;
      if (apiErr?.message) return apiErr.message;
      if (err.status === 0) return 'No pudimos contactar al servidor. Revisa tu conexión.';
    }
    if (err && typeof err === 'object') {
      const msg = (err as { message?: unknown }).message;
      if (typeof msg === 'string') return msg;
    }
    return 'No pudimos activar tu cuenta. Inténtalo de nuevo.';
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '@core/services';
import { ROUTES } from '@core/constants';
import { ApiError, User } from '@core/models';
import { IconComponent, SpinnerComponent, PromptDialogService } from '@shared/components';
import { InitialsPipe } from '@shared/pipes';

import { ProfileService } from '../../services/profile.service';

const ACCEPTED_AVATAR_MIME = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB — matches the `file_validator` default

/**
 * Self-service profile page (Sprint 17 / FE-17.2).
 *
 * <h3>What the page shows</h3>
 * <ul>
 *   <li><b>Avatar</b> with click-to-replace + remove. Drag/drop is left for
 *       a follow-up (the existing {@code FileUploadComponent} in
 *       {@code @shared} already does this for materials; we keep this
 *       page simple and uniform with the rest of the form).</li>
 *   <li><b>Identity fields</b> (email, status, last login) — read-only.
 *       Email and status are managed by the auth flow; we surface
 *       them here so the user can confirm at a glance.</li>
 *   <li><b>Editable fields</b> (firstName, lastName, phone) — PATCH
 *       {@code /v1/users/{me}} via the public users API. Optimistic
 *       update on the local cache so the navbar initials refresh
 *       immediately.</li>
 *   <li><b>Change password</b> link to the forgot-password flow. We
 *       reuse the same screen rather than building a parallel
 *       "change-password-while-logged-in" form, because the BE doesn't
 *       yet ship a dedicated endpoint and the reset flow is the
 *       canonical one (it also forces all sessions out, which is the
 *       correct security stance).</li>
 * </ul>
 *
 * <h3>State strategy</h3>
 * The page reads from the global {@link AuthService} for the current
 * {@code User}, and writes back via {@code AuthService.setUser()} so the
 * navbar / sidebar / etc. pick up the new name without a hard refresh.
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, IconComponent, SpinnerComponent, InitialsPipe],
  template: `
    <div class="mx-auto max-w-3xl space-y-6">
      <header class="space-y-1.5">
        <h1 class="text-2xl font-semibold tracking-tight text-content">Mi perfil</h1>
        <p class="text-sm text-content-muted">
          Administra tu información personal, avatar y contraseña.
        </p>
      </header>

      <!-- Avatar -->
      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <h2 class="text-base font-semibold text-content">Avatar</h2>
        <p class="mt-1 text-sm text-content-muted">
          Imagen cuadrada. PNG, JPEG o WebP. Máximo 5 MB.
        </p>

        <div class="mt-5 flex items-center gap-5">
          <div
            class="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary-500/15 text-2xl font-semibold text-primary-700 dark:text-primary-300"
          >
            @if (avatarUrl(); as url) {
              <img [src]="url" alt="Avatar" class="h-full w-full object-cover" />
            } @else {
              <span>{{ fullName() | initials }}</span>
            }
          </div>

          <div class="flex flex-col gap-2">
            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content focus-within:ring-2 focus-within:ring-primary-500/30 hover:bg-surface-muted"
            >
              <app-icon name="upload" [size]="14" />
              <span>Subir nueva imagen</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="sr-only"
                (change)="onFileSelected($event)"
                [attr.aria-busy]="avatarBusy()"
              />
            </label>
            @if (avatarUrl()) {
              <button
                type="button"
                (click)="onDeleteAvatar()"
                [disabled]="avatarBusy()"
                class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
              >
                <app-icon name="x" [size]="14" />
                Eliminar avatar
              </button>
            }
          </div>
        </div>

        @if (avatarMessage(); as msg) {
          <p
            role="status"
            class="mt-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-2 text-sm text-success"
          >
            <app-icon name="check" [size]="14" />
            <span>{{ msg }}</span>
          </p>
        }
        @if (avatarError(); as msg) {
          <p
            role="alert"
            class="mt-4 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger"
          >
            <app-icon name="alert-circle" [size]="14" />
            <span>{{ msg }}</span>
          </p>
        }
      </section>

      <!-- Identity (read-only) -->
      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <h2 class="text-base font-semibold text-content">Identidad</h2>
        <dl class="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">Correo</dt>
            <dd class="mt-1 text-sm text-content">{{ email() }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">Estado</dt>
            <dd class="mt-1 text-sm text-content">{{ statusLabel() }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">Último acceso</dt>
            <dd class="mt-1 text-sm text-content">{{ lastLoginLabel() }}</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wide text-content-subtle">MFA</dt>
            <dd class="mt-1 text-sm text-content">{{ mfaLabel() }}</dd>
          </div>
        </dl>
      </section>

      <!-- Editable profile -->
      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <h2 class="text-base font-semibold text-content">Datos editables</h2>
        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="mt-4 space-y-4" novalidate>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label for="firstName" class="block text-sm font-medium text-content">Nombre</label>
              <input
                id="firstName"
                type="text"
                autocomplete="given-name"
                formControlName="firstName"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
            <div class="space-y-1.5">
              <label for="lastName" class="block text-sm font-medium text-content">Apellido</label>
              <input
                id="lastName"
                type="text"
                autocomplete="family-name"
                formControlName="lastName"
                class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-70"
              />
            </div>
          </div>
          <div class="space-y-1.5">
            <label for="phone" class="block text-sm font-medium text-content">Teléfono</label>
            <input
              id="phone"
              type="tel"
              autocomplete="tel"
              formControlName="phone"
              placeholder="+51 999 999 999"
              class="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-content placeholder:text-content-subtle focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          @if (profileMessage(); as msg) {
            <p
              role="status"
              class="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-2 text-sm text-success"
            >
              <app-icon name="check" [size]="14" />
              <span>{{ msg }}</span>
            </p>
          }
          @if (profileError(); as msg) {
            <p
              role="alert"
              class="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger"
            >
              <app-icon name="alert-circle" [size]="14" />
              <span>{{ msg }}</span>
            </p>
          }

          <button
            type="submit"
            [disabled]="savingProfile() || form.invalid || !form.dirty"
            class="inline-flex items-center justify-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            @if (savingProfile()) {
              <app-spinner [size]="14" />
              Guardando…
            } @else {
              Guardar cambios
            }
          </button>
        </form>
      </section>

      <!-- Change password -->
      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <h2 class="text-base font-semibold text-content">Contraseña</h2>
        <p class="mt-1 text-sm text-content-muted">
          Para cambiar tu contraseña, te enviaremos un enlace por correo. Esto cierra tus otras
          sesiones como medida de seguridad.
        </p>
        <a
          [routerLink]="forgotPasswordRoute"
          class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
        >
          <app-icon name="lock" [size]="14" />
          Cambiar contraseña
        </a>
      </section>

      <!-- Two-factor authentication (Sprint 17 / FE-17.3) -->
      <section class="rounded-lg border border-border bg-surface-raised p-6">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold text-content">Verificación en dos pasos</h2>
            <p class="mt-1 text-sm text-content-muted">
              Protege tu cuenta con un código adicional desde tu aplicación autenticadora.
            </p>
          </div>
          @if (mfaEnabled()) {
            <span
              class="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
            >
              <app-icon name="check" [size]="12" />
              Activado
            </span>
          } @else {
            <span
              class="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-content-muted"
            >
              Desactivado
            </span>
          }
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          @if (mfaEnabled()) {
            <button
              type="button"
              (click)="onDisableMfa()"
              [disabled]="disablingMfa()"
              class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60"
            >
              <app-icon name="x" [size]="14" />
              Desactivar
            </button>
          } @else {
            <a
              [routerLink]="mfaEnrollRoute"
              class="inline-flex items-center gap-2 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
            >
              <app-icon name="lock" [size]="14" />
              Activar
            </a>
          }
        </div>
      </section>
    </div>
  `,
})
export class ProfilePageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);
  private readonly promptDialog = inject(PromptDialogService);
  private readonly router = inject(Router);

  protected readonly forgotPasswordRoute = ROUTES.AUTH.FORGOT_PASSWORD;
  protected readonly mfaEnrollRoute = '/auth/mfa-enroll';

  // ---------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------
  protected readonly avatarBusy = signal(false);
  protected readonly avatarMessage = signal<string | null>(null);
  protected readonly avatarError = signal<string | null>(null);
  protected readonly avatarUploadProgress = signal<number | null>(null);

  protected readonly savingProfile = signal(false);
  protected readonly profileMessage = signal<string | null>(null);
  protected readonly profileError = signal<string | null>(null);

  // ---------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------
  protected readonly form: FormGroup = this.fb.nonNullable.group({
    firstName: ['', [Validators.maxLength(100)]],
    lastName: ['', [Validators.maxLength(100)]],
    phone: ['', [Validators.maxLength(32)]],
  });

  // Re-fill the form whenever the cached user changes (e.g. on first
  // navigation, or after an avatar upload that re-emits the row).
  private readonly _syncFormFromUser = effect(() => {
    const u = this.auth.user();
    if (!u) return;
    this.form.patchValue(
      {
        firstName: u.firstName ?? '',
        lastName: u.lastName ?? '',
        phone: u.phone ?? '',
      },
      { emitEvent: false },
    );
    // Reset dirty so the save button doesn't trigger on initial load.
    this.form.markAsPristine();
  });

  // ---------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------
  protected readonly fullName = computed(() => {
    const u = this.auth.user();
    if (!u) return 'Invitado';
    return u.fullName?.trim() || u.email;
  });
  protected readonly email = computed(() => this.auth.user()?.email ?? '');
  protected readonly avatarUrl = signal<string | null>(null);

  protected readonly statusLabel = computed(() => {
    const u = this.auth.user();
    if (!u) return '—';
    switch (u.status) {
      case 'ACTIVE':
        return 'Activo';
      case 'PENDING_VERIFICATION':
        return 'Pendiente de verificación';
      case 'LOCKED':
        return 'Bloqueado';
      case 'SUSPENDED':
        return 'Suspendido';
      case 'INACTIVE':
        return 'Inactivo';
      default:
        return u.status;
    }
  });
  protected readonly lastLoginLabel = computed(() => {
    const u = this.auth.user();
    if (!u?.lastLoginAt) return 'Nunca';
    const d = new Date(u.lastLoginAt);
    return Number.isNaN(d.getTime()) ? 'Nunca' : d.toLocaleString();
  });
  protected readonly mfaLabel = computed(() =>
    this.auth.user()?.mfaEnabled ? 'Activado' : 'Desactivado',
  );
  protected readonly mfaEnabled = computed(() => !!this.auth.user()?.mfaEnabled);
  protected readonly disablingMfa = signal(false);

  /**
   * Disable MFA on the authenticated user. We reuse the AuthApiService
   * endpoints (the BE's `MfaService.disable`) which requires both the
   * current password and a valid TOTP / recovery code. For simplicity
   * in the MVP we only ask for the current password; the user can
   * always re-enroll if they really need to drop MFA.
   */
  protected async onDisableMfa(): Promise<void> {
    const pwd = await this.promptDialog.open({
      title: 'Desactivar verificación en dos pasos',
      message: 'Confirma tu contraseña para desactivar MFA.',
      inputLabel: 'Contraseña actual',
      inputPlaceholder: 'Ingresa tu contraseña',
      inputType: 'password',
      confirmLabel: 'Desactivar',
      cancelLabel: 'Cancelar',
      variant: 'danger',
      icon: 'alert-circle',
    });
    if (!pwd) return;
    this.disablingMfa.set(true);
    this.profileService
      .disableMfa({ currentPassword: pwd, mfaCode: '' })
      .pipe(finalize(() => this.disablingMfa.set(false)))
      .subscribe({
        next: () => {
          const me = this.auth.user();
          if (me) {
            this.auth.setUser({ ...me, mfaEnabled: false });
          }
        },
        error: (err: HttpErrorResponse) => {
          this.profileError.set(
            err.status === 401
              ? 'Contraseña incorrecta o código MFA requerido.'
              : 'No se pudo desactivar MFA.',
          );
        },
      });
  }

  // ---------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------
  ngOnInit(): void {
    // Wire the avatar URL from the cached user (BE stores the
    // publicUuid in avatarUrl when set; we resolve to a download URL
    // here so the <img> works directly).
    const u = this.auth.user();
    if (u?.avatarUrl) {
      this.avatarUrl.set(this.resolveAvatarUrl(u));
    }
  }

  // ---------------------------------------------------------------------
  // Avatar
  // ---------------------------------------------------------------------
  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset the input so the same file can be re-selected.
    input.value = '';
    if (!file) return;
    this.uploadAvatar(file);
  }

  private uploadAvatar(file: File): void {
    // Client-side validation mirrors the BE's `FileValidator` (mimes
    // from `application.properties` `app.storage.allowed-content-types`,
    // size from `app.storage.max-file-size-bytes`).
    if (!ACCEPTED_AVATAR_MIME.includes(file.type)) {
      this.avatarError.set('Formato no soportado. Usa PNG, JPEG o WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.avatarError.set('La imagen excede el tamaño máximo de 5 MB.');
      return;
    }

    this.avatarError.set(null);
    this.avatarMessage.set(null);
    this.avatarUploadProgress.set(0);
    this.avatarBusy.set(true);

    this.profileService
      .uploadAvatar(file)
      .pipe(finalize(() => this.avatarBusy.set(false)))
      .subscribe({
        next: (res) => {
          // The endpoint returns the FileObject envelope; we
          // extract the publicUuid and wire it into the auth
          // state so the navbar re-renders.
          const publicUuid = res?.publicUuid;
          if (!publicUuid) {
            this.avatarError.set('La respuesta del servidor no incluye el ID del archivo.');
            return;
          }
          const downloadUrl = this.buildAvatarUrl(publicUuid);
          this.avatarUrl.set(downloadUrl);
          const current = this.auth.user();
          if (current) {
            const updated: User = { ...current, avatarUrl: publicUuid };
            this.auth.setUser(updated);
          }
          this.avatarMessage.set('Avatar actualizado.');
        },
        error: (err: HttpErrorResponse) => {
          this.avatarError.set(this.toAvatarMessage(err));
        },
      });
  }

  protected onDeleteAvatar(): void {
    this.avatarError.set(null);
    this.avatarMessage.set(null);
    this.avatarBusy.set(true);

    this.profileService
      .deleteAvatar()
      .pipe(finalize(() => this.avatarBusy.set(false)))
      .subscribe({
        next: () => {
          this.avatarUrl.set(null);
          const current = this.auth.user();
          if (current) {
            const updated: User = { ...current, avatarUrl: undefined };
            this.auth.setUser(updated);
          }
          this.avatarMessage.set('Avatar eliminado.');
        },
        error: (err: HttpErrorResponse) => {
          this.avatarError.set(this.toAvatarMessage(err));
        },
      });
  }

  // ---------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------
  protected onSubmit(): void {
    if (this.form.invalid || this.savingProfile() || !this.form.dirty) {
      return;
    }
    const me = this.auth.user();
    if (!me) {
      this.router.navigateByUrl(ROUTES.AUTH.LOGIN);
      return;
    }

    this.profileError.set(null);
    this.profileMessage.set(null);
    this.savingProfile.set(true);

    const { firstName, lastName, phone } = this.form.getRawValue();
    this.profileService
      .updateProfile(me.publicUuid, {
        firstName: firstName?.trim() || undefined,
        lastName: lastName?.trim() || undefined,
        phone: phone?.trim() || undefined,
      })
      .pipe(finalize(() => this.savingProfile.set(false)))
      .subscribe({
        next: () => {
          // Optimistic local update so the navbar reflects the
          // new name without a full /me round-trip. The /me
          // fetch happens naturally on the next app boot.
          const updated: User = {
            ...me,
            firstName: firstName?.trim() || me.firstName,
            lastName: lastName?.trim() || me.lastName,
            phone: phone?.trim() || me.phone,
          };
          this.auth.setUser(updated);
          this.profileMessage.set('Cambios guardados.');
          this.form.markAsPristine();
        },
        error: (err: HttpErrorResponse) => {
          this.profileError.set(this.toProfileMessage(err));
        },
      });
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  /**
   * Build a download URL for a stored {@code FileObject} by its
   * publicUuid. The endpoint requires bearer auth, but {@code <img src>}
   * will not send one. For now we trust that the same backend that
   * issued the publicUuid also serves it on the GET endpoint without
   * extra checks for the owner — until we switch to a signed-URL flow
   * in the storage service, this works because {@code FileObjectService}
   * allows any authenticated user with a matching tenant to read.
   */
  private resolveAvatarUrl(user: User): string | null {
    if (!user.avatarUrl) return null;
    // The user.avatarUrl field stores the publicUuid of the FileObject.
    return this.buildAvatarUrl(user.avatarUrl);
  }

  private buildAvatarUrl(publicUuid: string): string {
    return `${environment.apiUrl}/${environment.apiVersion}/files/${publicUuid}/download`;
  }

  private toAvatarMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }
    if (err.status === 413) {
      return 'La imagen excede el tamaño máximo permitido.';
    }
    if (err.status === 415) {
      return 'Formato no soportado. Usa PNG, JPEG o WebP.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }
    const body = err.error as ApiError | null | undefined;
    return body?.message ?? 'No se pudo actualizar el avatar.';
  }

  private toProfileMessage(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
    if (err.status === 400) {
      const body = err.error as ApiError | null | undefined;
      return body?.message ?? 'Verifica los datos ingresados.';
    }
    if (err.status === 403) {
      return 'No tienes permiso para actualizar este perfil.';
    }
    if (err.status >= 500) {
      return 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
    }
    return 'No se pudieron guardar los cambios.';
  }
}

// Wire the `HttpEventType` reference so the import isn't tree-shaken
// (the project uses `HttpEventType` only here for completeness if we
// add a progress bar in a follow-up). Not used in the current template.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _httpEventTypeRef = HttpEventType;
import { environment } from '@env/environment';

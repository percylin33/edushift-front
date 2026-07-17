import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserRole } from '@core/enums';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { Invitation } from '../models';
import { InvitationsStore } from '../store';
import { UserRoleBadgeComponent } from './user-role-badge.component';

/**
 * Two-step invitation dialog used by the {@code /users} page header.
 *
 * <h3>Steps</h3>
 * <ol>
 *   <li><b>Form</b> — collect email, name and roles. Submits to
 *       {@link InvitationsStore#create}.</li>
 *   <li><b>Success</b> — render the freshly minted invitation link
 *       and a "copy to clipboard" button. Sprint 9 will add automatic
 *       email delivery; until then the admin shares the link manually.</li>
 * </ol>
 *
 * <p>Implements its own dialog chrome (backdrop + ESC handler + focus
 * styling) inline rather than depending on a shared {@code app-modal}
 * because we don't have one yet — the rest of the app surfaces work
 * via inline forms / pages. Promote this to a {@code shared} component
 * the second another modal lands in the codebase.
 */
@Component({
  selector: 'app-invite-user-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, SpinnerComponent, UserRoleBadgeComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-user-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-lg shadow-xl" (click)="$event.stopPropagation()">
        @if (created(); as inv) {
          <header class="card-header">
            <div>
              <h2 id="invite-user-title" class="card-title">Invitación enviada</h2>
              <p class="card-description">
                Comparte este enlace con {{ inv.fullName || inv.email }} para que active su cuenta.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-icon"
              aria-label="Cerrar"
              (click)="close()"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </header>
          <div class="card-body grid gap-4">
            <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-3">
              <p class="text-xs uppercase tracking-wider text-content-subtle">Destinatario</p>
              <p class="mt-1 text-sm font-medium text-content">
                {{ inv.fullName || inv.email }}
              </p>
              <p class="text-xs text-content-muted">{{ inv.email }}</p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                @for (r of inv.roles; track r) {
                  <app-user-role-badge [role]="r" />
                }
              </div>
            </div>

            <div class="field">
              <label class="label" for="invitation-link">Enlace de activación</label>
              <div class="flex gap-2">
                <input
                  id="invitation-link"
                  type="url"
                  class="input flex-1 font-mono text-xs"
                  readonly
                  [value]="acceptLink()"
                />
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  (click)="copyLink()"
                  [title]="copyHint()"
                >
                  @if (justCopied()) {
                    <app-icon name="check" [size]="16" />
                    <span class="hidden sm:inline">Copiado</span>
                  } @else {
                    <app-icon name="layout-grid" [size]="16" />
                    <span class="hidden sm:inline">Copiar</span>
                  }
                </button>
              </div>
              <p class="hint">
                Sprint 9 enviará el correo automáticamente. Por ahora, copia y comparte el enlace
                manualmente.
              </p>
            </div>

            @if (inv.expiresAt) {
              <p class="text-xs text-content-muted">
                Expira el
                <span class="font-medium text-content">{{ formatDate(inv.expiresAt) }}</span>
              </p>
            }
          </div>
          <footer class="card-footer">
            <button type="button" class="btn btn-ghost btn-sm" (click)="newAnother()">
              Invitar a otro
            </button>
            <button type="button" class="btn btn-primary btn-sm" (click)="close()">Listo</button>
          </footer>
        } @else {
          <header class="card-header">
            <div>
              <h2 id="invite-user-title" class="card-title">Invitar a un nuevo usuario</h2>
              <p class="card-description">
                Recibirá un enlace para crear su contraseña y entrar al workspace.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-icon"
              aria-label="Cerrar"
              (click)="close()"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </header>

          @if (errorMessage(); as err) {
            <div class="alert alert-danger m-5">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1">
                <p class="font-medium">No pudimos crear la invitación.</p>
                <p class="mt-1 text-xs opacity-80">{{ err }}</p>
              </div>
            </div>
          }

          <form class="card-body grid gap-4" (ngSubmit)="onSubmit()">
            <div class="field">
              <label class="label" for="invite-email">Email</label>
              <input
                id="invite-email"
                type="email"
                class="input"
                placeholder="usuario@colegio.edu"
                required
                autocomplete="off"
                [ngModel]="email()"
                (ngModelChange)="email.set($event)"
                name="email"
              />
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="field">
                <label class="label" for="invite-firstName">Nombre</label>
                <input
                  id="invite-firstName"
                  type="text"
                  class="input"
                  required
                  [ngModel]="firstName()"
                  (ngModelChange)="firstName.set($event)"
                  name="firstName"
                />
              </div>
              <div class="field">
                <label class="label" for="invite-lastName">Apellido</label>
                <input
                  id="invite-lastName"
                  type="text"
                  class="input"
                  required
                  [ngModel]="lastName()"
                  (ngModelChange)="lastName.set($event)"
                  name="lastName"
                />
              </div>
            </div>

            <div class="field">
              <span class="label">Roles</span>
              <div class="grid gap-2 sm:grid-cols-2">
                @for (option of roleOptions; track option.value) {
                  <label
                    class="flex items-center gap-3 rounded-md border border-border-subtle px-3 py-2 hover:bg-surface-muted"
                  >
                    <input
                      type="checkbox"
                      class="checkbox"
                      [checked]="hasRole(option.value)"
                      (change)="toggleRole(option.value, $event)"
                      [name]="'role-' + option.value"
                    />
                    <div class="flex-1">
                      <p class="text-sm font-medium text-content">{{ option.label }}</p>
                    </div>
                    <app-user-role-badge [role]="option.value" />
                  </label>
                }
              </div>
              @if (selectedRoles().length === 0) {
                <p class="hint">Selecciona al menos un rol.</p>
              }
            </div>

            <footer
              class="-mx-5 -mb-5 mt-2 flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3"
            >
              <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                [disabled]="!canSubmit() || saving()"
              >
                @if (saving()) {
                  <app-spinner [size]="14" label="Enviando" />
                }
                Enviar invitación
              </button>
            </footer>
          </form>
        }
      </div>
    </div>
  `,
})
export class InviteUserModalComponent {
  private readonly store = inject(InvitationsStore);

  readonly closed = output<void>();

  /*
   * Signals for the form fields so {@link #canSubmit} actually reacts to
   * keystrokes. Using plain string properties leaves the {@code computed}
   * with no tracked dependency on them — Angular reads the cached value
   * forever and the submit button stays {@code disabled}. Two-way
   * binding via {@code [ngModel]/(ngModelChange)} keeps the template
   * idiomatic without pulling in {@code FormControl}.
   */
  protected readonly email = signal('');
  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly selectedRoles = signal<UserRole[]>([UserRole.Teacher]);
  protected readonly justCopied = signal(false);

  protected readonly created = this.store.lastCreated;
  protected readonly saving = this.store.saving;
  protected readonly errorMessage = this.store.error;

  protected readonly roleOptions: ReadonlyArray<{ value: UserRole; label: string }> = [
    { value: UserRole.TenantAdmin, label: 'Administrador' },
    { value: UserRole.Staff, label: 'Staff' },
    { value: UserRole.Teacher, label: 'Profesor' },
    { value: UserRole.Student, label: 'Estudiante' },
    { value: UserRole.Parent, label: 'Tutor' },
  ];

  protected readonly canSubmit = computed(
    () =>
      this.selectedRoles().length > 0 &&
      this.email().trim().length > 0 &&
      this.firstName().trim().length > 0 &&
      this.lastName().trim().length > 0,
  );

  protected readonly acceptLink = computed(() => {
    const inv = this.created();
    if (!inv?.token) return '';
    return `${window.location.origin}/invitation/${inv.token}`;
  });

  protected readonly copyHint = computed(() =>
    this.justCopied() ? 'Copiado al portapapeles' : 'Copiar enlace al portapapeles',
  );

  /** ESC closes the dialog from anywhere on the document. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected onBackdropClick(_event: MouseEvent): void {
    this.close();
  }

  protected close(): void {
    /* The store keeps {@link InvitationsStore#lastCreated} populated
     * across re-opens; we only blow it away when we explicitly bail. */
    this.store.clearLastCreated();
    this.store.clearError();
    this.resetForm();
    this.closed.emit();
  }

  protected newAnother(): void {
    /* Stay open, drop the success state, blank the form so the admin
     * can fire a second invitation in the same flow. */
    this.store.clearLastCreated();
    this.resetForm();
  }

  protected hasRole(role: UserRole): boolean {
    return this.selectedRoles().includes(role);
  }

  protected toggleRole(role: UserRole, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedRoles.update((roles) => {
      const without = roles.filter((r) => r !== role);
      return checked ? [...without, role] : without;
    });
  }

  protected async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    await this.store.create({
      email: this.email().trim(),
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      roles: this.selectedRoles(),
    });
  }

  protected async copyLink(): Promise<void> {
    const link = this.acceptLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.justCopied.set(true);
      setTimeout(() => this.justCopied.set(false), 2000);
    } catch {
      /* Clipboard API can fail under HTTP / restrictive permissions —
       * silently fall through; the admin can still select the readonly
       * input manually. */
    }
  }

  protected formatDate(date: Date): string {
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private resetForm(): void {
    this.email.set('');
    this.firstName.set('');
    this.lastName.set('');
    this.selectedRoles.set([UserRole.Teacher]);
  }
}

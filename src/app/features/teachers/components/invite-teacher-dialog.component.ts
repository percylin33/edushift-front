import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { TeachersStore } from '../store';
import { TeacherDetail, TeacherInvitationResult } from '../models';

/**
 * Dialog del flow "Invitar al sistema" para un docente que aún no
 * tiene cuenta. Mismo two-step que {@code InviteUserModalComponent}:
 *
 * <ol>
 *   <li><b>Confirm</b> — explica qué hace el botón y muestra el email
 *       al que se va a mandar la invitación. El admin confirma.</li>
 *   <li><b>Success</b> — aparece el link copiable
 *       ({@code /invitation/:token}) y la fecha de expiración. El
 *       admin lo comparte manualmente hasta que Sprint 9 wirea el
 *       envío automático por email.</li>
 * </ol>
 *
 * <p>El BE puede rechazar con 422
 * {@code TEACHER_NEEDS_EMAIL_TO_INVITE} si el docente no tiene email
 * registrado — el dialog deshabilita el botón "Invitar" y muestra
 * una pista cuando esto pasa, anticipando el rechazo.</p>
 */
@Component({
  selector: 'app-invite-teacher-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-teacher-title"
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-lg shadow-xl" (click)="$event.stopPropagation()">
        @if (lastInvitation(); as inv) {
          <header class="card-header">
            <div>
              <h2 id="invite-teacher-title" class="card-title">Invitación enviada</h2>
              <p class="card-description">
                Comparte este enlace con
                <strong>{{ teacher().fullName }}</strong>
                para que active su cuenta de docente.
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
              <p class="text-xs uppercase tracking-wider text-content-subtle">
                Destinatario
              </p>
              <p class="mt-1 text-sm font-medium text-content">
                {{ teacher().fullName }}
              </p>
              <p class="text-xs text-content-muted">{{ inv.email }}</p>
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
                Sprint 9 enviará el correo automáticamente. Por ahora,
                copia y comparte el enlace manualmente.
              </p>
            </div>

            @if (inv.expiresAt) {
              <p class="text-xs text-content-muted">
                Expira el
                <span class="font-medium text-content">
                  {{ formatDate(inv.expiresAt) }}
                </span>
              </p>
            }
          </div>

          <footer class="card-footer">
            <button type="button" class="btn btn-primary btn-sm" (click)="close()">
              Listo
            </button>
          </footer>
        } @else {
          <header class="card-header">
            <div>
              <h2 id="invite-teacher-title" class="card-title">Invitar al sistema</h2>
              <p class="card-description">
                Generaremos un enlace para que <strong>{{ teacher().fullName }}</strong>
                cree su contraseña y active su cuenta de docente.
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

          @if (!hasEmail()) {
            <div class="alert alert-warning m-5">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1">
                <p class="font-medium">Falta el email del docente</p>
                <p class="mt-1 text-xs opacity-80">
                  Edita su perfil y agrega un email antes de invitarlo.
                </p>
              </div>
            </div>
          }

          <div class="card-body grid gap-3">
            <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-3">
              <p class="text-xs uppercase tracking-wider text-content-subtle">
                Email destino
              </p>
              <p class="mt-1 font-mono text-sm text-content">
                {{ teacher().email ?? 'No configurado' }}
              </p>
            </div>
            <p class="text-xs text-content-muted">
              Al confirmar, se creará una invitación con rol
              <strong>Profesor</strong> que vincula automáticamente al docente
              cuando el destinatario acepte.
            </p>
          </div>

          <footer class="card-footer">
            <button type="button" class="btn btn-ghost btn-sm" (click)="close()">
              Cancelar
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="!hasEmail() || inviting()"
              (click)="onConfirm()"
            >
              @if (inviting()) {
                <app-spinner [size]="14" label="Generando" />
              }
              Generar invitación
            </button>
          </footer>
        }
      </div>
    </div>
  `
})
export class InviteTeacherDialogComponent {
  private readonly store = inject(TeachersStore);

  readonly teacher = input.required<TeacherDetail>();

  readonly closed = output<void>();
  /** Emitido cuando el back devuelve la invitación creada. */
  readonly invited = output<TeacherInvitationResult>();

  protected readonly lastInvitation = this.store.lastInvitation;
  protected readonly inviting = this.store.inviting;
  protected readonly errorMessage = this.store.error;

  protected readonly justCopied = signal<boolean>(false);

  protected readonly hasEmail = computed(() => !!this.teacher().email);

  protected readonly acceptLink = computed(() => {
    const inv = this.lastInvitation();
    if (!inv) return '';
    return `${window.location.origin}/invitation/${inv.invitationToken}`;
  });

  protected readonly copyHint = computed(() =>
    this.justCopied() ? 'Copiado al portapapeles' : 'Copiar enlace al portapapeles'
  );

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected close(): void {
    this.store.clearLastInvitation();
    this.store.clearError();
    this.justCopied.set(false);
    this.closed.emit();
  }

  protected async onConfirm(): Promise<void> {
    if (!this.hasEmail() || this.inviting()) return;
    const result = await this.store.invite(this.teacher().publicUuid);
    if (result) this.invited.emit(result);
  }

  protected async copyLink(): Promise<void> {
    const link = this.acceptLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.justCopied.set(true);
      setTimeout(() => this.justCopied.set(false), 2000);
    }
    catch {
      /* Clipboard API puede fallar bajo HTTP / permisos restrictivos
       * — el admin todavía puede seleccionar y copiar manualmente. */
    }
  }

  protected formatDate(date: Date): string {
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

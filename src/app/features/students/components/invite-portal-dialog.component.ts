import { SafeBackdropDirective } from '@shared/directives/safe-backdrop.directive';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { TenantService } from '@core/services';
import { schoolInvitationAcceptUrl } from '@core/navigation/school-login.navigation';
import { StudentsStore } from '../store/students.store';
import { PortalInvitationResult } from '../models';

/**
 * Confirm + copy-link dialog for student / guardian portal activation.
 * Clones the teacher invite modal: SMTP off still returns the token once.
 */
@Component({
  selector: 'app-invite-portal-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SafeBackdropDirective, CommonModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-portal-title"
      appSafeBackdrop (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-lg shadow-xl" (click)="$event.stopPropagation()">
        @if (lastInvitation(); as inv) {
          <header class="card-header">
            <div>
              <h2 id="invite-portal-title" class="card-title">Invitación lista</h2>
              <p class="card-description">
                Comparte este enlace con
                <strong>{{ personName() }}</strong>
                para que active su cuenta de {{ audienceLabel() }}.
              </p>
            </div>
            <button type="button" class="btn btn-ghost btn-icon" aria-label="Cerrar" (click)="close()">
              <app-icon name="x" [size]="18" />
            </button>
          </header>

          <div class="card-body grid gap-4">
            <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-3">
              <p class="text-xs uppercase tracking-wider text-content-subtle">Destinatario</p>
              <p class="mt-1 text-sm font-medium text-content">{{ personName() }}</p>
              <p class="text-xs text-content-muted">{{ inv.email }}</p>
            </div>

            <div class="field">
              <label class="label" for="portal-invitation-link">Enlace de activación</label>
              <div class="flex gap-2">
                <input
                  id="portal-invitation-link"
                  type="url"
                  class="input flex-1 font-mono text-xs"
                  readonly
                  [value]="acceptLink()"
                />
                <button type="button" class="btn btn-outline btn-sm" (click)="copyLink()">
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
                También enviamos el enlace por correo. Si no llega, copia y comparte este link.
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
            <button type="button" class="btn btn-primary btn-sm" (click)="close()">Listo</button>
          </footer>
        } @else {
          <header class="card-header">
            <div>
              <h2 id="invite-portal-title" class="card-title">
                {{ resend() ? 'Reenviar invitación' : 'Activar portal' }}
              </h2>
              <p class="card-description">
                {{ resend()
                  ? 'Generaremos un enlace nuevo y lo enviaremos de nuevo.'
                  : 'Generaremos un enlace para que cree su contraseña. Secretaría nunca ve ni escribe claves.' }}
              </p>
            </div>
            <button type="button" class="btn btn-ghost btn-icon" aria-label="Cerrar" (click)="close()">
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
                <p class="font-medium">Falta el email</p>
                <p class="mt-1 text-xs opacity-80">
                  Edita el perfil y agrega un email antes de activar el portal.
                </p>
              </div>
            </div>
          }

          <div class="card-body grid gap-3">
            <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-3">
              <p class="text-xs uppercase tracking-wider text-content-subtle">Email destino</p>
              <p class="mt-1 font-mono text-sm text-content">{{ email() ?? 'No configurado' }}</p>
            </div>
          </div>

          <footer class="card-footer">
            <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="!hasEmail() || inviting()"
              (click)="onConfirm()"
            >
              @if (inviting()) {
                <app-spinner [size]="14" label="Generando" />
              }
              {{ resend() ? 'Reenviar' : 'Generar invitación' }}
            </button>
          </footer>
        }
      </div>
    </div>
  `,
})
export class InvitePortalDialogComponent {
  private readonly store = inject(StudentsStore);
  private readonly tenant = inject(TenantService);

  readonly personName = input.required<string>();
  readonly email = input<string | undefined>();
  readonly audience = input<'estudiante' | 'tutor'>('estudiante');
  readonly studentPublicUuid = input.required<string>();
  readonly guardianPublicUuid = input<string | undefined>();
  readonly invitationPublicUuid = input<string | undefined>();

  readonly closed = output<void>();
  readonly invited = output<PortalInvitationResult>();

  protected readonly lastInvitation = this.store.lastPortalInvitation;
  protected readonly inviting = this.store.invitingPortal;
  protected readonly errorMessage = this.store.error;
  protected readonly justCopied = signal(false);

  protected readonly hasEmail = computed(() => !!this.email());
  protected readonly resend = computed(() => !!this.invitationPublicUuid());
  protected readonly audienceLabel = computed(() =>
    this.audience() === 'tutor' ? 'familia' : 'estudiante',
  );

  protected readonly acceptLink = computed(() => {
    const inv = this.lastInvitation();
    if (!inv) return '';
    return schoolInvitationAcceptUrl(
      window.location.origin,
      inv.invitationToken,
      this.tenant.tenantSlug(),
    );
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected close(): void {
    this.store.clearLastPortalInvitation();
    this.store.clearError();
    this.justCopied.set(false);
    this.closed.emit();
  }

  protected async onConfirm(): Promise<void> {
    if (!this.hasEmail() || this.inviting()) return;
    let result: PortalInvitationResult | null = null;
    const resendId = this.invitationPublicUuid();
    const guardianId = this.guardianPublicUuid();
    if (resendId) {
      result = await this.store.resendInvitation(resendId, this.studentPublicUuid());
    } else if (guardianId) {
      result = await this.store.inviteGuardian(this.studentPublicUuid(), guardianId);
    } else {
      result = await this.store.inviteStudent(this.studentPublicUuid());
    }
    if (result) this.invited.emit(result);
  }

  protected async copyLink(): Promise<void> {
    const link = this.acceptLink();
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      this.justCopied.set(true);
      setTimeout(() => this.justCopied.set(false), 2000);
    } catch {
      /* clipboard may fail under HTTP */
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
}

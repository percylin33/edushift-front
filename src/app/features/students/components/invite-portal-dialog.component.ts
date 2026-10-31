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
      appSafeBackdrop
      (click)="onBackdropClick($event)"
    >
      <div class="card w-full max-w-lg shadow-xl" (click)="$event.stopPropagation()">
        @if (invitationLinks().length) {
          <header class="card-header">
            <div>
              <h2 id="invite-portal-title" class="card-title">Invitación lista</h2>
              <p class="card-description">
                Copia el mensaje para WhatsApp o imprime la bienvenida para la familia.
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
            @for (inv of invitationLinks(); track inv.email) {
              <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-3">
                <p class="text-xs uppercase tracking-wider text-content-subtle">{{ inv.label }}</p>
                <p class="mt-1 text-sm font-medium text-content">{{ inv.personName }}</p>
                <p class="text-xs text-content-muted">{{ inv.email }}</p>
                <div class="mt-2 flex gap-2">
                  <input
                    type="url"
                    class="input min-w-0 flex-1 font-mono text-xs"
                    readonly
                    [value]="inv.url"
                  />
                  <button type="button" class="btn btn-outline btn-sm" (click)="copyLink(inv.url)">
                    {{ copiedLink() === inv.url ? 'Copiado' : 'Copiar enlace' }}
                  </button>
                </div>
                @if (inv.expiresAt) {
                  <p class="mt-1 text-xs text-content-muted">
                    Expira el {{ formatDate(inv.expiresAt) }}
                  </p>
                }
              </div>
            }

            <div class="field">
              <label class="label" for="portal-whatsapp-message">Mensaje listo para WhatsApp</label>
              <textarea
                id="portal-whatsapp-message"
                class="input min-h-40 w-full text-sm"
                readonly
                [value]="whatsappMessage()"
              ></textarea>
              <p class="hint">Incluye los enlaces para activar las cuentas pendientes.</p>
              @if (hasLocalOnlyLink()) {
                <p class="alert alert-warning mt-2 text-sm">
                  Esta dirección es local y solo funciona en esta computadora. Para compartirla con
                  la familia, abre la ficha desde una dirección pública del colegio o un túnel
                  accesible desde sus teléfonos.
                </p>
              }
            </div>
            @if (invitationError()) {
              <div class="alert alert-warning text-sm">{{ invitationError() }}</div>
            }
            @if (printError()) {
              <p class="text-sm text-danger">{{ printError() }}</p>
            }
          </div>

          <footer class="card-footer flex-wrap gap-2">
            <button type="button" class="btn btn-outline btn-sm" (click)="printWelcome()">
              <app-icon name="printer" [size]="16" /> Imprimir bienvenida
            </button>
            <button type="button" class="btn btn-primary btn-sm" (click)="copyWhatsappMessage()">
              @if (justCopied()) {
                Copiado
              } @else {
                Copiar para WhatsApp
              }
            </button>
            <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Listo</button>
          </footer>
        } @else {
          <header class="card-header">
            <div>
              <h2 id="invite-portal-title" class="card-title">
                {{ resend() ? 'Reenviar invitación' : 'Activar portal' }}
              </h2>
              <p class="card-description">
                {{
                  resend()
                    ? 'Generaremos un enlace nuevo y lo enviaremos de nuevo.'
                    : studentAndGuardian()
                      ? studentAlreadyActive()
                        ? 'Solo prepararemos el acceso pendiente del tutor principal.'
                        : 'Prepararemos los accesos pendientes del estudiante y su tutor principal.'
                      : 'Generaremos un enlace para que cree su contraseña. Secretaría nunca ve ni escribe claves.'
                }}
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

          @if (studentAndGuardian()) {
            <div class="card-body grid gap-2 pt-0">
              <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-3">
                <p class="text-xs uppercase tracking-wider text-content-subtle">
                  Accesos pendientes
                </p>
                @if (!studentAlreadyActive()) {
                  <p class="mt-2 text-sm font-medium text-content">
                    Estudiante · {{ studentName() || personName() }}
                  </p>
                  <p class="text-xs text-content-muted">
                    {{ email() || 'Se generará un usuario para ingresar' }}
                  </p>
                }
                @if (additionalGuardian(); as guardian) {
                  <p class="mt-2 text-sm font-medium text-content">
                    Tutor principal · {{ guardian.fullName }}
                  </p>
                  <p class="text-xs text-content-muted">
                    {{ guardian.email || 'Se generará un usuario para ingresar' }}
                  </p>
                }
              </div>
            </div>
          } @else {
            <div class="card-body grid gap-3">
              <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-3">
                <p class="text-xs uppercase tracking-wider text-content-subtle">
                  {{ isSyntheticAddress(email()) ? 'Usuario institucional' : 'Correo de acceso' }}
                </p>
                <p class="mt-1 break-all font-mono text-sm text-content">
                  {{ email() ?? 'Se generará al activar el portal' }}
                </p>
              </div>
            </div>
          }

          @if (hasSyntheticPendingAccount()) {
            <div class="alert alert-warning m-5">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1">
                <p class="font-medium">Entrega manual del enlace</p>
                <p class="mt-1 text-xs opacity-80">
                  Al menos una cuenta usa un usuario ficticio que no recibe mensajes. Comparte el
                  enlace de bienvenida directamente con la familia.
                </p>
              </div>
            </div>
          }

          <footer class="card-footer">
            <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="inviting()"
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
  readonly studentAndGuardian = input(false);
  readonly studentAlreadyActive = input(false);
  readonly studentName = input<string | undefined>();
  readonly additionalGuardian = input<{
    fullName: string;
    email?: string;
    guardianPublicUuid: string;
    userId?: string;
    pendingInvitationPublicUuid?: string;
  } | null>(null);

  readonly closed = output<void>();
  readonly invited = output<PortalInvitationResult>();

  protected readonly inviting = this.store.invitingPortal;
  protected readonly errorMessage = this.store.error;
  protected readonly justCopied = signal(false);
  protected readonly copiedLink = signal<string | null>(null);
  protected readonly invitationLinks = signal<
    Array<{
      label: string;
      personName: string;
      email: string;
      url: string;
      expiresAt?: Date;
    }>
  >([]);
  protected readonly printError = signal<string | null>(null);
  protected readonly invitationError = signal<string | null>(null);

  protected readonly whatsappMessage = computed(() => {
    const links = this.invitationLinks();
    const schoolName = this.tenant.tenant()?.name?.trim() || 'el colegio';
    const greeting = `¡Hola, familia! 👋

Les damos la bienvenida a *${schoolName}*.`;
    const instruction =
      links.length > 1
        ? 'Cada persona debe abrir el enlace que le corresponde y crear una contraseña personal:'
        : 'Abre este enlace y crea una contraseña personal para ingresar al portal.';
    const accessLines = links.map((link) => {
      const audience = link.label.replace('Acceso del ', '');
      const icon = audience === 'estudiante' ? '🎒' : '👨‍👩‍👧';
      const expiry = link.expiresAt ? `\nVálido hasta: ${this.formatDate(link.expiresAt)}` : '';
      return `${icon} *Portal del ${audience}*
${link.url}${expiry}`;
    });
    const closing =
      'Guarden este mensaje para consultar los enlaces cuando los necesiten. Si necesitan ayuda, escriban a secretaría.';
    return [greeting, instruction, ...accessLines, closing].join('\n\n');
  });

  protected readonly hasLocalOnlyLink = computed(() =>
    this.invitationLinks().some((link) => {
      try {
        const hostname = new URL(link.url).hostname.toLowerCase();
        return (
          hostname === 'localhost' ||
          hostname.endsWith('.localhost') ||
          hostname === '127.0.0.1' ||
          hostname === '::1'
        );
      } catch {
        return true;
      }
    }),
  );
  protected readonly resend = computed(() => !!this.invitationPublicUuid());
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
    this.copiedLink.set(null);
    this.invitationLinks.set([]);
    this.printError.set(null);
    this.invitationError.set(null);
    this.closed.emit();
  }

  protected async onConfirm(): Promise<void> {
    if (this.inviting()) return;
    const links: Array<{
      label: string;
      personName: string;
      email: string;
      url: string;
      expiresAt?: Date;
    }> = [];
    const failures: string[] = [];
    this.invitationError.set(null);
    let latestResult: PortalInvitationResult | null = null;
    const addInvitation = (
      label: string,
      personName: string,
      result: PortalInvitationResult | null,
    ): void => {
      if (!result) return;
      latestResult = result;
      links.push({
        label,
        personName,
        email: result.email,
        url: schoolInvitationAcceptUrl(
          window.location.origin,
          result.invitationToken,
          this.tenant.tenantSlug(),
        ),
        expiresAt: result.expiresAt,
      });
    };

    if (this.studentAndGuardian()) {
      if (!this.studentAlreadyActive()) {
        const studentResult = this.invitationPublicUuid()
          ? await this.store.resendInvitation(
              this.invitationPublicUuid()!,
              this.studentPublicUuid(),
            )
          : await this.store.inviteStudent(this.studentPublicUuid());
        addInvitation(
          'Acceso del estudiante',
          this.studentName() || this.personName(),
          studentResult,
        );
        if (!studentResult)
          failures.push(this.errorMessage() || 'No se pudo preparar el acceso del estudiante.');
      }
      const guardian = this.additionalGuardian();
      if (guardian && !guardian.userId) {
        const guardianResult = guardian.pendingInvitationPublicUuid
          ? await this.store.resendInvitation(
              guardian.pendingInvitationPublicUuid,
              this.studentPublicUuid(),
            )
          : await this.store.inviteGuardian(this.studentPublicUuid(), guardian.guardianPublicUuid);
        addInvitation('Acceso del tutor', guardian.fullName, guardianResult);
        if (!guardianResult)
          failures.push(this.errorMessage() || 'No se pudo preparar el acceso del tutor.');
      }
    } else {
      const resendId = this.invitationPublicUuid();
      const guardianId = this.guardianPublicUuid();
      const result = resendId
        ? await this.store.resendInvitation(resendId, this.studentPublicUuid())
        : guardianId
          ? await this.store.inviteGuardian(this.studentPublicUuid(), guardianId)
          : await this.store.inviteStudent(this.studentPublicUuid());
      addInvitation(
        this.audience() === 'tutor' ? 'Acceso del tutor' : 'Acceso del estudiante',
        this.personName(),
        result,
      );
      if (!result) failures.push(this.errorMessage() || 'No se pudo preparar la invitación.');
    }

    if (failures.length) {
      this.invitationError.set(
        `${failures.join(' ')} Puedes volver a intentarlo desde la ficha del estudiante.`,
      );
    }
    if (links.length) {
      this.invitationLinks.set(links);
      if (latestResult) this.invited.emit(latestResult);
    }
  }

  protected async copyWhatsappMessage(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.whatsappMessage());
      this.copiedLink.set(null);
      this.justCopied.set(true);
      setTimeout(() => this.justCopied.set(false), 2000);
    } catch {
      this.printError.set('No se pudo copiar automáticamente. Selecciona el texto y cópialo.');
    }
  }

  protected async copyLink(link: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(link);
      this.justCopied.set(false);
      this.copiedLink.set(link);
      setTimeout(() => this.copiedLink.set(null), 2000);
    } catch {
      this.printError.set('No se pudo copiar automáticamente. Selecciona el enlace y cópialo.');
    }
  }

  protected printWelcome(): void {
    const printWindow = window.open('about:blank', '_blank');
    if (!printWindow) {
      this.printError.set(
        'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.',
      );
      return;
    }
    printWindow.opener = null;
    const tenant = this.tenant.tenant();
    const rawSettings = tenant?.settings?.['credentialHandout'];
    const settings =
      rawSettings && typeof rawSettings === 'object'
        ? (rawSettings as Record<string, unknown>)
        : {};
    const welcomeTitle = this.stringSetting(
      settings['welcomeTitle'],
      'Acceso a la plataforma del colegio',
    );
    const welcomeBody = this.stringSetting(
      settings['welcomeBody'],
      'EduShift es el portal del colegio: notas, tareas, asistencia y comunicados. Abre tu enlace de acceso y crea una contraseña personal.',
    );
    const supportNote = this.stringSetting(
      settings['supportNote'],
      'Si necesitas ayuda para ingresar, comunícate con secretaría.',
    );
    const supportPhone = this.stringSetting(settings['supportPhone'], '');
    const schoolName = tenant?.name || 'Tu colegio';
    const primaryColor = this.safeCssColor(tenant?.branding?.primaryColor);
    const logoUrl = tenant?.branding?.logo?.light;
    const logo = logoUrl
      ? `<img class="logo" src="${this.escapeHtml(logoUrl)}" alt="Logo de ${this.escapeHtml(schoolName)}">`
      : '';
    const links = this.invitationLinks()
      .map(
        (item) => `
      <section class="access">
        <div class="label">${this.escapeHtml(item.label)}</div>
        <h2>${this.escapeHtml(item.personName)}</h2>
        <p class="email">Usuario: ${this.escapeHtml(item.email)}</p>
        <a href="${this.escapeHtml(item.url)}">Abrir enlace para activar la cuenta</a>
        <p class="url">${this.escapeHtml(item.url)}</p>
        ${item.expiresAt ? `<p class="expiry">Enlace válido hasta: ${this.escapeHtml(this.formatDate(item.expiresAt))}</p>` : ''}
      </section>`,
      )
      .join('');
    printWindow.document
      .write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${this.escapeHtml(welcomeTitle)}</title>
      <style>
        :root{--school:${this.escapeHtml(primaryColor)}}*{box-sizing:border-box}body{font:16px Arial,sans-serif;color:#172033;margin:0;background:#eef2f7}
        main{width:780px;max-width:100%;margin:28px auto;background:white;padding:38px;border-radius:16px;border-top:10px solid var(--school)}
        header{border-bottom:1px solid #dce3ec;padding-bottom:20px;margin-bottom:24px}header small,.label{color:var(--school);font-weight:bold;text-transform:uppercase;letter-spacing:.08em;font-size:12px}.logo{max-width:120px;max-height:56px;object-fit:contain;margin-bottom:14px}
        h1{font-size:28px;margin:10px 0}header p{line-height:1.6;color:#506078;white-space:pre-line}.access{border:1px solid #dce3ec;border-radius:12px;padding:20px;margin:14px 0;break-inside:avoid}
        .label{font-size:11px}.email{color:#506078}.access a{display:inline-block;color:var(--school);font-weight:bold;margin:8px 0}.url{font-size:12px;word-break:break-all;color:#506078}.expiry{font-size:12px;color:#506078}
        footer{margin-top:28px;border-top:1px solid #dce3ec;padding-top:18px;color:#506078;line-height:1.5}.button{background:var(--school);color:white;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block}
        @media print{body{background:#fff}main{width:auto;margin:0;border-radius:0;padding:20mm;border-top-width:8px}.no-print{display:none}}
      </style></head><body><main><header>${logo}<small>${this.escapeHtml(schoolName)}</small><h1>${this.escapeHtml(welcomeTitle)}</h1><p>${this.escapeHtml(welcomeBody)}</p></header>
      <p>¡Bienvenidos! Comparte esta hoja con la familia y usa cada enlace para activar la cuenta correspondiente.</p>${links}
      <footer>${this.escapeHtml(supportNote)}${supportPhone ? `<br>Contacto del colegio: ${this.escapeHtml(supportPhone)}` : ''}</footer>
      <p class="no-print"><a class="button" href="#" onclick="window.print();return false">Imprimir o guardar como PDF</a></p></main></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    this.printError.set(null);
  }

  private stringSetting(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (char) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
    );
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

  protected isSyntheticAddress(email?: string): boolean {
    if (!email) return false;
    const normalized = email.trim().toLowerCase();
    return (
      normalized.endsWith('.accounts.edushift.local') ||
      /^[a-z0-9]+\.[a-z0-9]+\.[a-z0-9]+\.[a-f0-9]{4,8}@[a-z0-9-]+\.com$/.test(normalized)
    );
  }

  protected readonly hasSyntheticPendingAccount = computed(() => {
    const needsSynthetic = (email?: string) => !email || this.isSyntheticAddress(email);
    if (!this.studentAndGuardian()) return needsSynthetic(this.email());
    const studentNeedsSynthetic = !this.studentAlreadyActive() && needsSynthetic(this.email());
    const guardian = this.additionalGuardian();
    const guardianNeedsSynthetic = !!guardian && !guardian.userId && needsSynthetic(guardian.email);
    return studentNeedsSynthetic || guardianNeedsSynthetic;
  });

  private safeCssColor(color: string | undefined): string {
    if (!color || typeof CSS === 'undefined' || !CSS.supports('color', color)) return '#2563eb';
    return color;
  }
}

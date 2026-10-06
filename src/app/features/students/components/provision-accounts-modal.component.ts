import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { ProvisionSectionAccountsResponse } from '../models';
import { SectionProvisionApiService } from '../services';

/**
 * CRED-7 — confirm mass account generation, show summary, download family ZIP / admin xlsx.
 */
@Component({
  selector: 'app-provision-accounts-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, IconComponent, SpinnerComponent],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="card w-full max-w-lg shadow-xl">
        <header class="card-header">
          <div>
            <h2 class="card-title">Generar cuentas del aula</h2>
            <p class="card-description">
              Crea usuarios portal para alumnos y apoderados sin cuenta. Entrega un ZIP con carpeta
              del aula y un PDF por alumno (correo + contraseña temporal).
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            (click)="requestClose()"
            aria-label="Cerrar"
          >
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="card-body space-y-4">
          @if (errorMessage()) {
            <div class="alert alert-danger text-sm">{{ errorMessage() }}</div>
          }

          @if (!result()) {
            <ul class="list-disc space-y-1 pl-5 text-sm text-content-muted">
              <li>Si el padrón trae correo válido, se usa (origen Real).</li>
              <li>Si no, se genera un correo temporal sintético (sin envío de mail).</li>
              <li>La contraseña temporal solo aparece en el ZIP (~20 min).</li>
              <li>En el primer ingreso deberán cambiar la contraseña.</li>
              <li>
                No se reimprimen claves de cuentas ya activas (alumnos u apoderados omitidos).
              </li>
            </ul>
            <p class="text-xs text-content-muted">
              La hoja familiar incluye siempre al tutor primario vinculado (recomendado para entrega
              en secretaría).
            </p>
            <label class="flex items-center gap-2 text-sm text-content">
              <input
                type="checkbox"
                class="checkbox"
                [checked]="includeGuardians()"
                (change)="toggleGuardians($event)"
              />
              Incluir apoderados vinculados
            </label>
          } @else {
            <div class="grid grid-cols-2 gap-3 text-center text-sm">
              <div class="rounded-md border border-border-subtle p-3">
                <p class="text-2xs uppercase text-content-subtle">Alumnos nuevos</p>
                <p class="text-xl font-semibold">{{ result()!.studentsProvisioned }}</p>
              </div>
              <div class="rounded-md border border-border-subtle p-3">
                <p class="text-2xs uppercase text-content-subtle">Apoderados nuevos</p>
                <p class="text-xl font-semibold">{{ result()!.guardiansProvisioned }}</p>
              </div>
              <div class="rounded-md border border-border-subtle p-3">
                <p class="text-2xs uppercase text-content-subtle">Correos reales</p>
                <p class="text-xl font-semibold">{{ result()!.realEmails }}</p>
              </div>
              <div class="rounded-md border border-border-subtle p-3">
                <p class="text-2xs uppercase text-content-subtle">Sintéticos</p>
                <p class="text-xl font-semibold">{{ result()!.syntheticEmails }}</p>
              </div>
            </div>
            @if (result()!.skippedAlreadyLinked > 0) {
              <p class="text-xs text-content-muted">
                Ya tenían cuenta:
                {{ result()!.skippedAlreadyLinked }} alumno(s). Aparecen en la hoja como «cuenta
                existente» (sin contraseña nueva). No se reimprimen claves de cuentas ya activas.
              </p>
            }
            <p class="text-xs text-content-muted">
              Sección: <strong>{{ result()!.sectionName }}</strong>
            </p>
            @if (!handoutDownloaded()) {
              <div class="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-content">
                <strong>Importante:</strong> descarga ahora la carpeta de accesos. Las contraseñas
                temporales solo están disponibles unos ~20 minutos. Si cierras sin descargar, las
                cuentas quedan creadas pero <strong>no podrás volver a ver esas claves</strong> (habría
                que reemitir en secretaría).
              </div>
            } @else {
              <p class="text-xs text-success">
                ZIP descargado. Puedes cerrar el modal con seguridad.
              </p>
            }
            <a
              routerLink="/settings/tenant"
              class="text-xs font-medium text-primary-600 hover:underline"
              (click)="requestClose()"
            >
              Personalizar textos de la hoja
            </a>
          }
        </div>

        <footer class="card-footer flex-wrap gap-2">
          <button type="button" class="btn btn-ghost btn-sm" (click)="requestClose()">
            {{ result() ? 'Cerrar' : 'Cancelar' }}
          </button>
          @if (!result()) {
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="busy()"
              (click)="runProvision()"
            >
              @if (busy()) {
                <app-spinner [size]="14" />
              }
              Generar cuentas
            </button>
          } @else {
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              [disabled]="busy()"
              (click)="downloadSheet()"
            >
              Export Excel (admin)
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              [disabled]="busy()"
              (click)="downloadHandout()"
            >
              @if (busy()) {
                <app-spinner [size]="14" />
              }
              Descargar carpeta de accesos (ZIP)
            </button>
          }
        </footer>
      </div>
    </div>
  `,
})
export class ProvisionAccountsModalComponent implements OnInit {
  private readonly api = inject(SectionProvisionApiService);

  readonly sectionPublicUuid = input.required<string>();
  readonly closed = output<void>();
  readonly completed = output<ProvisionSectionAccountsResponse>();

  protected readonly includeGuardians = signal(true);
  protected readonly busy = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly result = signal<ProvisionSectionAccountsResponse | null>(null);
  protected readonly handoutDownloaded = signal(false);

  ngOnInit(): void {
    // no-op
  }

  protected toggleGuardians(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    this.includeGuardians.set(!!target?.checked);
  }

  protected requestClose(): void {
    if (this.result() && !this.handoutDownloaded()) {
      const ok = window.confirm(
        'Aún no descargaste la carpeta de accesos (ZIP).\n\n' +
          'Las cuentas ya están creadas, pero las contraseñas temporales solo se pueden ' +
          'descargar unos ~20 minutos. Si cierras ahora, no podrás ver esas claves otra vez.\n\n' +
          '¿Cerrar de todos modos?',
      );
      if (!ok) return;
    }
    this.closed.emit();
  }

  protected async runProvision(): Promise<void> {
    this.busy.set(true);
    this.errorMessage.set(null);
    this.handoutDownloaded.set(false);
    try {
      const res = await firstValueFrom(
        this.api.provision(this.sectionPublicUuid(), {
          includeGuardians: this.includeGuardians(),
          overwriteMissingEmailWithSynthetic: true,
        }),
      );
      this.result.set(res);
      this.completed.emit(res);
      // Best-effort: start ZIP download immediately so closing the modal is safer.
      this.busy.set(false);
      await this.downloadHandout();
    } catch {
      this.errorMessage.set('No se pudieron generar las cuentas. Revisa permisos e inténtalo de nuevo.');
      this.busy.set(false);
    }
  }

  protected async downloadHandout(): Promise<void> {
    const jobId = this.result()?.jobPublicUuid;
    if (!jobId) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const blob = await firstValueFrom(this.api.downloadHandoutZip(jobId));
      const section = this.result()?.sectionName?.trim() || 'Seccion';
      const safe = section.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
      this.triggerBrowserDownload(blob, `Accesos - ${safe}.zip`);
      this.handoutDownloaded.set(true);
    } catch (err) {
      this.errorMessage.set(this.downloadErrorMessage(err, 'ZIP'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async downloadSheet(): Promise<void> {
    const jobId = this.result()?.jobPublicUuid;
    if (!jobId) return;
    this.busy.set(true);
    this.errorMessage.set(null);
    try {
      const blob = await firstValueFrom(this.api.downloadSheet(jobId));
      this.triggerBrowserDownload(blob, 'cuentas-seccion.xlsx');
    } catch (err) {
      this.errorMessage.set(this.downloadErrorMessage(err, 'Excel'));
    } finally {
      this.busy.set(false);
    }
  }

  private triggerBrowserDownload(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Delay revoke: some browsers cancel the download if revoked immediately.
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  private downloadErrorMessage(err: unknown, kind: string): string {
    if (err instanceof HttpErrorResponse) {
      const msg =
        (err.error && typeof err.error === 'object' && 'message' in err.error
          ? String((err.error as { message?: string }).message)
          : null) || err.statusText;
      if (err.status === 404) {
        return `El ${kind} expiró o el job ya no existe (~20 min). Vuelve a generar cuentas (solo cuentas nuevas tendrán clave nueva).`;
      }
      if (msg && msg !== 'OK') {
        return `No se pudo descargar el ${kind}: ${msg}`;
      }
      return `No se pudo descargar el ${kind} (HTTP ${err.status}).`;
    }
    return `No se pudo descargar el ${kind}. Inténtalo de nuevo.`;
  }
}

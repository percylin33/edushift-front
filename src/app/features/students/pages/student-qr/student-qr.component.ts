import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { UserRole } from '@core/enums';
import { AuthService, NotificationService, TenantService } from '@core/services';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent
} from '@shared/components';
import { AttendanceApiService } from '@features/attendance/services';
import { AttendanceQrInfo } from '@features/attendance/models';
import { StudentsApiService } from '../../services';
import { StudentDetail } from '../../models';

/**
 * Page `/students/:id/qr` — generate, preview and rotate the alumno's
 * printable attendance credential (FE-6.3).
 *
 * <h3>Why we keep `getQrInfo` and `downloadQr` separate</h3>
 * The backend's {@code GET /students/{id}/attendance-qr} mints a
 * fresh JWT and revokes the previous one on every call (see
 * {@code AttendanceQrController}'s docstring). Calling that just to
 * paint a preview would silently rotate the alumno's credential
 * every time someone visits this page — disastrous if a docente already
 * has the printed copy in hand. This page therefore:
 *
 * <ol>
 *   <li>On mount calls {@link AttendanceApiService#getQrInfo} (read-only)
 *       to learn whether a credential already exists, and when it was
 *       issued.</li>
 *   <li>The actual {@code GET /attendance-qr} call only fires when the
 *       user explicitly clicks "Generar credencial" or "Reimprimir".
 *       Both buttons immediately download the file <em>and</em> show
 *       it inline so the admin can verify before printing.</li>
 *   <li>"Rotar credencial" is a deliberate admin-only action that
 *       calls {@code POST /attendance-qr/rotate} (audit-distinguishable
 *       from the implicit reissue) and refreshes the metadata.</li>
 * </ol>
 */
@Component({
  selector: 'app-student-qr-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    SpinnerComponent,
    EmptyStateComponent
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Credencial de asistencia"
        [subtitle]="student()?.fullName ?? 'Cargando…'"
      >
        <a [routerLink]="backRoute" class="btn btn-ghost btn-sm">
          <app-icon name="arrow-left" [size]="16" />
          <span class="hidden sm:inline">Volver</span>
        </a>
      </app-page-header>

      @if (loading() && !student()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando credencial…" />
        </div>
      } @else if (loadError()) {
        <div class="alert alert-danger">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar la credencial.</p>
            <p class="mt-1 text-xs opacity-80">{{ loadError() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="reload()">
            Reintentar
          </button>
        </div>
      } @else {
        <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
          <!-- Left: preview / empty state -->
          <section class="card">
            <div class="card-body">
              @if (previewObjectUrl(); as src) {
                <div class="flex flex-col items-center gap-3 py-2">
                  <img
                    [src]="src"
                    alt="QR de asistencia del alumno"
                    class="w-64 h-64 object-contain bg-white rounded border border-border-subtle"
                    data-testid="student-qr-preview"
                  />
                  <p class="text-sm text-content-muted text-center max-w-xs">
                    {{ student()?.fullName }} · {{ tenantName() }}
                  </p>
                  <p class="text-xs text-content-subtle">
                    Imprime y plastifica esta credencial. Si se pierde,
                    rotala desde aquí — el QR anterior queda invalidado.
                  </p>
                </div>
              } @else if (hasActiveQr()) {
                <app-empty-state
                  icon="qr-code"
                  title="Credencial activa"
                  [description]="
                    'Hay una credencial vigente emitida el ' +
                    formatDate(qrInfo()!.issuedAt) +
                    '. Reimprime para volver a generarla.'
                  "
                />
              } @else {
                <app-empty-state
                  icon="qr-code"
                  title="Aún no se ha emitido credencial"
                  description="Genera la primera credencial del alumno; podrás descargarla en SVG o PNG e imprimirla."
                />
              }
            </div>
          </section>

          <!-- Right: actions -->
          <aside class="flex flex-col gap-4">
            <div class="card">
              <div class="card-body">
                <h3 class="card-title text-base">Acciones</h3>

                <div class="flex flex-col gap-2 mt-3">
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="busy()"
                    (click)="issueAndDownload('svg')"
                    data-testid="qr-download-svg"
                  >
                    @if (issuingFormat() === 'svg') {
                      <app-spinner [size]="16" />
                    } @else {
                      <app-icon name="download" [size]="16" />
                    }
                    {{ hasActiveQr() ? 'Reimprimir SVG' : 'Generar SVG' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline"
                    [disabled]="busy()"
                    (click)="issueAndDownload('png')"
                    data-testid="qr-download-png"
                  >
                    @if (issuingFormat() === 'png') {
                      <app-spinner [size]="16" />
                    } @else {
                      <app-icon name="printer" [size]="16" />
                    }
                    {{ hasActiveQr() ? 'Reimprimir PNG' : 'Generar PNG' }}
                  </button>

                  @if (canRotate()) {
                    <button
                      type="button"
                      class="btn btn-ghost text-error mt-2"
                      [disabled]="busy()"
                      (click)="rotate()"
                      data-testid="qr-rotate"
                    >
                      @if (rotating()) {
                        <app-spinner [size]="16" />
                      } @else {
                        <app-icon name="rotate-cw" [size]="16" />
                      }
                      Rotar credencial
                    </button>
                  }
                </div>

                @if (busy()) {
                  <p class="text-xs text-content-muted mt-3">
                    Generando credencial…
                  </p>
                }
              </div>
            </div>

            @if (hasActiveQr()) {
              <div class="card">
                <div class="card-body">
                  <h3 class="card-title text-base">Estado</h3>
                  <dl class="text-sm space-y-1 mt-2">
                    <div class="flex justify-between">
                      <dt class="text-content-muted">Versión</dt>
                      <dd class="font-medium">v{{ qrInfo()!.version }}</dd>
                    </div>
                    <div class="flex justify-between">
                      <dt class="text-content-muted">Emitida</dt>
                      <dd class="font-medium">{{ formatDate(qrInfo()!.issuedAt) }}</dd>
                    </div>
                    @if (qrInfo()!.lastRotatedAt; as last) {
                      <div class="flex justify-between">
                        <dt class="text-content-muted">Última rotación</dt>
                        <dd class="font-medium">{{ formatDate(last) }}</dd>
                      </div>
                    }
                  </dl>
                </div>
              </div>
            }
          </aside>
        </div>
      }
    </app-page-container>
  `
})
export class StudentQrPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly attendanceApi = inject(AttendanceApiService);
  private readonly studentsApi = inject(StudentsApiService);
  private readonly tenant = inject(TenantService);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  protected readonly backRoute = ROUTES.STUDENTS.LIST;

  protected readonly publicUuid = signal<string>('');
  protected readonly student = signal<StudentDetail | null>(null);
  protected readonly qrInfo = signal<AttendanceQrInfo | null>(null);
  protected readonly previewObjectUrl = signal<string | null>(null);
  protected readonly loading = signal<boolean>(true);
  protected readonly issuingFormat = signal<'svg' | 'png' | null>(null);
  protected readonly rotating = signal<boolean>(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly tenantName = computed(() => this.tenant.tenant()?.name ?? '');
  protected readonly canRotate = computed(() =>
    this.auth.hasRole(UserRole.TenantAdmin)
  );
  protected readonly hasActiveQr = computed(() => this.qrInfo()?.active === true);
  protected readonly busy = computed(
    () => this.issuingFormat() !== null || this.rotating()
  );

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loadError.set('Falta el identificador del alumno.');
      this.loading.set(false);
      return;
    }
    this.publicUuid.set(id);
    await this.loadStudentAndQrMetadata(id);
  }

  ngOnDestroy(): void {
    this.disposePreview();
  }

  protected reload(): void {
    void this.loadStudentAndQrMetadata(this.publicUuid());
  }

  /**
   * Mint (or re-mint) the credential and trigger a browser download.
   *
   * <p>The same call powers both "Generar" and "Reimprimir" because
   * the backend treats both as a fresh issuance — see
   * {@code AttendanceQrController#getQr}.
   */
  protected async issueAndDownload(format: 'svg' | 'png'): Promise<void> {
    if (this.busy()) return;
    this.issuingFormat.set(format);
    try {
      const blob = await firstValueFrom(
        this.attendanceApi.downloadQr(this.publicUuid(), format)
      );
      this.refreshPreview(blob);
      this.triggerBrowserDownload(blob, format);
      /* The mint mutated the active row — reload metadata so issuedAt
       * reflects the new emission. */
      const info = await firstValueFrom(
        this.attendanceApi.getQrInfo(this.publicUuid())
      );
      this.qrInfo.set(info);
      this.notifications.success(
        `Credencial ${format.toUpperCase()} lista`,
        'QR generado'
      );
    } catch (err) {
      this.notifications.error(
        'No se pudo generar la credencial. Intenta de nuevo.',
        'Error'
      );
      console.error('[student-qr] issueAndDownload failed', err);
    } finally {
      this.issuingFormat.set(null);
    }
  }

  /**
   * Admin-only explicit rotation. Distinguished from
   * {@link #issueAndDownload} in the backend audit log
   * ({@code ATTENDANCE_QR_ROTATED} vs the implicit reissue event).
   */
  protected async rotate(): Promise<void> {
    if (this.busy() || !this.canRotate()) return;
    const confirmed = window.confirm(
      'Esto invalida el QR actual. ¿Confirmar?'
    );
    if (!confirmed) return;

    this.rotating.set(true);
    try {
      const info = await firstValueFrom(
        this.attendanceApi.rotateQr(this.publicUuid())
      );
      this.qrInfo.set(info);
      /* Drop any stale preview so the next "Reimprimir" download
       * regenerates the visual against the new token. */
      this.disposePreview();
      this.notifications.success(
        'La credencial fue rotada. Reimprime para entregarla al alumno.',
        'QR rotado'
      );
    } catch (err) {
      this.notifications.error(
        'No se pudo rotar la credencial. Intenta de nuevo.',
        'Error'
      );
      console.error('[student-qr] rotate failed', err);
    } finally {
      this.rotating.set(false);
    }
  }

  protected formatDate(d: Date): string {
    return d.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async loadStudentAndQrMetadata(publicUuid: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [student, info] = await Promise.all([
        firstValueFrom(this.studentsApi.get(publicUuid)),
        firstValueFrom(this.attendanceApi.getQrInfo(publicUuid))
      ]);
      this.student.set(student);
      this.qrInfo.set(info);
    } catch (err) {
      const status = (err as { status?: number }).status;
      this.loadError.set(
        status === 404
          ? 'No encontramos al alumno en este tenant.'
          : 'Ocurrió un error al cargar los datos del alumno.'
      );
      console.error('[student-qr] load failed', err);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Replace the current preview with a fresh object URL. We revoke
   * the previous one to keep the {@code Blob} from leaking — every
   * issuance produces a new file we no longer need.
   */
  private refreshPreview(blob: Blob): void {
    this.disposePreview();
    const url = URL.createObjectURL(blob);
    this.previewObjectUrl.set(url);
  }

  private disposePreview(): void {
    const prev = this.previewObjectUrl();
    if (prev) {
      URL.revokeObjectURL(prev);
      this.previewObjectUrl.set(null);
    }
  }

  /**
   * Open the freshly minted blob as a browser download. We build a
   * disposable {@code <a download>} so the filename we propose
   * survives the user's "Save as…" dialog (Blob URLs by default
   * surface a hash as the filename).
   */
  private triggerBrowserDownload(blob: Blob, format: 'svg' | 'png'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (this.student()?.fullName ?? this.publicUuid())
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();
    a.href = url;
    a.download = `qr-${safeName || this.publicUuid()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

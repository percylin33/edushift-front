import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  output,
  signal
} from '@angular/core';
import { BulkImportStatus } from '@core/enums';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { StudentsStore } from '../store/students.store';
import { BulkImportStatusBadgeComponent } from './bulk-import-status-badge.component';

/**
 * Two-step modal for the student bulk-import flow.
 *
 * <h3>Steps</h3>
 * <ol>
 *   <li><b>Picker</b> — explains the format, lets the admin download
 *       the canonical {@code .xlsx} template, and accepts an upload.
 *       Submitting fires {@link StudentsStore#startBulkImport} which
 *       returns immediately (the worker runs async).</li>
 *   <li><b>Progress</b> — once a job exists we render the live status
 *       badge, counters and per-row error list. The store polls until
 *       the job hits a terminal status, then we surface the
 *       success / failure copy with a "Cerrar" or "Importar otro"
 *       footer.</li>
 * </ol>
 *
 * <p>Keeps its own dialog chrome (backdrop + ESC handler) inline, same
 * trade-off explained in {@code InviteUserModalComponent}.
 */
@Component({
  selector: 'app-bulk-import-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, SpinnerComponent, BulkImportStatusBadgeComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card w-full max-w-2xl shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="bulk-import-title" class="card-title">Importar estudiantes</h2>
            <p class="card-description">
              @if (job(); as j) {
                Archivo <span class="font-medium text-content">{{ j.fileName }}</span>.
              } @else {
                Carga un archivo .xlsx siguiendo la plantilla.
              }
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
          @if (errorMessage(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1">
                <p class="font-medium">No pudimos procesar el archivo.</p>
                <p class="mt-1 text-xs opacity-80">{{ err }}</p>
              </div>
            </div>
          }

          @if (job(); as j) {
            <!-- Step 2: progress / result -->
            <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="space-y-1">
                  <p class="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                    Estado del job
                  </p>
                  <app-bulk-import-status-badge [status]="j.status" />
                </div>
                <div class="text-right text-xs text-content-muted">
                  <p>{{ formatBytes(j.fileSizeBytes) }}</p>
                  @if (j.startedAt) {
                    <p>Iniciado: {{ formatDateTime(j.startedAt) }}</p>
                  }
                </div>
              </div>

              <div class="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <p class="text-2xs uppercase text-content-subtle">Total</p>
                  <p class="text-lg font-semibold text-content">{{ j.totalRows ?? '—' }}</p>
                </div>
                <div>
                  <p class="text-2xs uppercase text-content-subtle">Procesadas</p>
                  <p class="text-lg font-semibold text-success">{{ j.processedRows }}</p>
                </div>
                <div>
                  <p class="text-2xs uppercase text-content-subtle">Errores</p>
                  <p class="text-lg font-semibold text-danger">{{ j.errorRows }}</p>
                </div>
              </div>

              @if (progressPercent() !== null) {
                <div class="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    class="h-full bg-primary transition-[width] duration-500 ease-out"
                    [style.width.%]="progressPercent()"
                  ></div>
                </div>
              }

              @if (j.failReason) {
                <p class="mt-3 text-xs text-danger">{{ j.failReason }}</p>
              }
            </div>

            @if (j.errors.length > 0) {
              <div class="rounded-md border border-border-subtle">
                <header class="flex items-center justify-between border-b border-border-subtle px-3 py-2">
                  <p class="text-sm font-medium text-content">
                    Errores por fila ({{ j.errors.length }})
                  </p>
                </header>
                <ul class="max-h-64 divide-y divide-border-subtle overflow-y-auto">
                  @for (e of j.errors; track e.row) {
                    <li class="flex items-start gap-3 px-3 py-2 text-xs">
                      <span class="badge badge-neutral shrink-0">Fila {{ e.row }}</span>
                      <div class="flex-1 space-y-0.5">
                        <p class="font-mono text-2xs uppercase tracking-wider text-content-subtle">
                          {{ e.code }}
                        </p>
                        <p class="text-content">{{ e.message }}</p>
                      </div>
                    </li>
                  }
                </ul>
              </div>
            }
          } @else {
            <!-- Step 1: picker -->
            <div class="rounded-md border border-dashed border-border-subtle bg-surface-muted/30 p-4 text-center">
              <app-icon name="upload" [size]="28" class="mx-auto text-content-subtle" />
              <p class="mt-2 text-sm font-medium text-content">
                Arrastra un .xlsx o selecciónalo
              </p>
              <p class="text-xs text-content-muted">
                Tamaño máximo según política del workspace. Solo extensiones .xlsx.
              </p>

              <input
                #fileInput
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                class="hidden"
                (change)="onFilePicked($event)"
              />

              <div class="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  (click)="onDownloadTemplate()"
                  [disabled]="downloadingTemplate()"
                >
                  @if (downloadingTemplate()) {
                    <app-spinner [size]="14" label="Generando" />
                  } @else {
                    <app-icon name="download" [size]="16" />
                  }
                  <span>Descargar plantilla</span>
                </button>
                <button
                  type="button"
                  class="btn btn-primary btn-sm"
                  (click)="fileInput.click()"
                  [disabled]="uploading()"
                >
                  @if (uploading()) {
                    <app-spinner [size]="14" label="Subiendo" />
                    <span>Subiendo…</span>
                  } @else {
                    <app-icon name="upload" [size]="16" />
                    <span>Subir archivo</span>
                  }
                </button>
              </div>

              @if (selectedFileName(); as name) {
                <p class="mt-3 text-xs text-content-muted">
                  Seleccionado: <span class="font-medium text-content">{{ name }}</span>
                </p>
              }
            </div>
          }
        </div>

        <footer class="card-footer">
          @if (job()) {
            <button type="button" class="btn btn-ghost btn-sm" (click)="restart()">
              Importar otro
            </button>
            <button type="button" class="btn btn-primary btn-sm" (click)="close()">
              Cerrar
            </button>
          } @else {
            <button type="button" class="btn btn-ghost btn-sm" (click)="close()">
              Cancelar
            </button>
          }
        </footer>
      </div>
    </div>
  `
})
export class BulkImportModalComponent {
  private readonly store = inject(StudentsStore);

  readonly closed = output<void>();

  protected readonly job = this.store.bulkJob;
  protected readonly uploading = this.store.bulkUploading;
  protected readonly errorMessage = this.store.error;

  protected readonly downloadingTemplate = signal(false);
  protected readonly selectedFileName = signal<string | null>(null);

  /**
   * Visible progress hint. Returns {@code null} when the worker hasn't
   * reported a {@code totalRows} yet (job still in {@code PENDING});
   * otherwise the percentage is {@code (processed + errors) / total}
   * so the bar advances even when some rows fail validation.
   */
  protected readonly progressPercent = computed<number | null>(() => {
    const j = this.job();
    if (!j || !j.totalRows || j.totalRows === 0) return null;
    const done = j.processedRows + j.errorRows;
    const pct = (done / j.totalRows) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  });

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected onBackdropClick(_event: MouseEvent): void {
    this.close();
  }

  protected close(): void {
    /* Don't tear down the job slice on close — admins often want to
     * reopen the modal to re-check progress. The list page will hit
     * {@link StudentsStore#resetBulkImport} explicitly when the
     * import is finished and acknowledged. */
    this.store.clearError();
    this.closed.emit();
  }

  protected restart(): void {
    this.selectedFileName.set(null);
    this.store.resetBulkImport();
  }

  protected async onDownloadTemplate(): Promise<void> {
    this.downloadingTemplate.set(true);
    try {
      const blob = await this.store.downloadTemplate();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'students-template.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      /* Clean up the object URL on the next tick so the download has
       * time to start; otherwise some browsers cancel it mid-flight. */
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    finally {
      this.downloadingTemplate.set(false);
    }
  }

  protected async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFileName.set(file.name);
    await this.store.startBulkImport(file);
    /* Reset the input so picking the same file twice still triggers
     * the change event (relevant after a Failed retry). */
    input.value = '';
  }

  protected formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected formatDateTime(date: Date): string {
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /** Re-export so the template can branch on the enum without importing it. */
  protected readonly Status = BulkImportStatus;
}

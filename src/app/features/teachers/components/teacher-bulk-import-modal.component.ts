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
import { BulkImportStatus } from '@core/enums';
import { IconComponent } from '@shared/components';
import { BulkImportStatusBadgeComponent } from '../../students/components';
import { BulkImportPreview } from '../../students/models';
import { TeachersStore } from '../store';

type WizardStep = 'file' | 'mapping' | 'progress';

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
}

const TEACHER_FIELD_DEFS: FieldDef[] = [
  { key: 'documentType', label: 'Tipo de documento', required: true },
  { key: 'documentNumber', label: 'Número de documento', required: true },
  { key: 'firstName', label: 'Nombres', required: true },
  { key: 'lastName', label: 'Apellido paterno', required: true },
  { key: 'secondLastName', label: 'Apellido materno', required: false },
  { key: 'birthDate', label: 'Fecha de nacimiento', required: false },
  { key: 'gender', label: 'Género', required: false },
  { key: 'email', label: 'Correo', required: false },
  { key: 'phone', label: 'Teléfono', required: false },
  { key: 'title', label: 'Título', required: false },
  { key: 'specializations', label: 'Especialidades', required: false },
  { key: 'hireDate', label: 'Fecha de contratación', required: false },
  { key: 'employmentStatus', label: 'Estado laboral', required: false },
];

/**
 * Modal de importación masiva de docentes (.xlsx).
 * Flujo: archivo → mapeo de columnas → progreso.
 */
@Component({
  selector: 'app-teacher-bulk-import-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, BulkImportStatusBadgeComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="teacher-bulk-import-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <div class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="teacher-bulk-import-title" class="card-title">Importar docentes</h2>
            <p class="mt-1 text-sm text-content-muted">{{ stepDescription() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()" aria-label="Cerrar">
            <app-icon name="x" [size]="18" />
          </button>
        </div>

        <div class="card-body space-y-4">
          @if (errorMessage(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1 text-sm">{{ err }}</div>
            </div>
          }

          @switch (step()) {
            @case ('file') {
              <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-4 text-sm">
                <p class="font-medium text-content">Columnas obligatorias</p>
                <p class="mt-1 text-content-muted">
                  Tipo de documento, Número de documento, Nombres, Apellido paterno
                </p>
                <p class="mt-2 text-xs text-content-muted">
                  Puedes usar la plantilla oficial o un Excel propio; en el siguiente paso
                  mapearás las columnas. Fechas: día/mes/año (ej. 15/04/1988).
                </p>
                <button
                  type="button"
                  class="btn btn-outline btn-sm mt-3"
                  [disabled]="downloadingTemplate()"
                  (click)="onDownloadTemplate()"
                >
                  <app-icon name="download" [size]="16" />
                  {{ downloadingTemplate() ? 'Descargando…' : 'Descargar plantilla' }}
                </button>
              </div>

              <label
                class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-subtle px-4 py-8 text-center hover:border-primary/50 hover:bg-primary/5"
              >
                <app-icon name="upload" [size]="28" />
                <span class="mt-2 text-sm font-medium text-content">Elegir archivo .xlsx</span>
                <span class="mt-1 text-xs text-content-muted">Máx. 10 MB</span>
                <input
                  type="file"
                  class="sr-only"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  (change)="onFilePicked($event)"
                />
              </label>

              @if (selectedFileName(); as name) {
                <p class="text-xs text-content-muted">
                  Seleccionado: <span class="font-medium text-content">{{ name }}</span>
                </p>
              }

              <button
                type="button"
                class="btn btn-primary w-full"
                [disabled]="previewing() || !selectedFile()"
                (click)="onContinueToMapping()"
              >
                {{ previewing() ? 'Analizando…' : 'Continuar al mapeo' }}
              </button>
            }

            @case ('mapping') {
              @if (preview(); as p) {
                @if (unmappedRequiredLabels().length > 0) {
                  <div class="alert alert-warning">
                    <app-icon name="alert-circle" [size]="18" />
                    <div class="flex-1 text-sm">
                      Faltan columnas requeridas:
                      <strong>{{ unmappedRequiredLabels().join(', ') }}</strong>.
                    </div>
                  </div>
                }

                <p class="text-xs text-content-muted">
                  Archivo <span class="font-medium text-content">{{ selectedFileName() }}</span> ·
                  {{ p.headers.length }} columnas detectadas.
                </p>

                <div class="grid gap-3 sm:grid-cols-2">
                  @for (field of fieldDefs; track field.key) {
                    <div class="field">
                      <label class="label" [attr.for]="'tmap-' + field.key">
                        {{ field.label }}
                        @if (field.required) {
                          <span class="text-danger-500">*</span>
                        }
                      </label>
                      <select
                        class="select"
                        [id]="'tmap-' + field.key"
                        [ngModel]="mapping()[field.key] || ''"
                        (ngModelChange)="setMapping(field.key, $event)"
                      >
                        <option value="">— No usar —</option>
                        @for (h of p.headers; track h) {
                          <option [value]="h" [disabled]="isHeaderTaken(h, field.key)">
                            {{ h }}
                          </option>
                        }
                      </select>
                    </div>
                  }
                </div>

                @if (p.sampleRows.length > 0) {
                  <div class="overflow-x-auto rounded-md border border-border-subtle">
                    <p
                      class="border-b border-border-subtle px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-content-subtle"
                    >
                      Vista previa
                    </p>
                    <table class="min-w-full text-left text-xs">
                      <thead>
                        <tr class="bg-surface-muted/50">
                          @for (h of p.headers; track h) {
                            <th class="whitespace-nowrap px-2 py-1.5 font-medium">{{ h }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of p.sampleRows; track $index) {
                          <tr class="border-t border-border-subtle">
                            @for (h of p.headers; track h) {
                              <td class="whitespace-nowrap px-2 py-1.5 text-content-muted">
                                {{ row[h] || '—' }}
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }

                <div class="flex flex-wrap gap-2">
                  <button type="button" class="btn btn-outline" (click)="backToFile()">
                    Atrás
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    [disabled]="uploading() || unmappedRequiredLabels().length > 0"
                    (click)="onStartImport()"
                  >
                    {{ uploading() ? 'Importando…' : 'Importar' }}
                  </button>
                </div>
              }
            }

            @case ('progress') {
              @if (job(); as j) {
                <div class="rounded-md border border-border-subtle bg-surface-muted/40 p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="space-y-1">
                      <p class="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                        Estado
                      </p>
                      <app-bulk-import-status-badge [status]="j.status" />
                    </div>
                    <div class="text-right text-xs text-content-muted">
                      <p>{{ j.fileName }}</p>
                      <p>{{ formatBytes(j.fileSizeBytes) }}</p>
                    </div>
                  </div>

                  <div class="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p class="text-2xs uppercase text-content-subtle">Total</p>
                      <p class="text-lg font-semibold text-content">{{ j.totalRows ?? '—' }}</p>
                    </div>
                    <div>
                      <p class="text-2xs uppercase text-content-subtle">OK</p>
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
                  <div class="max-h-48 overflow-y-auto rounded-md border border-border-subtle">
                    <table class="min-w-full text-left text-xs">
                      <thead>
                        <tr class="bg-surface-muted/50">
                          <th class="px-3 py-2 font-medium">Fila</th>
                          <th class="px-3 py-2 font-medium">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (e of j.errors; track e.row + e.code) {
                          <tr class="border-t border-border-subtle">
                            <td class="px-3 py-1.5 font-mono">{{ e.row }}</td>
                            <td class="px-3 py-1.5 text-content-muted">{{ e.message }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }

                @if (isTerminal()) {
                  <div class="flex flex-wrap gap-2">
                    <button type="button" class="btn btn-outline btn-sm" (click)="restart()">
                      Importar otro
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" (click)="close()">
                      Cerrar
                    </button>
                  </div>
                }
              }
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class TeacherBulkImportModalComponent {
  private readonly store = inject(TeachersStore);

  readonly closed = output<void>();

  protected readonly job = this.store.bulkJob;
  protected readonly uploading = this.store.bulkUploading;
  protected readonly errorMessage = this.store.error;
  protected readonly fieldDefs = TEACHER_FIELD_DEFS;

  protected readonly step = signal<WizardStep>('file');
  protected readonly downloadingTemplate = signal(false);
  protected readonly previewing = signal(false);
  protected readonly selectedFileName = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly preview = signal<BulkImportPreview | null>(null);
  protected readonly mapping = signal<Record<string, string>>({});

  protected readonly progressPercent = computed<number | null>(() => {
    const j = this.job();
    if (!j || !j.totalRows || j.totalRows === 0) return null;
    const done = j.processedRows + j.errorRows;
    return Math.max(0, Math.min(100, Math.round((done / j.totalRows) * 100)));
  });

  protected readonly isTerminal = computed(() => {
    const j = this.job();
    if (!j) return false;
    return j.status === BulkImportStatus.Completed || j.status === BulkImportStatus.Failed;
  });

  protected readonly unmappedRequiredLabels = computed(() => {
    const map = this.mapping();
    return this.fieldDefs.filter((f) => f.required && !map[f.key]).map((f) => f.label);
  });

  protected readonly stepDescription = computed(() => {
    switch (this.step()) {
      case 'file':
        return 'Sube un .xlsx con la plantilla oficial o un archivo propio.';
      case 'mapping':
        return 'Haz coincidir cada campo con una columna de tu Excel.';
      case 'progress':
        return 'Procesando el lote…';
    }
  });

  constructor() {
    this.store.clearError();
    if (this.job()) {
      this.step.set('progress');
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected close(): void {
    this.store.clearError();
    this.closed.emit();
  }

  protected restart(): void {
    this.selectedFileName.set(null);
    this.selectedFile.set(null);
    this.preview.set(null);
    this.mapping.set({});
    this.store.resetBulkImport();
    this.step.set('file');
  }

  protected backToFile(): void {
    this.preview.set(null);
    this.mapping.set({});
    this.step.set('file');
  }

  protected async onDownloadTemplate(): Promise<void> {
    this.downloadingTemplate.set(true);
    try {
      const blob = await this.store.downloadBulkTemplate();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'plantilla-docentes.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      this.downloadingTemplate.set(false);
    }
  }

  protected onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.selectedFile.set(file);
    this.selectedFileName.set(file.name);
    this.preview.set(null);
    this.mapping.set({});
    this.store.clearError();
  }

  protected async onContinueToMapping(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;
    this.previewing.set(true);
    try {
      const preview = await this.store.previewBulkImport(file);
      if (!preview) return;
      this.preview.set(preview);
      this.mapping.set({ ...preview.suggestedMapping });
      this.step.set('mapping');
    } finally {
      this.previewing.set(false);
    }
  }

  protected setMapping(key: string, header: string): void {
    this.mapping.update((m) => {
      const next = { ...m };
      if (!header) delete next[key];
      else next[key] = header;
      return next;
    });
  }

  protected isHeaderTaken(header: string, exceptKey: string): boolean {
    const map = this.mapping();
    return Object.entries(map).some(([k, h]) => k !== exceptKey && h === header);
  }

  protected async onStartImport(): Promise<void> {
    const file = this.selectedFile();
    if (!file || this.unmappedRequiredLabels().length > 0) return;
    const job = await this.store.startBulkImport(file, this.mapping());
    if (job) {
      this.step.set('progress');
    }
  }

  protected formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

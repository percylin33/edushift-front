import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { BulkImportStatus, Permission, UserRole } from '@core/enums';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearRow, AcademicYearStatus, SectionRow } from '@features/academic/models';
import { AuthService } from '@core/services';
import {
  BULK_IMPORT_FIELD_DEFS,
  BULK_IMPORT_GUARDIAN_REQUIRED_KEYS,
  BulkImportFieldDef,
  BulkImportPreview,
} from '../models';
import { StudentsStore } from '../store/students.store';
import { BulkImportStatusBadgeComponent } from './bulk-import-status-badge.component';
import { ProvisionAccountsModalComponent } from './provision-accounts-modal.component';

type WizardStep = 'destination' | 'file' | 'mapping' | 'progress';

/**
 * Wizard de importación masiva de estudiantes.
 *
 * <ol>
 *   <li>Destino — sección del año activo (o solo fichas).</li>
 *   <li>Archivo — plantilla ES + upload .xlsx.</li>
 *   <li>Mapeo — columnas del Excel ↔ campos EduShift.</li>
 *   <li>Progreso — polling del job async.</li>
 * </ol>
 */
@Component({
  selector: 'app-bulk-import-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    SpinnerComponent,
    BulkImportStatusBadgeComponent,
    ProvisionAccountsModalComponent,
  ],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-import-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[90vh] w-full max-w-3xl flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="bulk-import-title" class="card-title">Importar estudiantes</h2>
            <p class="card-description">{{ stepDescription() }}</p>
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

        <div class="card-body flex flex-col gap-4 overflow-y-auto">
          @if (step() !== 'progress') {
            <nav class="flex flex-wrap gap-2 text-2xs font-semibold uppercase tracking-wider">
              @for (s of stepMeta; track s.id) {
                <span
                  class="rounded-full px-2.5 py-1"
                  [ngClass]="
                    step() === s.id
                      ? 'bg-primary/15 text-primary'
                      : 'text-content-subtle'
                  "
                >
                  {{ s.label }}
                </span>
              }
            </nav>
          }

          @if (errorMessage(); as err) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="18" />
              <div class="flex-1">
                <p class="font-medium">No pudimos continuar.</p>
                <p class="mt-1 text-xs opacity-80">{{ err }}</p>
              </div>
            </div>
          }

          @switch (step()) {
            @case ('destination') {
              @if (loadingCatalogs()) {
                <div class="flex items-center justify-center py-10">
                  <app-spinner [size]="24" label="Cargando catálogos…" />
                </div>
              } @else {
                <div class="field">
                  <label class="label" for="bulk-dest">Destino del lote</label>
                  <select
                    id="bulk-dest"
                    class="select"
                    [ngModel]="sectionMode()"
                    (ngModelChange)="onSectionModeChange($event)"
                  >
                    <option value="none">Sin sección (solo crear fichas)</option>
                    <option value="section" [disabled]="!activeYear() || sections().length === 0">
                      Matricular en una sección
                    </option>
                  </select>
                </div>

                @if (!activeYear()) {
                  <div class="alert alert-warning">
                    <app-icon name="info" [size]="18" />
                    <p class="flex-1 text-sm">
                      No hay año académico activo. Puedes importar fichas sin sección, o activa un
                      año en <em>Académico → Años</em>.
                    </p>
                  </div>
                } @else if (sectionMode() === 'section') {
                  @if (sections().length === 0) {
                    <div class="alert alert-warning">
                      <app-icon name="info" [size]="18" />
                      <p class="flex-1 text-sm">
                        El año {{ activeYear()?.name }} no tiene secciones. Crea una en
                        <em>Académico → Secciones</em> o elige “Sin sección”.
                      </p>
                    </div>
                  } @else {
                    <div class="field">
                      <label class="label" for="bulk-section">
                        Sección <span class="text-danger-500">*</span>
                      </label>
                      <select
                        id="bulk-section"
                        class="select"
                        [ngModel]="sectionUuid()"
                        (ngModelChange)="sectionUuid.set($event)"
                      >
                        <option value="" disabled>Seleccionar sección…</option>
                        @for (s of sections(); track s.publicUuid) {
                          <option [value]="s.publicUuid">
                            {{ s.gradeName }} · {{ s.name }} ({{ s.levelCode }})
                          </option>
                        }
                      </select>
                    </div>

                    <div class="field">
                      <label class="label" for="bulk-enrolled-at">Fecha de matrícula</label>
                      <input
                        id="bulk-enrolled-at"
                        type="date"
                        class="input"
                        [min]="yearMinDate()"
                        [max]="yearMaxDate()"
                        [ngModel]="enrolledAt()"
                        (ngModelChange)="enrolledAt.set($event)"
                      />
                    </div>

                    @if (destinationChip(); as chip) {
                      <p
                        class="rounded-md border border-border-subtle bg-surface-muted/40 px-3 py-2 text-sm text-content"
                      >
                        Destino:
                        <span class="font-medium">{{ chip }}</span>
                      </p>
                    }
                  }
                }
              }
            }

            @case ('file') {
              <div
                class="rounded-md border border-dashed border-border-subtle bg-surface-muted/30 p-4 text-center"
              >
                <app-icon name="upload" [size]="28" class="mx-auto text-content-subtle" />
                <p class="mt-2 text-sm font-medium text-content">
                  Descarga la plantilla o sube tu .xlsx
                </p>
                <p class="text-xs text-content-muted">
                  Headers en español o inglés. Si tu archivo usa otros nombres, los mapearás en el
                  siguiente paso.
                </p>
                @if (destinationChip(); as chip) {
                  <p class="mt-2 text-xs text-content-muted">
                    Destino: <span class="font-medium text-content">{{ chip }}</span>
                  </p>
                }

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
                    [disabled]="previewing()"
                  >
                    @if (previewing()) {
                      <app-spinner [size]="14" label="Leyendo" />
                      <span>Leyendo…</span>
                    } @else {
                      <app-icon name="upload" [size]="16" />
                      <span>Elegir archivo</span>
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

            @case ('mapping') {
              @if (preview(); as p) {
                <p class="text-sm text-content">
                  Mínimo obligatorio:
                  <strong>tipo y número de documento, nombres, apellido paterno</strong>.
                  La sección se eligió en el paso 1. Correo del alumno/apoderado es opcional.
                </p>

                @if (unmappedRequiredLabels().length > 0) {
                  <div class="alert alert-warning">
                    <app-icon name="alert-circle" [size]="18" />
                    <div class="flex-1 text-sm">
                      Faltan columnas requeridas:
                      <strong>{{ unmappedRequiredLabels().join(', ') }}</strong>.
                      Asígnalas antes de confirmar.
                    </div>
                  </div>
                }

                <p class="text-xs text-content-muted">
                  Archivo <span class="font-medium text-content">{{ selectedFileName() }}</span> ·
                  {{ p.headers.length }} columnas detectadas.
                </p>

                <div class="grid gap-3 sm:grid-cols-2">
                  @for (field of orderedFieldDefs(); track field.key) {
                    <div class="field" [class.sm:col-span-2]="field.required && field.group === 'student'">
                      <label class="label" [attr.for]="'map-' + field.key">
                        {{ field.label }}
                        @if (isFieldRequired(field)) {
                          <span class="text-danger-500">*</span>
                        }
                        <span class="ml-1 text-2xs font-normal text-content-subtle">
                          ({{ field.group === 'guardian' ? 'apoderado' : 'alumno' }})
                        </span>
                      </label>
                      <select
                        class="select"
                        [id]="'map-' + field.key"
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
                      Vista previa (primeras filas)
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
              }
            }

            @case ('progress') {
              @if (job(); as j) {
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

                  @if (canOfferProvision()) {
                    <div
                      class="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-content"
                    >
                      <p class="font-medium">¿Crear cuentas portal de esta sección?</p>
                      <p class="mt-1 text-xs text-content-muted">
                        Genera correo + contraseña temporal y descarga la hoja imprimible.
                      </p>
                      <button
                        type="button"
                        class="btn btn-primary btn-sm mt-3"
                        (click)="showProvisionModal.set(true)"
                      >
                        Generar cuentas de esta sección
                      </button>
                    </div>
                  }
                </div>

                @if (j.errors.length > 0) {
                  <div class="rounded-md border border-border-subtle">
                    <header
                      class="flex items-center justify-between border-b border-border-subtle px-3 py-2"
                    >
                      <p class="text-sm font-medium text-content">
                        Errores por fila ({{ j.errors.length }})
                      </p>
                    </header>
                    <ul class="max-h-64 divide-y divide-border-subtle overflow-y-auto">
                      @for (e of j.errors; track e.row + e.code) {
                        <li class="flex items-start gap-3 px-3 py-2 text-xs">
                          <span class="badge badge-neutral shrink-0">Fila {{ e.row }}</span>
                          <div class="flex-1 space-y-0.5">
                            <p
                              class="font-mono text-2xs uppercase tracking-wider text-content-subtle"
                            >
                              {{ e.code }}
                            </p>
                            <p class="text-content">{{ e.message }}</p>
                          </div>
                        </li>
                      }
                    </ul>
                  </div>
                }
              } @else if (uploading()) {
                <div class="flex items-center justify-center gap-2 py-10 text-sm text-content-muted">
                  <app-spinner [size]="20" />
                  Encolando importación…
                </div>
              }
            }
          }
        </div>

        <footer class="card-footer">
          @switch (step()) {
            @case ('destination') {
              <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="!canContinueFromDestination()"
                (click)="goToFile()"
              >
                Continuar
              </button>
            }
            @case ('file') {
              <button type="button" class="btn btn-ghost btn-sm" (click)="step.set('destination')">
                Atrás
              </button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="close()">Cancelar</button>
            }
            @case ('mapping') {
              <button type="button" class="btn btn-ghost btn-sm" (click)="backToFile()">
                Atrás
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="!canConfirmMapping() || uploading()"
                (click)="onConfirmImport()"
              >
                @if (uploading()) {
                  <app-spinner [size]="14" />
                }
                <span>Confirmar importación</span>
              </button>
            }
            @case ('progress') {
              <button type="button" class="btn btn-ghost btn-sm" (click)="restart()">
                Importar otro
              </button>
              <button type="button" class="btn btn-primary btn-sm" (click)="close()">Cerrar</button>
            }
          }
        </footer>
      </div>
    </div>

    @if (showProvisionModal() && sectionUuid()) {
      <app-provision-accounts-modal
        [sectionPublicUuid]="sectionUuid()"
        (closed)="showProvisionModal.set(false)"
      />
    }
  `,
})
export class BulkImportModalComponent implements OnInit {
  private readonly store = inject(StudentsStore);
  private readonly academicApi = inject(AcademicApiService);
  private readonly auth = inject(AuthService);

  readonly closed = output<void>();

  protected readonly job = this.store.bulkJob;
  protected readonly uploading = this.store.bulkUploading;
  protected readonly errorMessage = this.store.error;

  protected readonly step = signal<WizardStep>('destination');
  protected readonly showProvisionModal = signal(false);
  protected readonly downloadingTemplate = signal(false);
  protected readonly previewing = signal(false);
  protected readonly loadingCatalogs = signal(false);
  protected readonly selectedFileName = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly preview = signal<BulkImportPreview | null>(null);
  protected readonly mapping = signal<Record<string, string>>({});

  protected readonly activeYear = signal<AcademicYearRow | null>(null);
  protected readonly sections = signal<SectionRow[]>([]);
  /** {@code none} | {@code section} */
  protected readonly sectionMode = signal<'none' | 'section'>('none');
  protected readonly sectionUuid = signal('');
  protected readonly enrolledAt = signal('');

  protected readonly fieldDefs = BULK_IMPORT_FIELD_DEFS;

  /** Required student fields first, then optional student, then guardian. */
  protected readonly orderedFieldDefs = computed(() => {
    const defs = [...this.fieldDefs];
    return defs.sort((a, b) => {
      const ar = a.group === 'student' && a.required ? 0 : a.group === 'student' ? 1 : 2;
      const br = b.group === 'student' && b.required ? 0 : b.group === 'student' ? 1 : 2;
      if (ar !== br) return ar - br;
      return 0;
    });
  });

  protected readonly unmappedRequiredLabels = computed(() => {
    const map = this.mapping();
    const hasFullName = !!map['fullName'];
    const missing: string[] = [];
    for (const f of this.fieldDefs) {
      if (!f.required) continue;
      if ((f.key === 'firstName' || f.key === 'lastName') && hasFullName) continue;
      if (!map[f.key]) missing.push(f.label);
    }
    return missing;
  });

  protected readonly stepMeta: { id: WizardStep; label: string }[] = [
    { id: 'destination', label: '1. Destino' },
    { id: 'file', label: '2. Archivo' },
    { id: 'mapping', label: '3. Mapeo' },
  ];

  protected readonly yearMinDate = computed(() => {
    const y = this.activeYear();
    return y ? this.toIsoDate(y.startDate) : '';
  });

  protected readonly yearMaxDate = computed(() => {
    const y = this.activeYear();
    return y ? this.toIsoDate(y.endDate) : '';
  });

  protected readonly destinationChip = computed(() => {
    if (this.sectionMode() === 'none') return 'Sin sección (solo fichas)';
    const year = this.activeYear();
    const section = this.sections().find((s) => s.publicUuid === this.sectionUuid());
    if (!year || !section) return null;
    return `${year.name} · ${section.gradeName} · ${section.name}`;
  });

  protected readonly canOfferProvision = computed(() => {
    const j = this.job();
    if (!j || j.status !== BulkImportStatus.Completed) return false;
    if (this.sectionMode() !== 'section' || !this.sectionUuid()) return false;
    return (
      this.auth.hasRole(UserRole.TenantAdmin) ||
      this.auth.hasPermission(Permission.UsersProvisionSection)
    );
  });

  protected readonly stepDescription = computed(() => {
    switch (this.step()) {
      case 'destination':
        return 'Elige si este Excel pertenece a una sección (ej. 1ro Primaria · A).';
      case 'file':
        return 'Sube el .xlsx. Puedes usar la plantilla oficial o un archivo propio.';
      case 'mapping':
        return 'Haz coincidir cada campo requerido con una columna de tu Excel.';
      case 'progress': {
        const j = this.job();
        return j
          ? `Archivo ${j.fileName}.`
          : 'Procesando el lote…';
      }
    }
  });

  protected readonly progressPercent = computed<number | null>(() => {
    const j = this.job();
    if (!j || !j.totalRows || j.totalRows === 0) return null;
    const done = j.processedRows + j.errorRows;
    return Math.max(0, Math.min(100, Math.round((done / j.totalRows) * 100)));
  });

  async ngOnInit(): Promise<void> {
    this.store.clearError();
    if (this.job()) {
      this.step.set('progress');
      return;
    }
    await this.fetchCatalogs();
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
    this.sectionMode.set('none');
    this.sectionUuid.set('');
    this.store.resetBulkImport();
    this.step.set('destination');
  }

  protected onSectionModeChange(mode: 'none' | 'section'): void {
    this.sectionMode.set(mode);
    if (mode === 'none') {
      this.sectionUuid.set('');
    }
  }

  protected canContinueFromDestination(): boolean {
    if (this.sectionMode() === 'none') return true;
    if (!this.sectionUuid() || !this.activeYear()) return false;
    const at = this.enrolledAt();
    const min = this.yearMinDate();
    const max = this.yearMaxDate();
    return !!at && at >= min && at <= max;
  }

  protected goToFile(): void {
    if (!this.canContinueFromDestination()) return;
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
      const blob = await this.store.downloadTemplate();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'plantilla-estudiantes.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      this.downloadingTemplate.set(false);
    }
  }

  protected async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFileName.set(file.name);
    this.selectedFile.set(file);
    this.previewing.set(true);
    try {
      const preview = await this.store.previewBulkImport(file);
      if (!preview) return;
      this.preview.set(preview);
      this.mapping.set({ ...preview.suggestedMapping });
      this.step.set('mapping');
    } finally {
      this.previewing.set(false);
      input.value = '';
    }
  }

  protected setMapping(key: string, header: string): void {
    const next = { ...this.mapping() };
    if (!header) {
      delete next[key];
    } else {
      next[key] = header;
    }
    this.mapping.set(next);
  }

  protected isHeaderTaken(header: string, exceptKey: string): boolean {
    const map = this.mapping();
    return Object.entries(map).some(([k, v]) => k !== exceptKey && v === header);
  }

  protected isFieldRequired(field: BulkImportFieldDef): boolean {
    if (field.required) return true;
    if (field.group !== 'guardian') return false;
    return (
      this.anyGuardianMapped() &&
      (BULK_IMPORT_GUARDIAN_REQUIRED_KEYS as readonly string[]).includes(field.key)
    );
  }

  protected canConfirmMapping(): boolean {
    const map = this.mapping();
    const hasFullName = !!map['fullName'];
    for (const f of this.fieldDefs) {
      if (!f.required) continue;
      if ((f.key === 'firstName' || f.key === 'lastName') && hasFullName) continue;
      if (!map[f.key]) return false;
    }
    if (this.anyGuardianMapped()) {
      const hasGuardianFull = !!map['guardianFullName'];
      for (const key of BULK_IMPORT_GUARDIAN_REQUIRED_KEYS) {
        if ((key === 'guardianFirstName' || key === 'guardianLastName') && hasGuardianFull) {
          continue;
        }
        if (!map[key]) return false;
      }
    }
    return !!this.selectedFile();
  }

  protected async onConfirmImport(): Promise<void> {
    const file = this.selectedFile();
    if (!file || !this.canConfirmMapping()) return;

    const columnMapping: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.mapping())) {
      if (v) columnMapping[k] = v;
    }

    const year = this.activeYear();
    const useSection = this.sectionMode() === 'section' && !!this.sectionUuid() && !!year;

    this.step.set('progress');
    await this.store.startBulkImport(file, {
      columnMapping,
      sectionPublicUuid: useSection ? this.sectionUuid() : null,
      academicYearPublicUuid: useSection ? year!.publicUuid : null,
      enrolledAt: useSection ? this.enrolledAt() || null : null,
    });
  }

  private anyGuardianMapped(): boolean {
    const map = this.mapping();
    return this.fieldDefs.some((f) => f.group === 'guardian' && !!map[f.key]);
  }

  private async fetchCatalogs(): Promise<void> {
    this.loadingCatalogs.set(true);
    try {
      const years = await firstValueFrom(this.academicApi.listYears());
      const active = years.find((y) => y.status === AcademicYearStatus.Active) ?? null;
      this.activeYear.set(active);
      if (!active) {
        this.sections.set([]);
        return;
      }
      const sections = await firstValueFrom(
        this.academicApi.listSections({ academicYearPublicUuid: active.publicUuid }),
      );
      this.sections.set(sections);
      const today = this.toIsoDate(new Date());
      const min = this.toIsoDate(active.startDate);
      const max = this.toIsoDate(active.endDate);
      this.enrolledAt.set(today >= min && today <= max ? today : min);
      if (sections.length > 0) {
        this.sectionMode.set('section');
      }
    } catch {
      this.activeYear.set(null);
      this.sections.set([]);
    } finally {
      this.loadingCatalogs.set(false);
    }
  }

  private toIsoDate(value: Date | string): string {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      minute: '2-digit',
    });
  }

  protected readonly Status = BulkImportStatus;
}

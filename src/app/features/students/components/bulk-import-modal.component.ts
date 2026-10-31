import { createFormProtection } from '@shared/services/form-protection.service';
import { SafeBackdropDirective } from '@shared/directives/safe-backdrop.directive';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BulkImportStatus, DocumentType, EnrollmentStatus, Permission, UserRole } from '@core/enums';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearRow, AcademicYearStatus, SectionRow } from '@features/academic/models';
import { AuthService } from '@core/services';
import {
  BULK_IMPORT_FIELD_DEFS,
  BulkImportFieldDef,
  BulkImportPreview,
  BulkImportRowError,
} from '../models';
import { StudentsApiService } from '../services';
import { StudentsStore } from '../store/students.store';
import { BulkImportStatusBadgeComponent } from './bulk-import-status-badge.component';
import { ProvisionAccountsModalComponent } from './provision-accounts-modal.component';

type WizardStep = 'destination' | 'file' | 'mapping' | 'progress';
type NameMode = 'split' | 'full';

const STUDENT_OPTIONAL_KEYS = [
  'secondLastName',
  'birthDate',
  'gender',
  'email',
  'phone',
  'address',
  'enrollmentStatus',
  'enrollmentDate',
] as const;

const GUARDIAN_OPTIONAL_KEYS = [
  'guardianPhone',
  'guardianEmail',
  'guardianRelationship',
] as const;

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
  imports: [SafeBackdropDirective,
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
      appSafeBackdrop (click)="onBackdropClick($event)"
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
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-content">{{ selectedFileName() }}</p>
                    <p class="text-xs text-content-muted">
                      {{ p.headers.length }} columnas detectadas
                    </p>
                  </div>
                  @if (confirmBlockers().length === 0) {
                    <span class="badge badge-success shrink-0">Listo</span>
                  } @else {
                    <span class="badge badge-warning shrink-0">Faltan datos</span>
                  }
                </div>

                <section class="space-y-3 rounded-lg border border-border-subtle p-3">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold text-content">Alumno</h3>
                    <div class="flex rounded-md border border-border-subtle p-0.5 text-xs">
                      <button
                        type="button"
                        class="rounded px-2.5 py-1"
                        [ngClass]="
                          nameMode() === 'split'
                            ? 'bg-primary/15 font-medium text-primary'
                            : 'text-content-muted'
                        "
                        [attr.aria-pressed]="nameMode() === 'split'"
                        (click)="setNameMode('split')"
                      >
                        Nombres y apellidos
                      </button>
                      <button
                        type="button"
                        class="rounded px-2.5 py-1"
                        [ngClass]="
                          nameMode() === 'full'
                            ? 'bg-primary/15 font-medium text-primary'
                            : 'text-content-muted'
                        "
                        [attr.aria-pressed]="nameMode() === 'full'"
                        (click)="setNameMode('full')"
                      >
                        Nombre completo
                      </button>
                    </div>
                  </div>
                  <p class="text-xs text-content-muted">
                    @if (nameMode() === 'full') {
                      El Excel trae el nombre del alumno en una sola columna.
                    } @else {
                      El Excel separa nombres y apellido paterno.
                    }
                  </p>

                  <div class="space-y-2">
                    @for (field of studentPrimaryFields(); track field.key) {
                      <ng-container
                        *ngTemplateOutlet="mapRow; context: { $implicit: field, headers: p.headers }"
                      />
                    }
                  </div>

                  <button
                    type="button"
                    class="flex items-center gap-1.5 text-xs font-medium text-content-muted"
                    (click)="showOptionalStudent.set(!showOptionalStudent())"
                  >
                    <app-icon
                      [name]="showOptionalStudent() ? 'chevron-down' : 'chevron-right'"
                      [size]="14"
                    />
                    Más datos del alumno
                    <span class="font-normal text-content-subtle">opcionales</span>
                  </button>
                  @if (showOptionalStudent()) {
                    <div class="space-y-2">
                      @for (field of studentOptionalFields(); track field.key) {
                        <ng-container
                          *ngTemplateOutlet="mapRow; context: { $implicit: field, headers: p.headers }"
                        />
                      }
                    </div>
                  }
                </section>

                <section class="rounded-lg border border-border-subtle">
                  <div class="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div class="min-w-0">
                      <h3 class="text-sm font-semibold text-content">Apoderado</h3>
                      <p class="text-xs text-content-muted">
                        Solo si el Excel trae al padre o tutor.
                      </p>
                    </div>
                    <button
                      type="button"
                      class="btn btn-outline btn-sm shrink-0"
                      (click)="toggleGuardian()"
                    >
                      {{ guardianSectionOpen() ? 'Quitar' : 'Agregar' }}
                    </button>
                  </div>
                  @if (guardianSectionOpen()) {
                    <div class="space-y-3 border-t border-border-subtle p-3">
                      <div class="flex rounded-md border border-border-subtle p-0.5 text-xs">
                        <button
                          type="button"
                          class="flex-1 rounded px-2.5 py-1"
                          [ngClass]="
                            guardianNameMode() === 'split'
                              ? 'bg-primary/15 font-medium text-primary'
                              : 'text-content-muted'
                          "
                          (click)="setGuardianNameMode('split')"
                        >
                          Nombres y apellido
                        </button>
                        <button
                          type="button"
                          class="flex-1 rounded px-2.5 py-1"
                          [ngClass]="
                            guardianNameMode() === 'full'
                              ? 'bg-primary/15 font-medium text-primary'
                              : 'text-content-muted'
                          "
                          (click)="setGuardianNameMode('full')"
                        >
                          Nombre completo
                        </button>
                      </div>
                      <div class="space-y-2">
                        @for (field of guardianPrimaryFields(); track field.key) {
                          <ng-container
                            *ngTemplateOutlet="mapRow; context: { $implicit: field, headers: p.headers }"
                          />
                        }
                        @for (field of guardianOptionalFields(); track field.key) {
                          <ng-container
                            *ngTemplateOutlet="mapRow; context: { $implicit: field, headers: p.headers }"
                          />
                        }
                      </div>
                    </div>
                  }
                </section>

                @if (unusedHeaders().length > 0) {
                  <p class="text-xs text-content-muted">
                    Sin asignar:
                    {{ unusedHeaders().slice(0, 6).join(', ') }}
                    @if (unusedHeaders().length > 6) {
                      y {{ unusedHeaders().length - 6 }} más
                    }
                  </p>
                }

                @if (p.sampleRows.length > 0) {
                  <button
                    type="button"
                    class="flex items-center gap-1.5 text-xs font-medium text-content-muted"
                    (click)="showPreview.set(!showPreview())"
                  >
                    <app-icon [name]="showPreview() ? 'chevron-down' : 'chevron-right'" [size]="14" />
                    Ver primeras filas del archivo
                  </button>
                  @if (showPreview()) {
                    <div class="overflow-x-auto rounded-md border border-border-subtle">
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
                        Filas con error ({{ j.errors.length }})
                      </p>
                    </header>
                    <ul class="max-h-[28rem] divide-y divide-border-subtle overflow-y-auto">
                      @for (e of j.errors; track e.row + e.code) {
                        <li class="space-y-3 px-3 py-3 text-xs">
                          <div class="flex items-start gap-3">
                            <span class="badge badge-neutral shrink-0">Fila {{ e.row }}</span>
                            <div class="min-w-0 flex-1 space-y-0.5">
                              <p class="text-sm font-medium text-content">
                                {{ e.label || 'Alumno sin nombre en el archivo' }}
                              </p>
                              <p class="text-content">{{ explainRowError(e) }}</p>
                            </div>
                          </div>

                          @if (isRowResolved(e.row)) {
                            <p class="text-xs text-success">
                              Corregido. Este alumno ya quedó registrado.
                            </p>
                          } @else if (e.code === 'GUARDIAN_LINK_FAILED') {
                            <p class="text-xs text-content-muted">
                              El alumno sí se creó. El fallo es solo del apoderado: complétalo
                              desde la ficha del alumno.
                            </p>
                          } @else {
                            <div class="grid gap-2 sm:grid-cols-2">
                              <label class="field">
                                <span class="text-2xs text-content-subtle">Tipo de documento</span>
                                <select
                                  class="select"
                                  [ngModel]="draftValue(e, 'documentType')"
                                  (ngModelChange)="setDraft(e.row, 'documentType', $event)"
                                >
                                  @for (t of documentTypes; track t) {
                                    <option [value]="t">{{ t }}</option>
                                  }
                                </select>
                              </label>
                              <label class="field">
                                <span class="text-2xs text-content-subtle">Número</span>
                                <input
                                  class="input"
                                  [ngModel]="draftValue(e, 'documentNumber')"
                                  (ngModelChange)="setDraft(e.row, 'documentNumber', $event)"
                                />
                              </label>
                              <label class="field">
                                <span class="text-2xs text-content-subtle">Nombres</span>
                                <input
                                  class="input"
                                  [ngModel]="draftValue(e, 'firstName')"
                                  (ngModelChange)="setDraft(e.row, 'firstName', $event)"
                                />
                              </label>
                              <label class="field">
                                <span class="text-2xs text-content-subtle">Apellido</span>
                                <input
                                  class="input"
                                  [ngModel]="draftValue(e, 'lastName')"
                                  (ngModelChange)="setDraft(e.row, 'lastName', $event)"
                                />
                              </label>
                            </div>
                            @if (retryMessage(e.row); as retryErr) {
                              <p class="text-xs text-danger">{{ retryErr }}</p>
                            }
                            <button
                              type="button"
                              class="btn btn-outline btn-sm"
                              [disabled]="retryingRow() === e.row"
                              (click)="retryRow(e)"
                            >
                              @if (retryingRow() === e.row) {
                                <app-spinner [size]="14" />
                              }
                              {{
                                e.code === 'ENROLLMENT_FAILED'
                                  ? 'Reintentar matrícula'
                                  : 'Corregir y reintentar'
                              }}
                            </button>
                          }
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
              @if (confirmBlockers().length > 0) {
                <p
                  id="bulk-confirm-reason"
                  class="mr-auto min-w-0 flex-1 text-xs leading-snug text-content"
                >
                  {{ confirmBlockers().join(' ') }}
                </p>
              }
              <button type="button" class="btn btn-ghost btn-sm" (click)="backToFile()">
                Atrás
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="!canConfirmMapping() || uploading()"
                [attr.aria-describedby]="
                  confirmBlockers().length > 0 ? 'bulk-confirm-reason' : null
                "
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

    <ng-template #mapRow let-field let-headers="headers">
      <div class="grid grid-cols-1 items-center gap-1 sm:grid-cols-[11.5rem_minmax(0,1fr)_7.5rem] sm:gap-3">
        <label class="text-sm text-content" [attr.for]="'map-' + field.key">
          {{ field.label }}
          @if (isRequiredNow(field.key)) {
            <span class="text-danger-500">*</span>
          }
        </label>
        <select
          class="select"
          [id]="'map-' + field.key"
          [ngClass]="isMissing(field.key) ? 'ring-1 ring-danger' : ''"
          [ngModel]="mapping()[field.key] || ''"
          (ngModelChange)="setMapping(field.key, $event)"
        >
          <option value="">{{ isRequiredNow(field.key) ? '— Elegir columna —' : '— No usar —' }}</option>
          @for (h of headers; track h) {
            <option [value]="h" [disabled]="isHeaderTaken(h, field.key)">{{ h }}</option>
          }
        </select>
        <p class="truncate text-xs text-content-subtle" [title]="sampleFor(mapping()[field.key])">
          {{ sampleFor(mapping()[field.key]) }}
        </p>
      </div>
    </ng-template>
  `,
})
export class BulkImportModalComponent implements OnInit {
  protected readonly formProtection = createFormProtection({
    snapshot: () => [this.selectedFile(), this.mapping(), this.sectionMode(), this.sectionUuid(), this.enrolledAt(), this.nameMode(), this.guardianNameMode(), this.includeGuardian(), this.retryDrafts()],
    saving: () => this.uploading() || this.previewing() || this.retryingRow() !== null,
    active: () => true,
  });

  private readonly store = inject(StudentsStore);
  private readonly academicApi = inject(AcademicApiService);
  private readonly auth = inject(AuthService);
  private readonly studentsApi = inject(StudentsApiService);

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
  protected readonly documentTypes = Object.values(DocumentType);
  protected readonly retryDrafts = signal<Record<number, Record<string, string>>>({});
  protected readonly resolvedRows = signal<number[]>([]);
  protected readonly retryingRow = signal<number | null>(null);
  protected readonly retryErrors = signal<Record<number, string>>({});

  constructor() {
    effect(() => {
      const errors = this.job()?.errors ?? [];
      const current = this.retryDrafts();
      const next = { ...current };
      let changed = false;
      for (const error of errors) {
        if (next[error.row]) continue;
        next[error.row] = {
          documentType: error.fields?.['documentType'] || DocumentType.Dni,
          documentNumber: error.fields?.['documentNumber'] || '',
          firstName: error.fields?.['firstName'] || '',
          lastName: error.fields?.['lastName'] || '',
        };
        changed = true;
      }
      if (changed) this.retryDrafts.set(next);
    });
  }

  protected readonly fieldDefs = BULK_IMPORT_FIELD_DEFS;
  /** How the student name is split in the Excel. */
  protected readonly nameMode = signal<NameMode>('split');
  protected readonly guardianNameMode = signal<NameMode>('split');
  /** User asked to map a guardian. Auto-on when the file already has those columns. */
  protected readonly includeGuardian = signal(false);
  protected readonly showOptionalStudent = signal(false);
  protected readonly showPreview = signal(false);

  protected readonly studentPrimaryFields = computed(() => {
    const keys =
      this.nameMode() === 'full'
        ? ['documentType', 'documentNumber', 'fullName']
        : ['documentType', 'documentNumber', 'firstName', 'lastName'];
    return keys.map((key) => this.def(key));
  });

  protected readonly studentOptionalFields = computed(() =>
    STUDENT_OPTIONAL_KEYS.map((key) => this.def(key)),
  );

  protected readonly guardianPrimaryFields = computed(() => {
    const keys =
      this.guardianNameMode() === 'full'
        ? ['guardianDocumentType', 'guardianDocumentNumber', 'guardianFullName']
        : ['guardianDocumentType', 'guardianDocumentNumber', 'guardianFirstName', 'guardianLastName'];
    return keys.map((key) => this.def(key));
  });

  protected readonly guardianOptionalFields = computed(() =>
    GUARDIAN_OPTIONAL_KEYS.map((key) => this.def(key)),
  );

  protected readonly guardianSectionOpen = computed(
    () => this.includeGuardian() || this.anyGuardianMapped(),
  );

  protected readonly unusedHeaders = computed(() => {
    const headers = this.preview()?.headers ?? [];
    const used = new Set(Object.values(this.mapping()).filter((value) => !!value));
    return headers.filter((header) => !used.has(header));
  });

  protected readonly studentGaps = computed(() => {
    const map = this.mapping();
    const gaps: { key: string; label: string }[] = [];
    const push = (key: string) => {
      if (!map[key]) gaps.push({ key, label: this.def(key).label });
    };
    push('documentType');
    push('documentNumber');
    if (this.nameMode() === 'full') {
      push('fullName');
    } else {
      push('firstName');
      push('lastName');
    }
    return gaps;
  });

  protected readonly guardianGaps = computed(() => {
    if (!this.guardianSectionOpen()) return [];
    const map = this.mapping();
    const keys =
      this.guardianNameMode() === 'full'
        ? ['guardianDocumentType', 'guardianDocumentNumber', 'guardianFullName']
        : ['guardianDocumentType', 'guardianDocumentNumber', 'guardianFirstName', 'guardianLastName'];
    return keys
      .filter((key) => !map[key])
      .map((key) => ({ key, label: this.def(key).label }));
  });

  protected readonly confirmBlockers = computed(() => {
    const lines: string[] = [];
    const student = this.studentGaps();
    if (student.length > 0) {
      lines.push(`Falta asignar del alumno: ${student.map((gap) => gap.label).join(', ')}.`);
    }
    const guardian = this.guardianGaps();
    if (guardian.length > 0) {
      lines.push(
        `Falta asignar del apoderado: ${guardian.map((gap) => gap.label).join(', ')}. Si el Excel no lo trae, quítalo.`,
      );
    }
    return lines;
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
        return 'Asigna las columnas del Excel. El apoderado y los datos extra se abren solo si los necesitas.';
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
    this.formProtection.requestClose(() => {
      this.store.clearError();
      this.closed.emit();
    });
  }

  protected restart(): void {
    this.selectedFileName.set(null);
    this.selectedFile.set(null);
    this.preview.set(null);
    this.mapping.set({});
    this.nameMode.set('split');
    this.guardianNameMode.set('split');
    this.includeGuardian.set(false);
    this.showOptionalStudent.set(false);
    this.showPreview.set(false);
    this.retryDrafts.set({});
    this.resolvedRows.set([]);
    this.retryErrors.set({});
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
    this.nameMode.set('split');
    this.guardianNameMode.set('split');
    this.includeGuardian.set(false);
    this.showOptionalStudent.set(false);
    this.showPreview.set(false);
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
      this.detectMappingShape();
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

  protected setNameMode(mode: NameMode): void {
    if (this.nameMode() === mode) return;
    this.nameMode.set(mode);
    const next = { ...this.mapping() };
    if (mode === 'full') {
      delete next['firstName'];
      delete next['lastName'];
    } else {
      delete next['fullName'];
    }
    this.mapping.set(next);
  }

  protected setGuardianNameMode(mode: NameMode): void {
    if (this.guardianNameMode() === mode) return;
    this.guardianNameMode.set(mode);
    const next = { ...this.mapping() };
    if (mode === 'full') {
      delete next['guardianFirstName'];
      delete next['guardianLastName'];
    } else {
      delete next['guardianFullName'];
    }
    this.mapping.set(next);
  }

  protected toggleGuardian(): void {
    if (this.guardianSectionOpen()) {
      this.includeGuardian.set(false);
      const next = { ...this.mapping() };
      for (const field of this.fieldDefs) {
        if (field.group === 'guardian') delete next[field.key];
      }
      this.mapping.set(next);
      return;
    }
    this.includeGuardian.set(true);
  }

  protected isRequiredNow(key: string): boolean {
    if (this.isStudentIdentity(key)) return true;
    return this.guardianSectionOpen() && this.guardianIdentityKeys().includes(key);
  }

  protected isMissing(key: string): boolean {
    return (
      this.studentGaps().some((gap) => gap.key === key) ||
      this.guardianGaps().some((gap) => gap.key === key)
    );
  }

  protected sampleFor(header: string | undefined): string {
    if (!header) return '';
    const rows = this.preview()?.sampleRows ?? [];
    for (const row of rows) {
      const value = row[header];
      if (value) return value;
    }
    return '';
  }

  protected canConfirmMapping(): boolean {
    return this.confirmBlockers().length === 0 && !!this.selectedFile();
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

  private detectMappingShape(): void {
    const map = { ...this.mapping() };
    const hasFull = !!map['fullName'];
    const hasSplit = !!map['firstName'] || !!map['lastName'];
    const studentMode: NameMode = hasFull && !hasSplit ? 'full' : 'split';
    this.nameMode.set(studentMode);
    if (studentMode === 'full') {
      delete map['firstName'];
      delete map['lastName'];
    } else {
      delete map['fullName'];
    }

    const guardianFull = !!map['guardianFullName'];
    const guardianSplit = !!map['guardianFirstName'] || !!map['guardianLastName'];
    const guardianMode: NameMode = guardianFull && !guardianSplit ? 'full' : 'split';
    this.guardianNameMode.set(guardianMode);
    if (guardianMode === 'full') {
      delete map['guardianFirstName'];
      delete map['guardianLastName'];
    } else {
      delete map['guardianFullName'];
    }

    this.mapping.set(map);
    this.includeGuardian.set(this.anyGuardianMapped());
    this.showOptionalStudent.set(STUDENT_OPTIONAL_KEYS.some((key) => !!map[key]));
    this.showPreview.set(false);
  }

  private isStudentIdentity(key: string): boolean {
    if (key === 'documentType' || key === 'documentNumber') return true;
    if (this.nameMode() === 'full') return key === 'fullName';
    return key === 'firstName' || key === 'lastName';
  }

  private guardianIdentityKeys(): string[] {
    return this.guardianNameMode() === 'full'
      ? ['guardianDocumentType', 'guardianDocumentNumber', 'guardianFullName']
      : [
          'guardianDocumentType',
          'guardianDocumentNumber',
          'guardianFirstName',
          'guardianLastName',
        ];
  }

  private def(key: string): BulkImportFieldDef {
    const found = this.fieldDefs.find((field) => field.key === key);
    if (!found) {
      throw new Error(`Unknown bulk-import field: ${key}`);
    }
    return found;
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

  protected explainRowError(error: BulkImportRowError): string {
    switch (error.code) {
      case 'STUDENT_DOCUMENT_TAKEN':
        return 'Ese documento ya está registrado. Cámbialo si es otro alumno, o déjalo si ya existe.';
      case 'STUDENT_EMAIL_TAKEN':
        return 'Ese correo ya pertenece a otro alumno.';
      case 'ROW_DUPLICATE':
        return 'El documento o el correo está repetido en el mismo archivo.';
      case 'ENROLLMENT_FAILED':
        return 'El alumno se creó, pero no se pudo matricular en la sección.';
      case 'GUARDIAN_LINK_FAILED':
        return 'El alumno se creó, pero no se pudo vincular al apoderado.';
      case 'ROW_INVALID':
        return this.explainInvalidRow(error.message);
      default:
        return error.message;
    }
  }

  protected isRowResolved(row: number): boolean {
    return this.resolvedRows().includes(row);
  }

  protected retryMessage(row: number): string | null {
    return this.retryErrors()[row] ?? null;
  }

  protected draftValue(error: BulkImportRowError, key: string): string {
    return this.retryDrafts()[error.row]?.[key]
      ?? error.fields?.[key]
      ?? (key === 'documentType' ? DocumentType.Dni : '');
  }

  protected setDraft(row: number, key: string, value: string): void {
    const current = this.retryDrafts()[row] ?? {};
    this.retryDrafts.set({
      ...this.retryDrafts(),
      [row]: { ...current, [key]: value },
    });
  }

  protected async retryRow(error: BulkImportRowError): Promise<void> {
    this.retryingRow.set(error.row);
    const errors = { ...this.retryErrors() };
    delete errors[error.row];
    this.retryErrors.set(errors);
    try {
      let studentId = error.fields?.['studentPublicUuid'];
      if (error.code !== 'ENROLLMENT_FAILED') {
        const draft = this.retryDrafts()[error.row] ?? {};
        const created = await firstValueFrom(
          this.studentsApi.create({
            documentType: (draft['documentType'] || DocumentType.Dni) as DocumentType,
            documentNumber: (draft['documentNumber'] || '').trim(),
            firstName: (draft['firstName'] || '').trim(),
            lastName: (draft['lastName'] || '').trim(),
            enrollmentStatus:
              this.sectionMode() === 'section' ? EnrollmentStatus.Enrolled : EnrollmentStatus.Pending,
          }),
        );
        studentId = created.publicUuid;
      }
      const year = this.activeYear();
      if (this.sectionMode() === 'section' && this.sectionUuid() && year && studentId) {
        await firstValueFrom(
          this.studentsApi.createEnrollment(studentId, {
            sectionPublicUuid: this.sectionUuid(),
            academicYearPublicUuid: year.publicUuid,
            enrolledAt: this.enrolledAt() || this.toIsoDate(new Date()),
            notes: 'reintento importación',
          }),
        );
      }
      this.resolvedRows.set([...this.resolvedRows(), error.row]);
    } catch (err) {
      this.retryErrors.set({
        ...this.retryErrors(),
        [error.row]: this.readApiError(err),
      });
    } finally {
      this.retryingRow.set(null);
    }
  }

  private explainInvalidRow(message: string): string {
    const text = message.toLowerCase();
    if (text.includes('documenttype')) {
      return 'Falta el tipo de documento, o no es DNI, CE, PASSPORT u OTHER.';
    }
    if (text.includes('8 digit') || text.includes('exactly 8')) {
      return 'El DNI debe tener exactamente 8 dígitos.';
    }
    if (text.includes('documentnumber')) {
      return 'El número de documento está vacío o no tiene un formato válido.';
    }
    if (text.includes('firstname') || text.includes('lastname')) {
      return 'Faltan el nombre o el apellido.';
    }
    if (text.includes('apoderado') || text.includes('guardian')) {
      return 'El apoderado está incompleto. Corrige al alumno y vuelve a intentar, o impórtalo sin apoderado.';
    }
    return message;
  }

  private readApiError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { message?: string; error?: { message?: string } } | null;
      return body?.error?.message || body?.message || 'No se pudo reintentar esta fila.';
    }
    return 'No se pudo reintentar esta fila.';
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

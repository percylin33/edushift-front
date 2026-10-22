import { createFormProtection } from '@shared/services/form-protection.service';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import { IconComponent } from '@shared/components';
import {
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_SIZE_LABEL,
  Submission,
  SubmissionStatus,
  canResubmit,
} from '../../models';

/**
 * Form de entrega para STUDENT/PARENT (FE-7a.2 Scenario 1).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Textarea con {@code textContent} (max 5000 chars).</li>
 *   <li>{@code <input type="file">} con whitelist MIME + límite
 *       {@code MAX_ATTACHMENT_SIZE_BYTES} (25 MB).</li>
 *   <li>Progress bar nativa mientras la subida avanza (signals
 *       del {@code SubmissionsStore}).</li>
 *   <li>Para PARENT con varios hijos: campo opcional
 *       {@code submittedForStudentPublicUuid} (MVP — el selector
 *       rico de hijos llega como ticket explícito en el card del
 *       sprint).</li>
 *   <li>Si la submission ya existe, precarga el form (modo re-entrega
 *       cuando {@code canResubmit} es true).</li>
 * </ul>
 *
 * <h3>A11y</h3>
 * La progress bar lleva {@code aria-live="polite"} para que lectores
 * de pantalla anuncien el avance sin interrumpir.
 */
@Component({
  selector: 'app-submission-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card overflow-hidden">
      <header class="flex flex-wrap items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
        <div>
          <h2 class="text-xl font-semibold text-content">Tu entrega</h2>
          <p class="mt-1 max-w-xl text-sm text-content-muted">
            @if (existingSubmission) {
              @if (canResubmitNow()) {
                Puedes actualizar tu trabajo y volver a enviarlo.
              } @else {
                Ya entregaste. Esta tarea no permite re-entregas.
              }
            } @else {
              Completa el formulario y adjunta tu archivo para registrar la entrega.
            }
          </p>
        </div>
        <span
          class="rounded-full border px-3 py-1 text-xs font-medium"
          [class.border-amber-200]="!existingSubmission"
          [class.bg-amber-50]="!existingSubmission"
          [class.text-amber-800]="!existingSubmission"
          [class.border-sky-200]="!!existingSubmission"
          [class.bg-sky-50]="!!existingSubmission"
          [class.text-sky-800]="!!existingSubmission"
        >
          {{ existingSubmission ? statusLabel(existingSubmission.status) : 'Pendiente' }}
        </span>
      </header>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="grid gap-6 px-5 py-6 sm:px-7">
        @if (errorBanner(); as err) {
          <div class="alert alert-danger" role="alert">
            <app-icon name="alert-circle" [size]="18" />
            <p class="text-sm">{{ err }}</p>
          </div>
        }

        <div>
          <div class="mb-2 flex items-center justify-between gap-3">
            <label class="text-sm font-semibold text-content" for="sub-text">
              Texto de la entrega o comentario
            </label>
            <span class="text-xs text-content-muted">
              {{ form.get('textContent')?.value?.length ?? 0 }} / 5000 caracteres
            </span>
          </div>
          <textarea
            id="sub-text"
            class="input min-h-[190px] resize-y rounded-xl border-border bg-surface px-4 py-3 leading-6 placeholder:text-content-subtle focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
            rows="7"
            maxlength="5000"
            formControlName="textContent"
            placeholder="Escribe aquí tu respuesta, enlace de Google Drive / OneDrive o notas adicionales para el profesor…"
          ></textarea>
          @if (showError('textContent'); as msg) {
            <p class="field-error">{{ msg }}</p>
          } @else {
            <p class="mt-2 text-xs text-content-muted">Opcional si adjuntas un archivo con el contenido principal.</p>
          }
        </div>

        <div>
          <div class="mb-2 flex items-center justify-between gap-3">
            <label class="text-sm font-semibold text-content" for="sub-file">Archivo adjunto</label>
            <span class="text-xs text-content-muted">Máximo {{ maxSizeLabel }}</span>
          </div>
          <label
            for="sub-file"
            class="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface-muted/40 px-5 py-7 text-center transition hover:border-primary-500 hover:bg-primary/5 focus-within:ring-2 focus-within:ring-primary-500/30"
            (dragover)="$event.preventDefault()"
            (drop)="onFileDrop($event)"
          >
            <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <app-icon name="upload" [size]="22" />
            </span>
            <span class="text-sm font-semibold text-content">
              Arrastra tu archivo aquí o <span class="text-primary underline">explora en tu equipo</span>
            </span>
            <span class="mt-1 text-xs text-content-muted">
              PDF, imágenes, Word, Excel, TXT o Markdown
            </span>
            <input
              id="sub-file"
              type="file"
              class="sr-only"
              accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.md"
              (change)="onFileChange($event)"
            />
          </label>
          @if (selectedFile(); as file) {
            <div class="mt-2 flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary/5 px-4 py-3">
              <div class="flex min-w-0 items-center gap-3">
                <span class="rounded-lg bg-surface px-2 py-1 text-xs font-bold uppercase text-primary">{{ fileExtension(file.name) }}</span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium text-content">{{ file.name }}</p>
                  <p class="text-xs text-content-muted">{{ formatSize(file.size) }} · Listo para subir</p>
                </div>
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-sm shrink-0"
                aria-label="Quitar archivo adjunto"
                (click)="clearFile()"
              >
                Quitar
              </button>
            </div>
          } @else {
            <p class="mt-2 text-xs text-content-muted">Formatos permitidos: PDF, imágenes, Word, Excel, TXT y Markdown.</p>
          }
          @if (fileError(); as fileErrorMessage) {
            <p class="mt-2 text-sm text-danger" role="alert">{{ fileErrorMessage }}</p>
          }
        </div>

        @if (isParent() && showStudentUuidField()) {
          <div class="field">
            <label class="label" for="sub-for">Entregar para</label>
            <input
              id="sub-for"
              type="text"
              class="input"
              formControlName="submittedForStudentPublicUuid"
              placeholder="UUID del hijo"
            />
            <p class="field-hint">Abre esta pantalla desde Familia para no pegar el UUID a mano.</p>
          </div>
        }

        @if (uploadingSig()) {
          <div role="status" aria-live="polite">
            <div class="flex items-center justify-between text-xs text-content-muted">
              <span>Subiendo…</span>
              <span>{{ uploadPercentSig() }}%</span>
            </div>
            <progress class="progress" [value]="uploadPercentSig()" max="100"></progress>
          </div>
        }

        <div class="flex items-start gap-3 rounded-xl border border-border bg-surface-muted/50 p-4 text-sm text-content-muted">
          <app-icon name="info" [size]="18" />
          <p>Al entregar, se registrarán la fecha y hora oficiales. Podrás reemplazar tu trabajo hasta la fecha límite si se permiten re-entregas.</p>
        </div>

        <footer class="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
          <button
            type="submit"
            class="btn btn-primary min-h-12 px-6"
            [disabled]="form.invalid || uploadingSig() || (existingSubmission && !canResubmitNow())"
          >
            @if (uploadingSig()) {
              <app-icon name="refresh" [size]="16" class="animate-spin" />
              <span>Subiendo {{ uploadPercentSig() }}%</span>
            } @else {
              <app-icon name="upload" [size]="16" />
              <span>{{ existingSubmission ? 'Re-entregar tarea' : 'Entregar tarea' }}</span>
            }
          </button>
        </footer>
      </form>
    </section>
  `,
})
export class SubmissionFormComponent implements OnChanges {
  protected readonly formProtection = createFormProtection({
    snapshot: () => [this.form.getRawValue(), this.selectedFile()],
    saving: () => this.uploading,
    active: () => true,
  });

  @Input({ required: true }) assignmentUuid!: string;
  @Input() existingSubmission: Submission | null = null;
  @Input() allowResubmissions = false;
  @Input() errorMessage: string | null = null;
  @Input() uploading = false;
  @Input() uploadPercent = 0;
  /** When set (query from Familia or STUDENT profile), the raw UUID field is hidden. */
  @Input() studentPublicUuid: string | null = null;

  @Output() readonly submitCreate = new EventEmitter<{
    textContent: string | null;
    attachment: File | null;
    submittedForStudentPublicUuid: string | null;
    studentPublicUuid: string | null;
  }>();
  @Output() readonly submitUpdate = new EventEmitter<{
    textContent: string | null;
    attachment: File | null;
  }>();

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly maxSizeLabel = MAX_ATTACHMENT_SIZE_LABEL;

  protected readonly existingSig = signal<Submission | null>(null);
  protected readonly errorBanner = signal<string | null>(null);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly uploadingSig = signal(false);
  protected readonly uploadPercentSig = signal(0);

  protected readonly form: FormGroup = this.fb.group({
    textContent: ['', [Validators.maxLength(5000)]],
    submittedForStudentPublicUuid: ['', []],
  });

  protected readonly isParent = computed(() => this.auth.hasRole(UserRole.Parent));

  protected readonly studentUuidSig = signal<string | null>(null);

  protected readonly canResubmitNow = computed(() => {
    const e = this.existingSig();
    if (!e) return false;
    return canResubmit(e.status, this.allowResubmissions);
  });

  protected readonly showStudentUuidField = computed(
    () => this.isParent() && !this.studentUuidSig(),
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingSubmission']) {
      this.existingSig.set(this.existingSubmission);
      if (this.existingSubmission) {
        this.form.patchValue({
          textContent: this.existingSubmission.textContent ?? '',
          submittedForStudentPublicUuid:
            this.existingSubmission.submittedForStudentPublicUuid ?? '',
        });
      }
    }
    if (changes['errorMessage']) {
      this.errorBanner.set(this.errorMessage);
    }
    if (changes['uploading']) {
      this.uploadingSig.set(this.uploading);
    }
    if (changes['uploadPercent']) {
      this.uploadPercentSig.set(this.uploadPercent);
    }
    if (changes['studentPublicUuid']) {
      this.studentUuidSig.set(this.studentPublicUuid);
    }
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      this.selectedFile.set(null);
      this.fileError.set(null);
      return;
    }
    const err = validateFile(file);
    if (err) {
      this.fileError.set(err);
      this.selectedFile.set(null);
      input.value = '';
      return;
    }
    this.fileError.set(null);
    this.selectedFile.set(file);
  }

  protected onFileDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      this.fileError.set(err);
      this.selectedFile.set(null);
      return;
    }
    this.fileError.set(null);
    this.selectedFile.set(file);
  }

  protected clearFile(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected fileExtension(filename: string): string {
    const extension = filename.split('.').pop()?.trim();
    return extension && extension !== filename ? extension.slice(0, 4) : 'FILE';
  }

  protected statusLabel(status: SubmissionStatus): string {
    switch (status) {
      case SubmissionStatus.Graded:
        return 'Calificada';
      case SubmissionStatus.Returned:
        return 'Devuelta';
      case SubmissionStatus.Late:
        return 'Entregada tarde';
      case SubmissionStatus.Submitted:
        return 'Entregada';
      default:
        return 'Pendiente';
    }
  }

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl || (!ctrl.touched && !ctrl.dirty)) return null;
    if (ctrl.errors?.['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    return null;
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.fileError()) {
      this.errorBanner.set(this.fileError());
      return;
    }
    const v = this.form.getRawValue();
    const text = (v.textContent ?? '').toString().trim() || null;
    const submittedFor =
      this.studentUuidSig() ||
      (v.submittedForStudentPublicUuid ?? '').toString().trim() ||
      null;
    const file = this.selectedFile();

    if (!text && !file) {
      this.errorBanner.set('Completa el texto o adjunta un archivo.');
      return;
    }

    this.errorBanner.set(null);

    if (this.existingSig()) {
      this.submitUpdate.emit({ textContent: text, attachment: file });
    } else {
      this.submitCreate.emit({
        textContent: text,
        attachment: file,
        submittedForStudentPublicUuid: submittedFor,
        studentPublicUuid: submittedFor,
      });
    }
  }
}

/**
 * Client-side validator para adjuntos. Devuelve un mensaje listo
 * para mostrar o {@code null} si el archivo pasa el filtro.
 */
function validateFile(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `El archivo supera el máximo permitido (${MAX_ATTACHMENT_SIZE_LABEL}).`;
  }
  if (!ALLOWED_ATTACHMENT_MIME.includes(file.type)) {
    return `Tipo de archivo no permitido (${file.type || 'desconocido'}).`;
  }
  return null;
}

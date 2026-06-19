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
  signal
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { UserRole } from '@core/enums';
import { AuthService } from '@core/services';
import {
  IconComponent
} from '@shared/components';
import {
  ALLOWED_ATTACHMENT_MIME,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENT_SIZE_LABEL,
  Submission,
  canResubmit
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
    <section class="card">
      <header class="card-header">
        <h2 class="card-title">Tu entrega</h2>
        <p class="card-description">
          @if (existingSubmission) {
            @if (canResubmitNow()) {
              Ya tienes una entrega. Si la tarea permite re-entregas,
              puedes reemplazarla.
            } @else {
              Ya entregaste. Esta tarea no permite re-entregas.
            }
          } @else {
            Completa el formulario y adjunta un archivo (opcional) para
            registrar tu entrega.
          }
        </p>
      </header>

      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        class="card-body grid gap-4"
      >
        @if (errorBanner(); as err) {
          <div class="alert alert-danger" role="alert">
            <app-icon name="alert-circle" [size]="18" />
            <p class="text-sm">{{ err }}</p>
          </div>
        }

        <div class="field">
          <label class="label" for="sub-text">Texto de la entrega</label>
          <textarea
            id="sub-text"
            class="input min-h-[120px]"
            rows="5"
            formControlName="textContent"
            placeholder="Escribe tu respuesta…"
          ></textarea>
          @if (showError('textContent'); as msg) {
            <p class="field-error">{{ msg }}</p>
          } @else {
            <p class="field-hint">
              Opcional si adjuntas archivo. Hasta 5000 caracteres.
            </p>
          }
        </div>

        <div class="field">
          <label class="label" for="sub-file">Archivo adjunto</label>
          <input
            id="sub-file"
            type="file"
            class="input"
            accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.md"
            (change)="onFileChange($event)"
          />
          @if (selectedFile(); as file) {
            <p class="field-hint">
              {{ file.name }} · {{ formatSize(file.size) }}
              <button
                type="button"
                class="ml-2 underline"
                (click)="clearFile()"
              >
                Quitar
              </button>
            </p>
          } @else {
            <p class="field-hint">
              Formatos: PDF, imágenes, Word, Excel, txt, md. Máx
              {{ maxSizeLabel }}.
            </p>
          }
        </div>

        @if (isParent() && showSubmittedFor()) {
          <div class="field">
            <label class="label" for="sub-for">Entregar para (opcional)</label>
            <input
              id="sub-for"
              type="text"
              class="input"
              formControlName="submittedForStudentPublicUuid"
              placeholder="UUID del hijo (selector rico pendiente)"
            />
            <p class="field-hint">
              MVP: pega el UUID del hijo. La UI de selector múltiple
              queda como ticket explícito en el card de FE-7a.2.
            </p>
          </div>
        }

        @if (uploadingSig()) {
          <div role="status" aria-live="polite">
            <div class="flex items-center justify-between text-xs text-content-muted">
              <span>Subiendo…</span>
              <span>{{ uploadPercentSig() }}%</span>
            </div>
            <progress
              class="progress"
              [value]="uploadPercentSig()"
              max="100"
            ></progress>
          </div>
        }

        <footer class="flex flex-wrap items-center justify-end gap-2">
          <button
            type="submit"
            class="btn btn-primary btn-sm"
            [disabled]="form.invalid || uploadingSig() || (existingSubmission && !canResubmitNow())"
          >
            <app-icon name="upload" [size]="16" />
            <span>{{ existingSubmission ? 'Re-entregar' : 'Entregar' }}</span>
          </button>
        </footer>
      </form>
    </section>
  `
})
export class SubmissionFormComponent implements OnChanges {
  @Input({ required: true }) assignmentUuid!: string;
  @Input() existingSubmission: Submission | null = null;
  @Input() allowResubmissions = false;
  @Input() errorMessage: string | null = null;
  @Input() uploading = false;
  @Input() uploadPercent = 0;

  @Output() readonly submitCreate = new EventEmitter<{
    textContent: string | null;
    attachment: File | null;
    submittedForStudentPublicUuid: string | null;
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
    submittedForStudentPublicUuid: ['', []]
  });

  protected readonly isParent = computed(() => this.auth.hasRole(UserRole.Guardian));

  protected readonly canResubmitNow = computed(() => {
    const e = this.existingSig();
    if (!e) return false;
    return canResubmit(e.status, this.allowResubmissions);
  });

  protected readonly showSubmittedFor = signal(true);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['existingSubmission']) {
      this.existingSig.set(this.existingSubmission);
      if (this.existingSubmission) {
        this.form.patchValue({
          textContent: this.existingSubmission.textContent ?? '',
          submittedForStudentPublicUuid:
            this.existingSubmission.submittedForStudentPublicUuid ?? ''
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

  protected clearFile(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    const submittedFor = (v.submittedForStudentPublicUuid ?? '').toString().trim() || null;
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
        submittedForStudentPublicUuid: submittedFor
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

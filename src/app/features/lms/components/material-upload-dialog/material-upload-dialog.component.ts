import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FocusTrap } from '@shared/a11y';
import { IconComponent } from '@shared/components';
import {
  ALLOWED_FILE_MIME,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
  CreateMaterialRequest,
  MaterialType,
  inferMaterialTypeFromMime,
  isFileMaterial,
  materialTypeLabel,
} from '../../models';

/**
 * Dialog de upload (FE-7a.3 Scenario 1).
 *
 * <h3>Modos</h3>
 * El form adapta su shape según el {@code type} elegido:
 * <ul>
 *   <li>{@code type=LINK} → input URL (requerido, `Validators.pattern`
 *       para http(s)).</li>
 *   <li>Cualquier otro tipo → {@code <input type="file">} con whitelist
 *       MIME + límite de tamaño.</li>
 * </ul>
 *
 * <h3>Progress</h3>
 * Cuando el padre llama a {@code materials.store.upload()}, emite
 * {@code progress} con el porcentaje actual. La page bindea este
 * signal al {@code <progress>} del dialog.
 *
 * <h3>A11y</h3>
 * Focus trap en apertura (reusamos {@link FocusTrap}); cierre con
 * {@code Esc}; click-backdrop deshabilitado (decisión explícita).
 */
@Component({
  selector: 'app-material-upload-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-upload-title"
        (click)="onBackdrop($event)"
      >
        <div #dialog class="card w-full max-w-md" (click)="$event.stopPropagation()">
          <header class="card-header">
            <h2 id="material-upload-title" class="card-title">Subir material</h2>
            <p class="card-description">
              Sube un archivo o un enlace externo. Máximo
              {{ maxSizeLabel }} por archivo.
            </p>
          </header>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="card-body grid gap-4">
            <div class="field">
              <label class="label" for="material-title">Título *</label>
              <input
                id="material-title"
                type="text"
                class="input"
                formControlName="title"
                placeholder="Tema 1 — Ecuaciones lineales"
                autocomplete="off"
              />
              @if (showError('title'); as msg) {
                <p class="field-error">{{ msg }}</p>
              } @else {
                <p class="field-hint">Entre 3 y 200 caracteres.</p>
              }
            </div>

            <div class="field">
              <label class="label" for="material-type">Tipo *</label>
              <select
                id="material-type"
                class="select"
                formControlName="type"
                (change)="onTypeChange()"
              >
                @for (t of typeOptions; track t) {
                  <option [ngValue]="t">{{ typeLabel(t) }}</option>
                }
              </select>
            </div>

            @if (isLinkSelected()) {
              <div class="field">
                <label class="label" for="material-url">URL *</label>
                <input
                  id="material-url"
                  type="url"
                  class="input"
                  formControlName="url"
                  placeholder="https://ejemplo.com/recurso"
                  autocomplete="off"
                />
                @if (showError('url'); as msg) {
                  <p class="field-error">{{ msg }}</p>
                } @else {
                  <p class="field-hint">Enlace externo (Khan Academy, YouTube, blog, …).</p>
                }
              </div>
            } @else {
              <div class="field">
                <label class="label" for="material-file">Archivo *</label>
                <input
                  id="material-file"
                  type="file"
                  class="input"
                  (change)="onFileChange($event)"
                />
                @if (selectedFile(); as file) {
                  <p class="field-hint">
                    {{ file.name }} · {{ formatSize(file.size) }}
                    <button type="button" class="ml-2 underline" (click)="clearFile()">
                      Quitar
                    </button>
                  </p>
                } @else {
                  <p class="field-hint">
                    Formatos: PDF, imágenes, Office, txt, zip. Máx
                    {{ maxSizeLabel }}.
                  </p>
                }
                @if (fileError(); as err) {
                  <p class="field-error">{{ err }}</p>
                }
              </div>
            }

            @if (uploading) {
              <div role="status" aria-live="polite">
                <div class="flex items-center justify-between text-xs text-content-muted">
                  <span>Subiendo…</span>
                  <span>{{ uploadPercent }}%</span>
                </div>
                <progress class="progress" [value]="uploadPercent" max="100"></progress>
              </div>
            }

            <footer class="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                (click)="onCancel()"
                [disabled]="uploading"
              >
                Cancelar
              </button>
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                [disabled]="form.invalid || uploading"
              >
                <app-icon name="upload" [size]="16" />
                Subir
              </button>
            </footer>
          </form>
        </div>
      </div>
    }
  `,
})
export class MaterialUploadDialogComponent implements OnChanges, OnInit, OnDestroy {
  @Input() open = false;
  @Input() uploading = false;
  @Input() uploadPercent = 0;
  @Input() errorMessage: string | null = null;

  @Output() readonly submitted = new EventEmitter<CreateMaterialRequest>();
  @Output() readonly dialogClosed = new EventEmitter<void>();

  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLElement>;

  private readonly fb = inject(FormBuilder);
  private readonly focusTrap = inject(FocusTrap);

  protected readonly maxSizeLabel = MAX_FILE_SIZE_LABEL;
  protected readonly typeOptions: MaterialType[] = [
    MaterialType.Pdf,
    MaterialType.Image,
    MaterialType.Doc,
    MaterialType.Link,
    MaterialType.Other,
  ];

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  protected readonly form: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    type: [MaterialType.Pdf as MaterialType, [Validators.required]],
    url: ['', [Validators.pattern(/^https?:\/\//)]],
  });

  private previouslyFocused: HTMLElement | null = null;
  private readonly escapeHandler = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.open) this.onCancel();
  };

  ngOnInit(): void {
    document.addEventListener('keydown', this.escapeHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.escapeHandler);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.previouslyFocused = document.activeElement as HTMLElement | null;
        queueMicrotask(() => {
          const root = this.dialogRef?.nativeElement;
          if (root) this.focusTrap.activate(root);
        });
        this.form.reset({
          title: '',
          type: MaterialType.Pdf,
          url: '',
        });
        this.selectedFile.set(null);
        this.fileError.set(null);
      } else if (this.previouslyFocused) {
        this.focusTrap.deactivate();
        this.previouslyFocused.focus();
        this.previouslyFocused = null;
      }
    }
  }

  protected typeLabel(type: MaterialType): string {
    return materialTypeLabel(type);
  }

  protected isLinkSelected(): boolean {
    return this.form.get('type')?.value === MaterialType.Link;
  }

  protected onTypeChange(): void {
    this.selectedFile.set(null);
    this.fileError.set(null);
    if (this.isLinkSelected()) {
      this.form
        .get('url')!
        .setValidators([Validators.required, Validators.pattern(/^https?:\/\//)]);
    } else {
      this.form.get('url')!.setValidators([Validators.pattern(/^https?:\/\//)]);
    }
    this.form.get('url')!.updateValueAndValidity();
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
    // Auto-inferir type si el usuario aún no lo tocó.
    const typeCtrl = this.form.get('type');
    if (typeCtrl && (typeCtrl.value === MaterialType.Pdf || typeCtrl.dirty === false)) {
      typeCtrl.setValue(inferMaterialTypeFromMime(file.type), { emitEvent: false });
    }
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

  protected onBackdrop(event: MouseEvent): void {
    event.preventDefault();
  }

  protected onCancel(): void {
    this.dialogClosed.emit();
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.fileError()) {
      return;
    }
    const v = this.form.getRawValue();
    const type = v.type as MaterialType;
    const request: CreateMaterialRequest = {
      title: (v.title ?? '').toString().trim(),
      type,
      file: isFileMaterial(type) ? this.selectedFile() : null,
      url: type === MaterialType.Link ? (v.url ?? '').toString().trim() : null,
    };
    this.submitted.emit(request);
  }

  protected showError(controlName: string): string | null {
    const ctrl = this.form.get(controlName);
    if (!ctrl || (!ctrl.touched && !ctrl.dirty)) return null;
    if (ctrl.errors?.['required']) return 'Campo requerido.';
    if (ctrl.errors?.['minlength']) {
      return `Mínimo ${ctrl.errors['minlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors?.['maxlength']) {
      return `Máximo ${ctrl.errors['maxlength'].requiredLength} caracteres.`;
    }
    if (ctrl.errors?.['pattern']) return 'URL inválida. Debe comenzar con http(s)://';
    return null;
  }
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `El archivo supera el máximo permitido (${MAX_FILE_SIZE_LABEL}).`;
  }
  if (!ALLOWED_FILE_MIME.includes(file.type)) {
    return `Tipo de archivo no permitido (${file.type || 'desconocido'}).`;
  }
  return null;
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { ApiResponse } from '../../../core/models';
import { FileUploadService, FileMetadata } from '../../../core/services/file-upload.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Module-shaped response from the BE {@code POST /api/v1/users/me/avatar}
 * (and any other module-specific upload endpoint that wraps
 * {@code POST /api/v1/files}).
 */
export interface ModuleUploadResponse {
  publicUuid: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

/**
 * Reusable drop-or-click file picker that uploads via {@link FileUploadService}.
 *
 * <p>Behaviour:</p>
 * <ul>
 *   <li>Drag a file onto the area, or click to open the native file picker.</li>
 *   <li>On drop / select, validates MIME + size against the inputs.</li>
 *   <li>On accept, calls {@link FileUploadService#upload} (signed-URL flow on
 *       FIREBASE, multipart on LOCAL_FS) and surfaces the result via
 *       {@link uploaded}.</li>
 *   <li>Exposes {@link progress} (0..100) and {@link uploading} signals so the
 *       parent can render a progress bar.</li>
 * </ul>
 *
 * <h3>Inputs</h3>
 * <ul>
 *   <li>{@code module} — logical bucket name passed to the storage provider
 *       ({@code "avatars"}, {@code "materials"}, …).</li>
 *   <li>{@code accept} — comma-separated MIME types (e.g.
 *       {@code "image/png,image/jpeg,image/webp"}). Empty = accept anything.</li>
 *   <li>{@code maxSizeMb} — hard cap in megabytes. Default 25 (matches the
 *       server-side {@code app.storage.max-file-size-bytes} default).</li>
 *   <li>{@code endpoint} — override target URL. When unset, uploads go through
 *       the generic {@code POST /api/v1/files} endpoint. Use this when a
 *       module-specific endpoint (e.g. {@code POST /api/v1/users/me/avatar})
 *       is preferred — pass the full URL.</li>
 *   <li>{@code compact} — render the smaller variant suited for an avatar slot
 *       in a profile page.</li>
 *   <li>{@code disabled} — disables all interactions.</li>
 * </ul>
 *
 * <h3>Outputs</h3>
 * <ul>
 *   <li>{@code uploaded} — fired after a successful upload with the file
 *       metadata.</li>
 *   <li>{@code uploadError} — fired with the error string on failure.</li>
 *   <li>{@code fileSelected} — fired with the raw {@link File} right after the
 *       user picks/drops one, before validation or upload.</li>
 * </ul>
 */
@Component({
  selector: 'app-file-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent],
  template: `
    <div
      class="upload-zone"
      [class.upload-zone--compact]="compact()"
      [class.upload-zone--dragging]="dragging()"
      [class.upload-zone--uploading]="uploading()"
      [class.upload-zone--error]="!!error()"
      [class.upload-zone--disabled]="disabled()"
      role="button"
      tabindex="0"
      (click)="triggerPicker()"
      (keydown.enter)="triggerPicker()"
      (keydown.space)="triggerPicker(); $event.preventDefault()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <input
        #picker
        type="file"
        class="upload-zone__native"
        [attr.accept]="accept() || null"
        [attr.aria-hidden]="true"
        [attr.tabindex]="-1"
        (change)="onPickerChange($event)"
      />

      <div class="upload-zone__content">
        @if (uploading()) {
          <app-icon name="upload" [size]="32" />
          <p class="upload-zone__title">Subiendo… {{ progress() }}%</p>
          <progress
            class="upload-zone__progress"
            max="100"
            [value]="progress()"
            aria-label="Progreso de subida"
          ></progress>
        } @else if (error()) {
          <app-icon name="alert-circle" [size]="32" />
          <p class="upload-zone__title upload-zone__title--error">No se pudo subir el archivo</p>
          <p class="upload-zone__subtitle">{{ error() }}</p>
        } @else {
          <app-icon [name]="compact() ? 'image' : 'upload'" [size]="compact() ? 24 : 40" />
          @if (compact()) {
            <p class="upload-zone__title">Cambiar</p>
          } @else {
            <p class="upload-zone__title">Arrastra un archivo o haz clic para seleccionar</p>
            <p class="upload-zone__subtitle">
              @if (accept()) {
                Formatos: {{ accept() }}.
              }
              Tamaño máximo: {{ maxSizeMb() }} MB.
            </p>
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .upload-zone {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 160px;
        padding: 1.5rem;
        border: 2px dashed var(--color-border, #cbd5e1);
        border-radius: 0.75rem;
        background: var(--color-surface-2, #f8fafc);
        color: var(--color-fg-muted, #475569);
        cursor: pointer;
        transition:
          border-color 120ms ease,
          background-color 120ms ease;
      }
      .upload-zone:hover,
      .upload-zone:focus-visible {
        border-color: var(--color-primary, #3b82f6);
        outline: none;
      }
      .upload-zone--compact {
        min-height: 0;
        padding: 0.5rem 0.75rem;
        border-radius: 9999px;
      }
      .upload-zone--dragging {
        border-color: var(--color-primary, #3b82f6);
        background: var(--color-primary-soft, #dbeafe);
      }
      .upload-zone--uploading {
        border-color: var(--color-primary, #3b82f6);
        background: var(--color-surface-3, #eff6ff);
        cursor: wait;
      }
      .upload-zone--error {
        border-color: var(--color-danger, #dc2626);
        background: var(--color-danger-soft, #fee2e2);
      }
      .upload-zone--disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .upload-zone__native {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
      .upload-zone__content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        text-align: center;
      }
      .upload-zone__title {
        margin: 0;
        font-weight: 600;
        color: var(--color-fg, #0f172a);
      }
      .upload-zone__title--error {
        color: var(--color-danger, #dc2626);
      }
      .upload-zone__subtitle {
        margin: 0;
        font-size: 0.875rem;
      }
      .upload-zone__progress {
        width: 100%;
        max-width: 320px;
        height: 8px;
      }
    `,
  ],
})
export class FileUploadComponent {
  private readonly fileUpload = inject(FileUploadService);
  private readonly http = inject(HttpClient);

  /** Logical bucket name → POST /api/v1/files?module=... */
  readonly module = input.required<string>();
  readonly accept = input<string>('');
  readonly maxSizeMb = input<number>(25);
  readonly endpoint = input<string>('');
  readonly compact = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  readonly uploaded = new EventEmitter<FileMetadata | ModuleUploadResponse>();
  readonly uploadError = new EventEmitter<string>();
  readonly fileSelected = new EventEmitter<File>();

  readonly uploading = signal(false);
  readonly progress = signal(0);
  readonly error = signal<string | null>(null);
  readonly dragging = signal(false);

  /** Allowed MIME list parsed once for fast lookup. */
  private readonly allowedMimes = computed(() =>
    this.accept()
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );

  @ViewChild('picker', { static: true })
  private readonly picker!: ElementRef<HTMLInputElement>;

  triggerPicker(): void {
    if (this.disabled() || this.uploading()) return;
    this.picker.nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    if (this.disabled() || this.uploading()) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);
    if (this.disabled() || this.uploading()) return;
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handle(file);
  }

  onPickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handle(file);
    input.value = '';
  }

  private handle(file: File): void {
    this.error.set(null);
    this.fileSelected.emit(file);

    const validationError = this.validate(file);
    if (validationError) {
      this.error.set(validationError);
      this.uploadError.emit(validationError);
      return;
    }

    const obs = this.endpoint()
      ? this.uploadToEndpoint(this.endpoint(), file)
      : this.fileUpload.upload(this.module(), file);

    this.uploading.set(true);
    this.progress.set(0);

    obs.subscribe({
      next: (event: unknown) => {
        if (this.endpoint()) {
          if (event && typeof event === 'object') {
            const ev = event as { type?: number; loaded?: number; total?: number };
            if (ev.type === HttpEventType.UploadProgress && ev.total) {
              this.progress.set(Math.round(((ev.loaded ?? 0) / ev.total) * 100));
            } else if (ev.type === HttpEventType.Response) {
              this.uploading.set(false);
              this.progress.set(100);
              const body = (ev as HttpResponse<ApiResponse<ModuleUploadResponse>>).body?.data;
              if (body) this.uploaded.emit(body);
            }
          }
        } else {
          // Signed-URL flow: no granular progress exposed (PUT is a single
          // fetch). Treat any value as the final FileMetadata.
          const meta = event as FileMetadata;
          this.progress.set(100);
          this.uploading.set(false);
          this.uploaded.emit(meta);
        }
      },
      error: (err: unknown) => {
        this.uploading.set(false);
        this.progress.set(0);
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        this.error.set(msg);
        this.uploadError.emit(msg);
      },
    });
  }

  /**
   * Endpoint override path: upload to a module-specific URL via the
   * BE-proxied multipart flow (so we still get upload progress events from
   * HttpClient). Used for endpoints like {@code POST /api/v1/users/me/avatar}.
   */
  private uploadToEndpoint(url: string, file: File): Observable<unknown> {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return this.http
      .post<ApiResponse<ModuleUploadResponse>>(url, fd, {
        reportProgress: true,
        observe: 'events',
      })
      .pipe(
        catchError((err: unknown) => {
          const msg =
            (err as { error?: { message?: string } })?.error?.message ??
            'No se pudo subir el archivo';
          return of({ __error: msg });
        }),
        map((ev) => ev as unknown),
      );
  }

  private validate(file: File): string | null {
    const allowed = this.allowedMimes();
    if (allowed.length > 0 && !allowed.includes(file.type.toLowerCase())) {
      return `Tipo no permitido (${file.type || 'desconocido'}). Permitidos: ${allowed.join(', ')}.`;
    }
    const maxBytes = this.maxSizeMb() * 1024 * 1024;
    if (file.size > maxBytes) {
      return `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB; el máximo es ${this.maxSizeMb()} MB.`;
    }
    if (file.size === 0) {
      return 'El archivo está vacío.';
    }
    return null;
  }
}

import { SafeBackdropDirective } from '@shared/directives/safe-backdrop.directive';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { FileUploadService } from '@core/services/file-upload.service';
import { IconComponent } from '../icon';

type PreviewKind = 'pdf' | 'image' | 'unsupported' | null;

/** Authenticated in-app preview for PDFs and common raster images. */
@Component({
  selector: 'app-file-preview-dialog',
  standalone: true,
  imports: [SafeBackdropDirective, CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-0 sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-preview-title"
        appSafeBackdrop (click)="onBackdrop($event)"
      >
        <section
          #dialog
          class="flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-surface sm:h-[min(92dvh,900px)] sm:rounded-xl sm:shadow-2xl"
          tabindex="-1"
          (click)="$event.stopPropagation()"
          (keydown)="onDialogKeydown($event)"
        >
          <header class="flex items-center gap-3 border-b border-surface-muted px-4 py-3 sm:px-5">
            <div class="min-w-0 flex-1">
              <h2 id="file-preview-title" class="truncate text-base font-semibold text-content">
                {{ filename || 'Documento adjunto' }}
              </h2>
              <p class="text-xs text-content-muted">
                @if (kind() === 'pdf') {
                  Documento PDF
                } @else if (kind() === 'image') {
                  Imagen
                } @else if (kind() === 'unsupported') {
                  Vista previa no disponible para este formato
                } @else if (loading()) {
                  Cargando documento…
                }
              </p>
            </div>
            <button
              type="button"
              class="btn btn-secondary btn-sm shrink-0"
              [disabled]="loading() || !previewUrl()"
              (click)="download()"
            >
              <app-icon name="download" [size]="16" />
              <span class="hidden sm:inline">Descargar</span>
            </button>
            <button
              type="button"
              #closeButton
              class="btn btn-ghost btn-sm shrink-0"
              aria-label="Cerrar vista previa"
              (click)="close()"
            >
              <app-icon name="x" [size]="18" />
            </button>
          </header>

          <main class="min-h-0 flex-1 bg-surface-muted/40">
            @if (loading()) {
              <div class="flex h-full items-center justify-center p-6" role="status">
                <div class="text-center">
                  <span class="loading loading-spinner loading-md text-primary"></span>
                  <p class="mt-3 text-sm text-content-muted">Cargando documento…</p>
                </div>
              </div>
            } @else if (error()) {
              <div class="flex h-full items-center justify-center p-6" role="alert">
                <div class="max-w-md text-center">
                  <app-icon name="alert-circle" [size]="28" />
                  <p class="mt-3 font-medium text-content">No pudimos abrir el documento</p>
                  <p class="mt-1 text-sm text-content-muted">{{ error() }}</p>
                </div>
              </div>
            } @else if (kind() === 'pdf' && safePreviewUrl()) {
              <iframe
                [src]="safePreviewUrl()"
                [title]="'Vista previa de ' + (filename || 'documento PDF')"
                class="h-full w-full border-0"
              ></iframe>
            } @else if (kind() === 'image' && previewUrl()) {
              <div class="flex h-full items-center justify-center overflow-auto p-3 sm:p-6">
                <img
                  [src]="previewUrl()"
                  [alt]="filename || 'Imagen adjunta'"
                  class="max-h-full max-w-full object-contain"
                />
              </div>
            } @else {
              <div class="flex h-full items-center justify-center p-6">
                <div class="max-w-md text-center">
                  <app-icon name="file-text" [size]="36" />
                  <p class="mt-3 font-medium text-content">Este formato no tiene vista previa</p>
                  <p class="mt-1 text-sm text-content-muted">
                    Descarga el archivo para abrirlo en una aplicación compatible.
                  </p>
                  <button type="button" class="btn btn-primary btn-sm mt-4" (click)="download()">
                    <app-icon name="download" [size]="16" />
                    Descargar archivo
                  </button>
                </div>
              </div>
            }
          </main>
        </section>
      </div>
    }
  `,
})
export class FilePreviewDialogComponent implements OnChanges, OnDestroy {
  @Input() open = false;
  @Input() filePublicUuid: string | null = null;
  @Input() filename = '';
  @Output() readonly closed = new EventEmitter<void>();
  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') private closeButtonRef?: ElementRef<HTMLButtonElement>;

  private readonly files = inject(FileUploadService);
  private readonly sanitizer = inject(DomSanitizer);
  private requestVersion = 0;
  private previouslyFocused: HTMLElement | null = null;

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly kind = signal<PreviewKind>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly safePreviewUrl = computed<SafeResourceUrl | null>(() => {
    const url = this.previewUrl();
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.previouslyFocused = document.activeElement as HTMLElement | null;
      queueMicrotask(() => this.closeButtonRef?.nativeElement.focus());
    }
    if (changes['open'] && !this.open) {
      this.resetPreview();
      this.restoreFocus();
      return;
    }
    if (
      this.open &&
      this.filePublicUuid &&
      (changes['open']?.currentValue === true || changes['filePublicUuid'])
    ) {
      void this.loadPreview(this.filePublicUuid);
    }
  }

  ngOnDestroy(): void {
    this.resetPreview();
    this.restoreFocus();
  }

  protected close(): void {
    this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;

    // Keep the viewer's focus cycle local, including when it is nested in
    // another dialog such as the grading form.
    event.stopPropagation();
    const root = this.dialogRef?.nativeElement;
    if (!root) return;
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => element.tabIndex >= 0);
    if (focusable.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !root.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !root.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  protected download(): void {
    const url = this.previewUrl();
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = this.filename || 'documento';
    link.rel = 'noopener';
    link.click();
  }

  private async loadPreview(publicUuid: string): Promise<void> {
    const version = ++this.requestVersion;
    this.clearObjectUrl();
    this.loading.set(true);
    this.error.set(null);
    this.kind.set(null);

    try {
      const blob = await firstValueFrom(this.files.download(publicUuid));
      if (version !== this.requestVersion) return;
      const mimeType = blob.type.split(';', 1)[0]?.trim().toLowerCase() ?? '';
      const kind = this.previewKind(mimeType);
      this.kind.set(kind);
      this.previewUrl.set(URL.createObjectURL(blob));
    } catch {
      if (version === this.requestVersion) {
        this.error.set('Comprueba tu conexión o inténtalo de nuevo.');
      }
    } finally {
      if (version === this.requestVersion) this.loading.set(false);
    }
  }

  private previewKind(mimeType: string): PreviewKind {
    if (mimeType === 'application/pdf') return 'pdf';
    if (['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) return 'image';
    return 'unsupported';
  }

  private resetPreview(): void {
    this.requestVersion++;
    this.clearObjectUrl();
    this.loading.set(false);
    this.error.set(null);
    this.kind.set(null);
  }

  private clearObjectUrl(): void {
    const url = this.previewUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewUrl.set(null);
  }

  private restoreFocus(): void {
    if (!this.previouslyFocused?.isConnected) {
      this.previouslyFocused = null;
      return;
    }
    this.previouslyFocused.focus();
    this.previouslyFocused = null;
  }
}

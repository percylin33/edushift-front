import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FilePreviewDialogComponent, IconComponent } from '@shared/components';
import { FileUploadService } from '@core/services/file-upload.service';
import { Submission, SubmissionStatus } from '../../models';

/**
 * Card con la entrega del STUDENT/PARENT (FE-7a.2 Scenario 1).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Mostrar el estado (badge de color), la versión, el
 *       timestamp de entrega, el grade y el feedback (si
 *       existen).</li>
 *   <li>Si hay attachment, mostrar nombre + link al download URL
 *       (signed, server-side).</li>
 *   <li>Botón "Re-entregar" visible sólo si la tarea permite
 *       re-entregas y el estado lo permite (status RETURNED o
 *       GRADED+allowResubmissions).</li>
 *   <li>Botón "Ver feedback completo" que emite
 *       {@code showFeedback} para que la page abra un modal más
 *       amplio (futuro; hoy simplemente muestra el texto inline).</li>
 * </ul>
 */
@Component({
  selector: 'app-my-submissions-card',
  standalone: true,
  imports: [CommonModule, IconComponent, FilePreviewDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (submission) {
      <section class="card overflow-hidden">
        <header class="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h2 class="text-lg font-semibold text-content">Tu entrega</h2>
              <p class="mt-1 text-xs text-content-muted">
                Enviada {{ submission.submittedAt | date: 'dd/MM/yyyy, HH:mm' }}
              </p>
            </div>
          </div>
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
            [class]="statusClass(submission.status)"
          >{{ statusLabel(submission.status) }}</span>
        </header>

        <div class="grid gap-4 px-5 py-4 text-sm">
          @if (submission.textContent) {
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-content-muted">Texto</p>
              <p class="whitespace-pre-line text-content">
                {{ submission.textContent }}
              </p>
            </div>
          }

          @if (submission.attachment; as att) {
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-content-muted">Adjunto</p>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 text-primary hover:underline"
                  (click)="onPreviewAttachment(att.publicUuid, att.filename)"
                >
                  <app-icon name="paperclip" [size]="14" />
                  <span>{{ att.filename }}</span>
                  <span class="text-xs text-content-muted"> ({{ formatSize(att.sizeBytes) }}) </span>
                  <span class="sr-only">, ver en la plataforma</span>
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-1 text-xs font-medium text-content-muted hover:text-content"
                  [attr.aria-label]="'Descargar ' + att.filename"
                  (click)="onDownloadAttachment(att.publicUuid, att.filename)"
                >
                  <app-icon name="download" [size]="13" />
                  Descargar
                </button>
              </div>
            </div>
          }

          @if (submission.grade !== null) {
            <div class="rounded-md border border-emerald-200 bg-emerald-50 p-3">
              <div class="flex items-center gap-2">
                <app-icon name="award" [size]="16" />
                <p class="text-sm font-semibold text-emerald-900">
                  Calificación: {{ submission.grade }}
                </p>
              </div>
              @if (submission.feedback) {
                <p class="mt-2 text-sm text-emerald-900">
                  {{ submission.feedback }}
                </p>
              }
            </div>
          } @else if (submission.feedback) {
            <div class="rounded-md border border-orange-200 bg-orange-50 p-3">
              <div class="flex items-center gap-2">
                <app-icon name="message-square" [size]="16" />
                <p class="text-sm font-medium text-orange-900">Feedback del docente</p>
              </div>
              <p class="mt-2 text-sm text-orange-900">
                {{ submission.feedback }}
              </p>
            </div>
          }
        </div>

        @if (showResubmit) {
          <footer class="flex justify-end border-t border-border px-5 py-3">
            <button type="button" class="btn btn-secondary btn-sm" (click)="onResubmit()">
              <app-icon name="upload" [size]="14" />
              Re-entregar
            </button>
          </footer>
        }
      </section>
    } @else {
      <section class="card overflow-hidden">
        <div class="px-5 py-6 text-center">
          <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-muted text-content-muted">
            <app-icon name="file-text" [size]="26" />
          </span>
          <h2 class="mt-4 text-lg font-semibold text-content">Aún no has entregado</h2>
          <p class="mx-auto mt-1 max-w-xs text-sm text-content-muted">
            Usa el formulario para registrar tu respuesta antes del vencimiento.
          </p>
          <div class="mt-5 grid grid-cols-2 border-t border-border pt-4 text-left">
            <div class="border-r border-border pr-3 text-center">
              <p class="text-xs font-medium uppercase tracking-wide text-content-muted">Entrega</p>
              <p class="mt-1 font-medium text-content">{{ allowResubmissions ? 'Re-entrega permitida' : 'Un solo envío' }}</p>
            </div>
            <div class="pl-3 text-center">
              <p class="text-xs font-medium uppercase tracking-wide text-content-muted">Calificación</p>
              <p class="mt-1 font-semibold text-content">{{ maxScore }} pts. máx.</p>
            </div>
          </div>
        </div>
      </section>
    }

    @if (previewAttachment(); as attachment) {
      <app-file-preview-dialog
        [open]="true"
        [filePublicUuid]="attachment.publicUuid"
        [filename]="attachment.filename"
        (closed)="previewAttachment.set(null)"
      />
    }
  `,
})
export class MySubmissionsCardComponent {
  @Input() submission: Submission | null = null;
  @Input() showResubmit = false;
  @Input() allowResubmissions = false;
  @Input() maxScore = 0;
  @Output() readonly resubmit = new EventEmitter<void>();

  private readonly files = inject(FileUploadService);
  protected readonly previewAttachment = signal<{
    publicUuid: string;
    filename: string;
  } | null>(null);

  protected onResubmit(): void {
    this.resubmit.emit();
  }

  protected async onDownloadAttachment(publicUuid: string, filename: string): Promise<void> {
    try {
      await this.files.downloadAndSave(publicUuid, filename);
    } catch {
      // UI feedback handled by global error interceptor
    }
  }

  protected onPreviewAttachment(publicUuid: string, filename: string): void {
    this.previewAttachment.set({ publicUuid, filename });
  }

  protected statusLabel(status: SubmissionStatus): string {
    return STATUS_LABEL[status];
  }

  protected statusClass(status: SubmissionStatus): string {
    return STATUS_CLASS[status];
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

const STATUS_LABEL: Record<SubmissionStatus, string> = {
  [SubmissionStatus.Pending]: 'Pendiente',
  [SubmissionStatus.Submitted]: 'Entregada',
  [SubmissionStatus.Late]: 'Tarde',
  [SubmissionStatus.Graded]: 'Calificada',
  [SubmissionStatus.Returned]: 'Devuelta',
};

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  [SubmissionStatus.Pending]: 'border-slate-300 bg-slate-100 text-slate-700',
  [SubmissionStatus.Submitted]: 'border-sky-300 bg-sky-50 text-sky-700',
  [SubmissionStatus.Late]: 'border-amber-300 bg-amber-50 text-amber-700',
  [SubmissionStatus.Graded]: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  [SubmissionStatus.Returned]: 'border-orange-300 bg-orange-50 text-orange-700',
};

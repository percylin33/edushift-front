import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { IconComponent } from '@shared/components';
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
  imports: [CommonModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (submission) {
      <section class="card">
        <header class="card-header">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <h2 class="card-title">Tu entrega</h2>
              <p class="text-xs text-content-muted">
                Versión {{ submission.version }} · {{ submission.submittedAt | date: 'medium' }}
              </p>
            </div>
            <span
              class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
              [class]="statusClass(submission.status)"
            >
              {{ statusLabel(submission.status) }}
            </span>
          </div>
        </header>

        <div class="card-body grid gap-3 text-sm">
          @if (submission.textContent) {
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-content-muted">
                Texto
              </p>
              <p class="whitespace-pre-line text-content">
                {{ submission.textContent }}
              </p>
            </div>
          }

          @if (submission.attachment; as att) {
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-content-muted">
                Adjunto
              </p>
              <a
                [href]="att.downloadUrl"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <app-icon name="paperclip" [size]="14" />
                <span>{{ att.filename }}</span>
                <span class="text-xs text-content-muted">
                  ({{ formatSize(att.sizeBytes) }})
                </span>
              </a>
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
                <p class="text-sm font-medium text-orange-900">
                  Feedback del docente
                </p>
              </div>
              <p class="mt-2 text-sm text-orange-900">
                {{ submission.feedback }}
              </p>
            </div>
          }
        </div>

        @if (showResubmit) {
          <footer class="card-footer flex justify-end">
            <button type="button" class="btn btn-secondary btn-sm" (click)="onResubmit()">
              <app-icon name="upload" [size]="14" />
              Re-entregar
            </button>
          </footer>
        }
      </section>
    } @else {
      <section class="card">
        <div class="card-body text-center">
          <app-icon name="file-text" [size]="32" />
          <h2 class="mt-2 text-base font-semibold text-content">
            Aún no has entregado
          </h2>
          <p class="mt-1 text-sm text-content-muted">
            Usa el formulario de abajo para registrar tu entrega.
          </p>
        </div>
      </section>
    }
  `
})
export class MySubmissionsCardComponent {
  @Input() submission: Submission | null = null;
  @Input() showResubmit = false;
  @Output() readonly resubmit = new EventEmitter<void>();

  protected onResubmit(): void {
    this.resubmit.emit();
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
  [SubmissionStatus.Returned]: 'Devuelta'
};

const STATUS_CLASS: Record<SubmissionStatus, string> = {
  [SubmissionStatus.Pending]: 'border-slate-300 bg-slate-100 text-slate-700',
  [SubmissionStatus.Submitted]: 'border-sky-300 bg-sky-50 text-sky-700',
  [SubmissionStatus.Late]: 'border-amber-300 bg-amber-50 text-amber-700',
  [SubmissionStatus.Graded]: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  [SubmissionStatus.Returned]: 'border-orange-300 bg-orange-50 text-orange-700'
};

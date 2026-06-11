import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  input,
  output
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { AttendanceRecord, AttendanceRecordStatus, UpdateRecordRequest } from '../models';

/**
 * Dialog "Editar registro" — PUT /v1/attendance/records/{id} (FE-6.2).
 *
 * <h3>Who can edit and when</h3>
 * The backend has two windows:
 * <ul>
 *   <li>{@code TEACHER}: can edit only {@code CLOSED} sessions that
 *       closed within the last {@code edit-window-hours} (default 24h).</li>
 *   <li>{@code TENANT_ADMIN}: always (the edit-window is bypassed).</li>
 * </ul>
 * We mirror the same gate on the UI: the parent disables the
 * "Editar" button, and the modal reads {@link AuthService} to know
 * which role is connected so we can show the right copy ("ventana
 * expirada" if the docente tries to open it past the window).
 *
 * <h3>Status choices</h3>
 * We surface all four statuses (PRESENT/LATE/ABSENT/EXCUSED) — the
 * backend's {@code FORCED_STATUS_FORBIDDEN} guard rejects
 * {@code PRESENT}/{@code LATE} from a TEACHER without explicit
 * justification, but the UI stays declarative: the docente picks
 * the intended outcome and the backend decides.
 */
@Component({
  selector: 'app-edit-record-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-record-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header">
          <div>
            <h2 id="edit-record-title" class="card-title">Editar registro</h2>
            <p class="card-description">
              {{ record().studentFullName ?? 'Alumno' }} ·
              {{ record().studentDocumentNumber ?? 's/doc' }}
            </p>
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

        <form class="card-body flex flex-col gap-3 overflow-y-auto" (ngSubmit)="submit()">
          <div>
            <label class="label" for="edit-status">Estado</label>
            <select
              id="edit-status"
              class="select"
              [(ngModel)]="status"
              name="status"
              required
            >
              @for (opt of statusOptions; track opt.value) {
                <option [ngValue]="opt.value">{{ opt.label }}</option>
              }
            </select>
            @if (isTeacher() && (status === 'PRESENT' || status === 'LATE')) {
              <p class="hint mt-1 text-xs text-warning">
                El backend rechazará forzar PRESENTE / TARDANZA sin
                justificación; documenta el motivo en las notas.
              </p>
            }
          </div>

          <div>
            <label class="label" for="edit-notes">Notas (opcional)</label>
            <textarea
              id="edit-notes"
              class="textarea"
              rows="3"
              maxlength="500"
              [(ngModel)]="notes"
              name="notes"
              placeholder="Justificación u observación…"
            ></textarea>
          </div>

          @if (record().editedAt) {
            <p class="text-xs text-content-muted">
              Última edición:
              {{ record().editedAt | date: 'short' }}
            </p>
          }
        </form>

        <footer class="card-footer justify-end gap-2">
          <button type="button" class="btn btn-ghost btn-sm" (click)="close()">
            Cancelar
          </button>
          <button
            type="submit"
            class="btn btn-primary btn-sm"
            [disabled]="!status"
            (click)="submit()"
          >
            <app-icon name="check" [size]="16" />
            <span>Guardar</span>
          </button>
        </footer>
      </div>
    </div>
  `
})
export class EditRecordModalComponent {
  readonly record = input.required<AttendanceRecord>();
  /** Fires with the validated request on submit. */
  readonly save = output<UpdateRecordRequest>();
  /** Fires when the docente dismisses the dialog without submitting. */
  readonly cancelled = output<void>();

  private readonly auth = inject(AuthService);

  protected status: AttendanceRecordStatus = 'PRESENT';
  protected notes = '';

  protected readonly isTeacher = computed(() =>
    this.auth.hasRole(UserRole.Teacher)
  );

  protected readonly statusOptions: ReadonlyArray<{ value: AttendanceRecordStatus; label: string }> = [
    { value: 'PRESENT', label: 'Presente' },
    { value: 'LATE', label: 'Tardanza' },
    { value: 'ABSENT', label: 'Ausente' },
    { value: 'EXCUSED', label: 'Justificado' }
  ];

  @HostListener('document:keydown.escape')
  protected onEsc(): void {
    this.close();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  protected close(): void {
    this.cancelled.emit();
  }

  protected submit(): void {
    if (!this.status) return;
    this.save.emit({ status: this.status, notes: this.notes.trim() || undefined });
  }
}

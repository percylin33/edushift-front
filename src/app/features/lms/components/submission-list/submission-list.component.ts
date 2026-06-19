import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal
} from '@angular/core';
import { IconComponent } from '@shared/components';
import { Permission } from '@core/enums';
import { HasPermissionDirective } from '@shared/directives';
import { SubmissionRow, SubmissionStatus } from '../../models';

/**
 * Tabla de entregas para TEACHER (FE-7a.2 Scenario 4).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Render una fila por {@link SubmissionRow} con avatar, nombre,
 *       estado, fecha, grade, badge de versión.</li>
 *   <li>Acciones por fila: "Calificar" (status SUBMITTED/RETURNED →
 *       {@code LMS_TASK_GRADE}), "Devolver" (status GRADED →
 *       {@code LMS_TASK_GRADE}).</li>
 *   <li>Empty state si no hay entregas; spinner si está cargando.</li>
 * </ul>
 *
 * <p>Es un componente "tonto" — recibe el listing y emite los
 * eventos de acción hacia la page. La page es la responsable de
 * abrir el {@link GradeDialogComponent} y orquestar el store.</p>
 */
@Component({
  selector: 'app-submission-list',
  standalone: true,
  imports: [CommonModule, IconComponent, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading) {
      <div class="card animate-pulse">
        <div class="card-body space-y-3">
          @for (i of [0, 1, 2]; track i) {
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-surface-muted"></div>
              <div class="flex-1 space-y-2">
                <div class="h-3 w-1/3 rounded bg-surface-muted"></div>
                <div class="h-3 w-1/2 rounded bg-surface-muted"></div>
              </div>
            </div>
          }
        </div>
      </div>
    } @else if (rows.length === 0) {
      <div class="card">
        <div class="card-body text-center">
          <app-icon name="users" [size]="32" />
          <h2 class="mt-2 text-base font-semibold text-content">
            Aún no hay entregas
          </h2>
          <p class="mt-1 text-sm text-content-muted">
            Las entregas aparecerán aquí en cuanto los alumnos empiecen a enviar.
          </p>
        </div>
      </div>
    } @else {
      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-surface-muted text-left text-xs uppercase tracking-wide text-content-muted">
            <tr>
              <th class="px-4 py-2">Alumno</th>
              <th class="px-4 py-2">Estado</th>
              <th class="px-4 py-2 hidden sm:table-cell">Versión</th>
              <th class="px-4 py-2 hidden md:table-cell">Entregado</th>
              <th class="px-4 py-2">Calificación</th>
              <th class="px-4 py-2 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows; track row.publicUuid) {
              <tr class="border-t border-surface-muted">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-muted"
                      aria-hidden="true"
                    >
                      @if (row.studentAvatarUrl) {
                        <img
                          [src]="row.studentAvatarUrl"
                          [alt]="row.studentFullName"
                          class="h-full w-full object-cover"
                        />
                      } @else {
                        <div class="flex h-full w-full items-center justify-center text-sm font-medium text-content-muted">
                          {{ initials(row.studentFullName) }}
                        </div>
                      }
                    </div>
                    <div class="min-w-0">
                      <p class="truncate font-medium text-content">
                        {{ row.studentFullName }}
                      </p>
                      @if (row.hasAttachment) {
                        <p class="text-xs text-content-muted">
                          <app-icon name="paperclip" [size]="12" />
                          Adjunto
                        </p>
                      }
                    </div>
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
                    [class]="statusClass(row.status)"
                  >
                    {{ statusLabel(row.status) }}
                  </span>
                </td>
                <td class="px-4 py-3 hidden sm:table-cell text-content-muted">
                  v{{ row.version }}
                </td>
                <td class="px-4 py-3 hidden md:table-cell text-content-muted">
                  {{ row.submittedAt | date: 'short' }}
                </td>
                <td class="px-4 py-3">
                  @if (row.grade !== null) {
                    <span class="font-semibold text-content">{{ row.grade }}</span>
                  } @else {
                    <span class="text-content-muted">—</span>
                  }
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="flex flex-wrap items-center justify-end gap-2">
                    <button
                      *appHasPermission="permission.LmsTaskGrade"
                      type="button"
                      class="btn btn-ghost btn-sm"
                      [disabled]="!canGrade(row.status)"
                      (click)="onGrade(row)"
                    >
                      <app-icon name="pencil" [size]="14" />
                      Calificar
                    </button>
                    <button
                      *appHasPermission="permission.LmsTaskGrade"
                      type="button"
                      class="btn btn-ghost btn-sm"
                      [disabled]="!canReturn(row.status)"
                      (click)="onReturn(row)"
                    >
                      <app-icon name="rotate-ccw" [size]="14" />
                      Devolver
                    </button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class SubmissionListComponent implements OnChanges {
  @Input() rows: SubmissionRow[] = [];
  @Input() loading = false;
  @Input() maxScore = 20;

  @Output() readonly grade = new EventEmitter<SubmissionRow>();
  @Output() readonly return = new EventEmitter<SubmissionRow>();

  protected readonly permission = Permission;
  private readonly _maxScore = signal(20);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['maxScore']) this._maxScore.set(this.maxScore);
  }

  protected canGrade(status: SubmissionStatus): boolean {
    return status === SubmissionStatus.Submitted
      || status === SubmissionStatus.Late
      || status === SubmissionStatus.Returned;
  }

  protected canReturn(status: SubmissionStatus): boolean {
    return status === SubmissionStatus.Graded;
  }

  protected onGrade(row: SubmissionRow): void {
    this.grade.emit(row);
  }

  protected onReturn(row: SubmissionRow): void {
    this.return.emit(row);
  }

  protected statusLabel(status: SubmissionStatus): string {
    return STATUS_LABEL[status];
  }

  protected statusClass(status: SubmissionStatus): string {
    return STATUS_CLASS[status];
  }

  protected initials(fullName: string): string {
    return fullName
      .split(/\s+/)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
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

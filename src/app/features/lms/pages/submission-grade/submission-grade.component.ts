import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ROUTES } from '@core/constants';
import { SpinnerComponent } from '@shared/components';
import { TasksStore } from '../../store';
import { SubmissionsStore } from '../../store';
import { GradeDialogComponent } from '../../components';
import { SubmissionListComponent } from '../../components';
import { GradeMode } from '../../components';
import { GradeSubmissionRequest } from '../../components';
import { SubmissionRow } from '../../models';

/**
 * `/lms/assignments/:uuid/grade` — TEACHER view de entregas
 * (FE-7a.2 Scenario 4 y 5).
 *
 * <h3>Responsabilidades</h3>
 * <ul>
 *   <li>Cargar el listing de la assignment via
 *       {@link SubmissionsStore.loadByAssignment}.</li>
 *   <li>Cargar el task detail (necesario para el {@code maxScore}
 *       del dialog de calificación) via {@link TasksStore.loadDetail}.</li>
 *   <li>Render el {@link SubmissionListComponent} y abrir el
 *       {@link GradeDialogComponent} cuando el TEACHER pulsa
 *       "Calificar" o "Devolver".</li>
 *   <li>Orquestar {@link SubmissionsStore.grade} / {@link SubmissionsStore.return}
 *       y refrescar el listing.</li>
 * </ul>
 */
@Component({
  selector: 'app-submission-grade',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    SpinnerComponent,
    SubmissionListComponent,
    GradeDialogComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-content-muted">
          <a [routerLink]="listRoute()" class="hover:underline">LMS</a>
          /
          <a [routerLink]="backToAssignment()" class="hover:underline">Tarea</a>
        </p>
        <h1 class="text-2xl font-semibold text-content">Calificar entregas</h1>
        <p class="text-sm text-content-muted">Revisa y califica las entregas de los alumnos.</p>
      </div>
    </header>

    @if (loadingSubmissions() || loadingTask()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando entregas…" />
      </div>
    } @else {
      <app-submission-list
        [rows]="submissions()"
        [loading]="loadingSubmissions()"
        [maxScore]="maxScore()"
        (grade)="onOpenGrade($event)"
        (return)="onOpenReturn($event)"
      />
    }

    <app-grade-dialog
      [open]="dialogOpen()"
      [mode]="dialogMode()"
      [maxScore]="maxScore()"
      [saving]="saving()"
      (grade)="onConfirmGrade($event)"
      (return)="onConfirmReturn($event)"
      (cancelled)="onCancelDialog()"
    />
  `,
})
export class SubmissionGradeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tasksStore = inject(TasksStore);
  private readonly submissionsStore = inject(SubmissionsStore);

  protected readonly submissions = this.submissionsStore.rows;
  protected readonly loadingSubmissions = this.submissionsStore.loading;
  protected readonly maxScore = signal(20);

  protected readonly dialogOpen = signal(false);
  protected readonly dialogMode = signal<GradeMode>('Grade');
  protected readonly saving = signal(false);

  private assignmentUuid: string | null = null;
  private selectedRow: SubmissionRow | null = null;
  protected readonly loadingTask = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('uuid');
    if (!id) {
      void this.router.navigate([ROUTES.LMS.ROOT]);
      return;
    }
    this.assignmentUuid = id;

    // Cargar task detail (para maxScore del dialog).
    this.loadingTask.set(true);
    void this.tasksStore.loadDetail(id).then((detail) => {
      if (detail) this.maxScore.set(detail.maxScore);
      this.loadingTask.set(false);
    });

    void this.submissionsStore.loadByAssignment(id);
  }

  protected onOpenGrade(row: SubmissionRow): void {
    this.selectedRow = row;
    this.dialogMode.set('Grade');
    this.dialogOpen.set(true);
  }

  protected onOpenReturn(row: SubmissionRow): void {
    this.selectedRow = row;
    this.dialogMode.set('Return');
    this.dialogOpen.set(true);
  }

  protected async onConfirmGrade(req: GradeSubmissionRequest): Promise<void> {
    if (!this.selectedRow) return;
    this.saving.set(true);
    try {
      await this.submissionsStore.grade(this.selectedRow.publicUuid, req);
      this.dialogOpen.set(false);
      this.selectedRow = null;
    } finally {
      this.saving.set(false);
    }
  }

  protected async onConfirmReturn(req: { feedback: string }): Promise<void> {
    if (!this.selectedRow) return;
    this.saving.set(true);
    try {
      await this.submissionsStore.return(this.selectedRow.publicUuid, req);
      this.dialogOpen.set(false);
      this.selectedRow = null;
    } finally {
      this.saving.set(false);
    }
  }

  protected onCancelDialog(): void {
    this.dialogOpen.set(false);
    this.selectedRow = null;
  }

  protected listRoute(): string {
    return this.assignmentUuid ? ROUTES.LMS.assignmentDetail(this.assignmentUuid) : ROUTES.LMS.ROOT;
  }

  protected backToAssignment(): string {
    return this.listRoute();
  }
}

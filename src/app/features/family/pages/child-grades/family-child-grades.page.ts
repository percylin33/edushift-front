import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FamilyGradeItem } from '../../models/family-grade.model';
import { FamilyApiService } from '../../services/family-api.service';

@Component({
  selector: 'app-family-child-grades-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a [routerLink]="['/family/children', studentPublicUuid()]" class="text-sm font-semibold text-indigo-600">
        ← Volver al resumen
      </a>

      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Familia</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Calificaciones del estudiante</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">Revisa los registros de notas y su progreso académico.</p>
      </header>

      @if (loading()) {
        <div class="mt-8 space-y-3" aria-label="Cargando calificaciones">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">Reintentar</button>
        </div>
      } @else if (grades().length === 0) {
        <div class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Sin calificaciones registradas</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Las notas aparecerán aquí cuando el docente las publique.</p>
        </div>
      } @else {
        <div class="mt-8 grid gap-4">
          @for (grade of grades(); track grade.publicUuid) {
            <article class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {{ grade.evaluationName || 'Registro sin nombre' }}
                  </h2>
                  <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {{ grade.courseName || 'Curso no especificado' }}
                    @if (grade.sectionName) {
                      <span> · {{ grade.sectionName }}</span>
                    }
                  </p>
                </div>
                <div class="text-left sm:text-right">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Resultado</p>
                  <p class="mt-1 text-2xl font-bold text-indigo-600">
                    {{ displayResult(grade) }}
                  </p>
                </div>
              </div>

              <div class="mt-4 grid gap-3 text-sm text-slate-600 dark:text-slate-400 md:grid-cols-3">
                <p>
                  <span class="font-semibold text-slate-700 dark:text-slate-300">Programada:</span>
                  {{ grade.scheduledDate ? (grade.scheduledDate | date:'dd/MM/yyyy') : '—' }}
                </p>
                <p>
                  <span class="font-semibold text-slate-700 dark:text-slate-300">Registrada:</span>
                  {{ grade.recordedAt ? (grade.recordedAt | date:'dd/MM/yyyy HH:mm') : '—' }}
                </p>
                <p>
                  <span class="font-semibold text-slate-700 dark:text-slate-300">Comentario:</span>
                  {{ grade.comments || 'Sin comentarios' }}
                </p>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class FamilyChildGradesPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(FamilyApiService);

  readonly studentPublicUuid = signal(this.route.snapshot.paramMap.get('studentPublicUuid') ?? '');
  readonly grades = signal<FamilyGradeItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const studentPublicUuid = this.studentPublicUuid();
    if (!studentPublicUuid) {
      this.error.set('No se encontró el estudiante solicitado.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.api.getChildGrades(studentPublicUuid).subscribe({
      next: (response) => {
        this.grades.set(this.api.adaptGrades(response.data ?? []));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las calificaciones del estudiante.');
        this.loading.set(false);
      },
    });
  }

  displayResult(grade: FamilyGradeItem): string {
    if (grade.score !== null && grade.score !== undefined) {
      if (grade.maxScore !== null && grade.maxScore !== undefined) {
        return `${grade.score}/${grade.maxScore}`;
      }
      return `${grade.score}`;
    }
    return grade.literal || '—';
  }
}

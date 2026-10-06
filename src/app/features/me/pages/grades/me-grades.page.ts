import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeGrade } from '../../models/me-grade.model';
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-grades',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a
        routerLink="/me/profile"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mi perfil</span>
      </a>
      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mis notas</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Calificaciones publicadas por tus docentes.
        </p>
      </header>

      @if (loading()) {
        <div class="mt-8 space-y-3" aria-label="Cargando notas">
          @for (item of [1, 2, 3]; track item) {
            <div class="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (grades().length === 0) {
        <div
          class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sin calificaciones
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Cuando un docente publique una nota, aparecerá aquí.
          </p>
        </div>
      } @else {
        <div class="mt-8 grid gap-4">
          @for (grade of grades(); track grade.publicUuid) {
            <article
              class="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
            >
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {{ grade.evaluationName || 'Registro' }}
                  </h2>
                  <p class="mt-1 text-sm text-slate-500">
                    {{ grade.courseName || 'Curso' }}
                    @if (grade.sectionName) {
                      <span> · {{ grade.sectionName }}</span>
                    }
                  </p>
                </div>
                <p class="text-2xl font-bold text-indigo-600">{{ displayResult(grade) }}</p>
              </div>
              <p class="mt-3 text-sm text-slate-600 dark:text-slate-400">
                {{ grade.comments || 'Sin comentarios' }}
              </p>
              <p class="mt-2 text-xs text-slate-500">
                Registrada:
                {{ grade.recordedAt ? (grade.recordedAt | date: 'dd/MM/yyyy HH:mm') : '—' }}
              </p>
            </article>
          }
        </div>
      }
    </section>
  `,
})
export class MeGradesPageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly grades = signal<MeGrade[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listGrades()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.grades.set(response.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudieron cargar tus notas.');
          this.loading.set(false);
        },
      });
  }

  displayResult(grade: MeGrade): string {
    if (grade.score !== null && grade.score !== undefined) {
      if (grade.maxScore !== null && grade.maxScore !== undefined) {
        return `${grade.score}/${grade.maxScore}`;
      }
      return `${grade.score}`;
    }
    return grade.literal || '—';
  }
}

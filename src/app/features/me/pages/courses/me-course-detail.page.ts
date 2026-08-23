import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ROUTES } from '@core/constants';
import { MeSectionDetail } from '../../models/me-section.model';
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-course-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a
        routerLink="/me/courses"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mis cursos</span>
      </a>

      @if (loading()) {
        <div class="mt-8 h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (detail()) {
        @let d = detail()!;
        <header class="mt-6">
          <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
          <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {{ d.courseName || 'Curso' }}
          </h1>
          <p class="mt-2 text-slate-600 dark:text-slate-400">
            {{ d.gradeName }} · Sección {{ d.name }}
            @if (d.teacherName) {
              <span> · {{ d.teacherName }}</span>
            }
          </p>
        </header>

        <h2 class="mt-10 text-lg font-semibold text-slate-900 dark:text-slate-100">Tareas</h2>
        @if (d.tasks.length === 0) {
          <p class="mt-2 text-sm text-slate-500">No hay tareas publicadas.</p>
        } @else {
          <ul class="mt-3 grid gap-3">
            @for (task of d.tasks; track task.publicUuid) {
              <li
                class="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p class="font-semibold text-slate-900 dark:text-slate-100">{{ task.title }}</p>
                  <p class="text-sm text-slate-500">
                    @if (task.dueAt) {
                      Entrega: {{ task.dueAt | date: 'dd/MM/yyyy HH:mm' }}
                    } @else {
                      Sin fecha límite
                    }
                    @if (task.overdue) {
                      <span class="ml-2 font-semibold text-rose-600">Vencida</span>
                    }
                  </p>
                </div>
                <a
                  [routerLink]="submitLink(task.publicUuid)"
                  class="text-sm font-semibold text-indigo-600"
                  [attr.aria-label]="'Entregar ' + task.title"
                >
                  Entregar
                </a>
              </li>
            }
          </ul>
        }

        <h2 class="mt-10 text-lg font-semibold text-slate-900 dark:text-slate-100">Quizzes</h2>
        @if (d.quizzes.length === 0) {
          <p class="mt-2 text-sm text-slate-500">No hay quizzes publicados.</p>
        } @else {
          <ul class="mt-3 grid gap-3">
            @for (quiz of d.quizzes; track quiz.publicUuid) {
              <li
                class="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p class="font-semibold text-slate-900 dark:text-slate-100">{{ quiz.title }}</p>
                  <p class="text-sm text-slate-500">
                    {{ quiz.status }} · {{ quiz.questionCount }} preguntas
                  </p>
                </div>
                <a
                  [routerLink]="takeLink(quiz.publicUuid)"
                  class="text-sm font-semibold text-indigo-600"
                  [attr.aria-label]="'Tomar ' + quiz.title"
                >
                  Tomar
                </a>
              </li>
            }
          </ul>
        }

        <h2 class="mt-10 text-lg font-semibold text-slate-900 dark:text-slate-100">Materiales</h2>
        @if (d.materials.length === 0) {
          <p class="mt-2 text-sm text-slate-500">No hay materiales publicados.</p>
        } @else {
          <ul class="mt-3 grid gap-3">
            @for (material of d.materials; track material.publicUuid) {
              <li class="rounded-2xl bg-white p-4 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                <p class="font-semibold text-slate-900 dark:text-slate-100">{{ material.title }}</p>
                <p class="text-sm text-slate-500">{{ material.kind }}</p>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
})
export class MeCourseDetailPageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly detail = signal<MeSectionDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const uuid = this.route.snapshot.paramMap.get('sectionPublicUuid');
    if (!uuid) {
      this.error.set('No se encontró el curso solicitado.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api
      .getSection(uuid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.detail.set(response.data ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar el detalle del curso.');
          this.loading.set(false);
        },
      });
  }

  submitLink(taskUuid: string): string {
    return ROUTES.LMS.assignmentSubmit(taskUuid);
  }

  takeLink(quizUuid: string): string {
    return ROUTES.LMS.quizTake(quizUuid);
  }
}

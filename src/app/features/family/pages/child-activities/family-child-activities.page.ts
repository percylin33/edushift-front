import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FamilyActivityItem } from '../../models/family-activity.model';
import { FamilyApiService } from '../../services/family-api.service';

@Component({
  selector: 'app-family-child-activities-page',
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
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Actividades</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Entrega las tareas a nombre del hijo. Los quizzes se resuelven en el aula, no desde Familia.
        </p>
      </header>

      @if (loading()) {
        <div class="mt-8 space-y-3" aria-label="Cargando actividades">
          @for (item of [1, 2, 3]; track item) {
            <div class="h-20 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">Reintentar</button>
        </div>
      } @else if (items().length === 0) {
        <div class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700">
          <h2 class="text-lg font-semibold">Sin actividades</h2>
          <p class="mt-2 text-sm text-slate-600">Cuando el docente publique tareas o quizzes, aparecerán aquí.</p>
        </div>
      } @else {
        <ul class="mt-8 grid gap-3">
          @for (item of items(); track item.kind + item.publicUuid) {
            <li class="rounded-2xl bg-white p-5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
              <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                {{ item.kind === 'TASK' ? 'Tarea' : 'Quiz' }}
              </p>
              <h2 class="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">{{ item.title }}</h2>
              <p class="mt-1 text-sm text-slate-500">
                {{ item.sectionName || 'Sección' }}
                @if (item.dueAt) {
                  <span> · {{ item.dueAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                }
                @if (item.overdue) {
                  <span class="ml-2 font-semibold text-rose-600">Vencida</span>
                }
              </p>
              @if (item.kind === 'TASK') {
                <a
                  class="mt-3 inline-flex text-sm font-semibold text-indigo-600 hover:underline"
                  [routerLink]="['/lms/assignments', item.publicUuid, 'submit']"
                  [queryParams]="{ studentPublicUuid: studentPublicUuid() }"
                >
                  Entregar
                </a>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class FamilyChildActivitiesPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(FamilyApiService);

  readonly studentPublicUuid = signal(this.route.snapshot.paramMap.get('studentPublicUuid') ?? '');
  readonly items = signal<FamilyActivityItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const uuid = this.studentPublicUuid();
    if (!uuid) {
      this.error.set('No se encontró el estudiante solicitado.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.getChildActivities(uuid).subscribe({
      next: (response) => {
        this.items.set(response.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar las actividades.');
        this.loading.set(false);
      },
    });
  }
}

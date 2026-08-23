import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ScheduleGridComponent } from '@features/academic/components/schedule-grid.component';
import { NonTeachingBlockItem, ScheduleSlotItem } from '@features/academic/models';
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-schedule',
  standalone: true,
  imports: [CommonModule, RouterLink, ScheduleGridComponent],
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
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mi horario</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Horario semanal de tus cursos. Vacío si el colegio aún no lo configuró.
        </p>
      </header>

      @if (loading()) {
        <div class="mt-8 h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else {
        <div class="mt-8">
          <app-schedule-grid
            [slots]="slots()"
            [nonTeachingBlocks]="nonTeachingBlocks()"
            [showSectionView]="true"
            [showTeacherView]="true"
            emptyTitle="Aún no hay horario en tu sección"
          />
        </div>
      }
    </section>
  `,
})
export class MeSchedulePageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly slots = signal<ScheduleSlotItem[]>([]);
  readonly nonTeachingBlocks = signal<NonTeachingBlockItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listSchedule()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const view = response.data;
          this.slots.set(view?.slots ?? []);
          this.nonTeachingBlocks.set(view?.nonTeachingBlocks ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar tu horario.');
          this.loading.set(false);
        },
      });
  }
}

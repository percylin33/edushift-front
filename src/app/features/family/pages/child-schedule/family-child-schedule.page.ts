import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ScheduleGridComponent } from '@features/academic/components/schedule-grid.component';
import { NonTeachingBlockItem, ScheduleSlotItem } from '@features/academic/models';
import { FamilyApiService } from '../../services/family-api.service';

@Component({
  selector: 'app-family-child-schedule-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ScheduleGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a [routerLink]="['/family/children', studentPublicUuid()]" class="text-sm font-semibold text-indigo-600">
        ← Volver al resumen
      </a>
      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Familia</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Horario</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Horario semanal del estudiante. Vacío si el colegio aún no lo configuró.
        </p>
      </header>

      @if (loading()) {
        <div class="mt-8 h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">Reintentar</button>
        </div>
      } @else {
        <div class="mt-8">
          <app-schedule-grid
            [slots]="slots()"
            [nonTeachingBlocks]="nonTeachingBlocks()"
            [showSectionView]="true"
            [showTeacherView]="true"
            emptyTitle="Aún no hay horario configurado"
          />
        </div>
      }
    </section>
  `,
})
export class FamilyChildSchedulePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(FamilyApiService);

  readonly studentPublicUuid = signal(this.route.snapshot.paramMap.get('studentPublicUuid') ?? '');
  readonly slots = signal<ScheduleSlotItem[]>([]);
  readonly nonTeachingBlocks = signal<NonTeachingBlockItem[]>([]);
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
    this.api.getChildSchedule(uuid).subscribe({
      next: (response) => {
        const view = response.data;
        this.slots.set(view?.slots ?? []);
        this.nonTeachingBlocks.set(view?.nonTeachingBlocks ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el horario.');
        this.loading.set(false);
      },
    });
  }
}

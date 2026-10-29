import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { ScheduleApiService } from '@features/schedule/services/schedule-api.service';
import { NonTeachingBlockItem, ScheduleSlotItem, SuggestedPeriodItem } from '../models';
import { ScheduleGridComponent } from './schedule-grid.component';
import { dedupeYearScheduleSlots } from '../utils/schedule-assignment.util';

/**
 * Sub-tab "Horario" dentro de {@code section-detail}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Consume week view con recreos ({@code GET .../schedule/week}).</li>
 *   <li>Vista contextual de consulta; la edición se realiza en {@code /schedule}.</li>
 * </ul>
 */
@Component({
  selector: 'app-section-schedule-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    SpinnerComponent,
    ScheduleGridComponent,
  ],
  template: `
    <header class="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-content">Horario Semanal</h3>
        <p class="text-sm text-content-muted">
          Consulta los bloques de clase y los espacios sugeridos de esta sección.
        </p>
      </div>
      @if (academicYearPublicUuid()) {
        <a
          class="btn btn-outline btn-sm"
          [routerLink]="ROUTES.SCHEDULE.ROOT"
          [queryParams]="{ year: academicYearPublicUuid(), section: sectionPublicUuid() }"
        >
          Abrir editor de horarios
          <app-icon name="arrow-right" [size]="14" />
        </a>
      }
    </header>

    <section class="card overflow-hidden">
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <app-spinner [size]="24" label="Cargando horario…" />
        </div>
      } @else if (errorMessage()) {
        <div class="alert alert-danger m-5">
          <app-icon name="alert-circle" [size]="18" />
          <div class="flex-1">
            <p class="font-medium">No pudimos cargar el horario.</p>
            <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">Reintentar</button>
        </div>
      } @else {
        <div class="p-4">
          <app-schedule-grid
            [slots]="slots()"
            [nonTeachingBlocks]="nonTeachingBlocks()"
            [suggestedPeriods]="suggestedPeriods()"
            [editable]="false"
            [showSectionView]="false"
            [showTeacherView]="true"
            emptyTitle="Aún no hay horario para esta sección"
          />
        </div>
      }
    </section>

  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class SectionScheduleTabComponent implements OnChanges {
  private readonly scheduleApi = inject(ScheduleApiService);

  readonly sectionPublicUuid = input.required<string>();
  readonly academicYearPublicUuid = input.required<string>();
  protected readonly ROUTES = ROUTES;

  protected readonly slots = signal<ScheduleSlotItem[]>([]);
  protected readonly nonTeachingBlocks = signal<NonTeachingBlockItem[]>([]);
  protected readonly suggestedPeriods = signal<SuggestedPeriodItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sectionPublicUuid']) {
      void this.loadAll();
    }
  }

  protected async loadAll(): Promise<void> {
    const uuid = this.sectionPublicUuid();
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const view = await firstValueFrom(this.scheduleApi.getSectionScheduleWeek(uuid));
      const rawSlots = view.slots ?? [];
      this.slots.set(dedupeYearScheduleSlots(rawSlots));
      this.nonTeachingBlocks.set(view.nonTeachingBlocks ?? []);
      this.suggestedPeriods.set(view.suggestedPeriods ?? []);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error de red');
    } finally {
      this.loading.set(false);
    }
  }

  protected retry(): void {
    void this.loadAll();
  }

}

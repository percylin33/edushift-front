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
import { firstValueFrom } from 'rxjs';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '../services';
import { ScheduleSlotItem } from '../models';
import { ScheduleGridComponent } from './schedule-grid.component';

/**
 * Sub-tab "Horario" dentro de {@code section-detail}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Consume {@code GET /v1/academic/sections/{uuid}/schedule} (BE-5A.3).</li>
 *   <li>Muestra el horario en formato grid (desktop) o lista (mobile).</li>
 *   <li>Es read-only: las mutaciones de horario se gestionan desde la
 *       vista del docente o la asignación (DEBT-SES-2).</li>
 * </ul>
 */
@Component({
  selector: 'app-section-schedule-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, SpinnerComponent, ScheduleGridComponent],
  template: `
    <header class="mb-3 flex items-end justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-content">Horario Semanal</h3>
        <p class="text-sm text-content-muted">
          Asignaciones activas de docentes y cursos para esta sección.
        </p>
      </div>
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
  private readonly api = inject(AcademicApiService);

  readonly sectionPublicUuid = input.required<string>();

  protected readonly slots = signal<ScheduleSlotItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sectionPublicUuid']) {
      void this.loadSchedule();
    }
  }

  protected async loadSchedule(): Promise<void> {
    const uuid = this.sectionPublicUuid();
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const data = await firstValueFrom(this.api.getSectionSchedule(uuid));
      this.slots.set(data);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error de red');
    } finally {
      this.loading.set(false);
    }
  }

  protected retry(): void {
    void this.loadSchedule();
  }
}

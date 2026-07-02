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
import { AcademicApiService } from '@features/academic/services';
import { ScheduleSlotItem } from '@features/academic/models';
import { ScheduleGridComponent } from '@features/academic/components';
import { TeacherDetail } from '../models';

/**
 * Sub-tab "Horario" dentro de {@code teacher-detail}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Consume {@code GET /v1/teachers/{uuid}/schedule} (BE-5A.3).</li>
 *   <li>Muestra el horario en formato grid (desktop) o lista (mobile).</li>
 *   <li>Es read-only para el teacher (DEBT-SES-2 permitirá edición en el futuro).</li>
 * </ul>
 */
@Component({
  selector: 'app-teacher-schedule-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, SpinnerComponent, ScheduleGridComponent],
  template: `
    <header class="mb-3 flex items-end justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-content">Mi Horario Semanal</h3>
        <p class="text-sm text-content-muted">Resumen de todas tus asignaciones activas.</p>
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
            [showSectionView]="true"
            [showTeacherView]="false"
            emptyTitle="Aún no tienes horario configurado"
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
export class TeacherScheduleTabComponent implements OnChanges {
  private readonly api = inject(AcademicApiService);

  readonly teacherPublicUuid = input.required<string>();

  protected readonly slots = signal<ScheduleSlotItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['teacherPublicUuid']) {
      void this.loadSchedule();
    }
  }

  protected async loadSchedule(): Promise<void> {
    const uuid = this.teacherPublicUuid();
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const data = await firstValueFrom(this.api.getTeacherSchedule(uuid));
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

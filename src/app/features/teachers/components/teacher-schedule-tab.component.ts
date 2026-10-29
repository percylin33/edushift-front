import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  SimpleChanges,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicApiService } from '@features/academic/services';
import { ScheduleSlotItem, NonTeachingBlockItem } from '@features/academic/models';
import { ScheduleGridComponent } from '@features/academic/components/schedule-grid.component';
import { dedupeYearScheduleSlots } from '@features/academic/utils/schedule-assignment.util';
import { ScheduleApiService } from '@features/schedule/services/schedule-api.service';

/**
 * Sub-tab "Horario" dentro de {@code teacher-detail}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Week view con recreos vía ScheduleApi.</li>
 *   <li>La vista es de consulta; la carga y su análisis se gestionan en {@code /schedule/workload}.</li>
 * </ul>
 */
@Component({
  selector: 'app-teacher-schedule-tab',
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
        <h3 class="text-base font-semibold text-content">
          {{ canEdit() ? 'Horario semanal' : 'Mi Horario Semanal' }}
        </h3>
        <p class="text-sm text-content-muted">
          @if (canEdit()) {
            Vista de consulta. Revisa su carga y periodos desde Carga docente.
          } @else {
            Resumen de todas tus asignaciones activas.
          }
        </p>
      </div>
      @if (canEdit()) {
        <a
          class="btn btn-outline btn-sm"
          [routerLink]="ROUTES.SCHEDULE.WORKLOAD"
          [queryParams]="{ teacher: teacherPublicUuid() }"
        >
          Ver carga docente
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
            [editable]="false"
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
  private readonly academicApi = inject(AcademicApiService);
  private readonly scheduleApi = inject(ScheduleApiService);
  private readonly auth = inject(AuthService);
  protected readonly ROUTES = ROUTES;

  readonly teacherPublicUuid = input.required<string>();

  protected readonly slots = signal<ScheduleSlotItem[]>([]);
  protected readonly nonTeachingBlocks = signal<NonTeachingBlockItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly canEdit = computed(() => this.auth.hasRole(UserRole.TenantAdmin));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['teacherPublicUuid']) {
      void this.loadAll();
    }
  }

  protected async loadAll(): Promise<void> {
    const uuid = this.teacherPublicUuid();
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      if (this.canEdit()) {
        const view = await firstValueFrom(this.scheduleApi.getTeacherScheduleWeek(uuid));
        const rawSlots = view.slots ?? [];
        this.slots.set(dedupeYearScheduleSlots(rawSlots));
        this.nonTeachingBlocks.set(view.nonTeachingBlocks ?? []);
      } else {
        // Teacher self: week if available, else flat schedule
        try {
          const view = await firstValueFrom(this.scheduleApi.getTeacherScheduleWeek(uuid));
          const rawSlots = view.slots ?? [];
          this.slots.set(dedupeYearScheduleSlots(rawSlots));
          this.nonTeachingBlocks.set(view.nonTeachingBlocks ?? []);
        } catch {
          const data = await firstValueFrom(this.academicApi.getTeacherSchedule(uuid));
          this.slots.set(dedupeYearScheduleSlots(data));
          this.nonTeachingBlocks.set([]);
        }
      }
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

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
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { TeachersApiService } from '@features/teachers/services';
import { ScheduleApiService } from '@features/schedule/services/schedule-api.service';
import { NonTeachingBlockItem, ScheduleSlotItem, SuggestedPeriodItem } from '../models';
import { ScheduleGridComponent, SuggestedPeriodSelection } from './schedule-grid.component';
import {
  TimeSlotAssignmentOption,
  TimeSlotFormModalComponent,
} from './time-slot-form-modal.component';

/**
 * Sub-tab "Horario" dentro de {@code section-detail}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Consume week view con recreos ({@code GET .../schedule/week}).</li>
 *   <li>TENANT_ADMIN puede crear/editar TimeSlots desde la grilla
 *       (UAT-SCH-05: conflicto con recreo visible en el modal).</li>
 * </ul>
 */
@Component({
  selector: 'app-section-schedule-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IconComponent,
    SpinnerComponent,
    ScheduleGridComponent,
    TimeSlotFormModalComponent,
  ],
  template: `
    <header class="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-content">Horario Semanal</h3>
        <p class="text-sm text-content-muted">
          @if (canEdit()) {
            Creá o editá bloques de clase; el backend rechaza solapes con recreo/lonchera.
          } @else {
            Asignaciones activas de docentes y cursos para esta sección.
          }
        </p>
      </div>
      @if (canEdit()) {
        <button type="button" class="btn btn-primary btn-sm" (click)="openCreate(1)">
          <app-icon name="plus" [size]="14" />
          Nuevo bloque
        </button>
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
            [editable]="canEdit()"
            [showSectionView]="false"
            [showTeacherView]="true"
            emptyTitle="Aún no hay horario para esta sección"
            (addRequested)="openCreate($event)"
            (slotSelected)="openEdit($event)"
            (periodSelected)="openFromPeriod($event)"
          />
        </div>
      }
    </section>

    @if (modalOpen()) {
      <app-time-slot-form-modal
        [assignments]="assignmentOptions()"
        [initialDayOfWeek]="modalDay()"
        [initialStartTime]="modalStart()"
        [initialEndTime]="modalEnd()"
        [slot]="editingSlot()"
        (closed)="closeModal()"
        (saved)="onModalSaved()"
        (deleted)="onModalSaved()"
      />
    }
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
  private readonly teachersApi = inject(TeachersApiService);
  private readonly auth = inject(AuthService);

  readonly sectionPublicUuid = input.required<string>();

  protected readonly slots = signal<ScheduleSlotItem[]>([]);
  protected readonly nonTeachingBlocks = signal<NonTeachingBlockItem[]>([]);
  protected readonly suggestedPeriods = signal<SuggestedPeriodItem[]>([]);
  protected readonly assignmentOptions = signal<TimeSlotAssignmentOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly modalDay = signal<number | null>(null);
  protected readonly modalStart = signal<string | null>(null);
  protected readonly modalEnd = signal<string | null>(null);
  protected readonly editingSlot = signal<ScheduleSlotItem | null>(null);

  protected readonly canEdit = computed(() => this.auth.hasRole(UserRole.TenantAdmin));

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
      const [view, teachers] = await Promise.all([
        firstValueFrom(this.scheduleApi.getSectionScheduleWeek(uuid)),
        this.canEdit()
          ? firstValueFrom(this.teachersApi.listSectionTeachers(uuid))
          : Promise.resolve([]),
      ]);
      this.slots.set(view.slots ?? []);
      this.nonTeachingBlocks.set(view.nonTeachingBlocks ?? []);
      this.suggestedPeriods.set(view.suggestedPeriods ?? []);
      this.assignmentOptions.set(
        teachers.map((t) => ({
          publicUuid: t.assignmentPublicUuid,
          label: `${t.courseCode} — ${t.courseName} · ${t.teacherFullName}`,
        })),
      );
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error de red');
    } finally {
      this.loading.set(false);
    }
  }

  protected retry(): void {
    void this.loadAll();
  }

  protected openCreate(dayOfWeek: number): void {
    this.editingSlot.set(null);
    this.modalDay.set(dayOfWeek);
    this.modalStart.set(null);
    this.modalEnd.set(null);
    this.modalOpen.set(true);
  }

  protected openFromPeriod(period: SuggestedPeriodSelection): void {
    this.editingSlot.set(null);
    this.modalDay.set(period.dayOfWeek);
    this.modalStart.set(period.startTime);
    this.modalEnd.set(period.endTime);
    this.modalOpen.set(true);
  }

  protected openEdit(slot: ScheduleSlotItem): void {
    this.editingSlot.set(slot);
    this.modalDay.set(null);
    this.modalStart.set(null);
    this.modalEnd.set(null);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.editingSlot.set(null);
    this.modalDay.set(null);
    this.modalStart.set(null);
    this.modalEnd.set(null);
  }

  protected onModalSaved(): void {
    this.closeModal();
    void this.loadAll();
  }
}

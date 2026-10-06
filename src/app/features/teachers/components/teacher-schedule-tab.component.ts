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
import { AcademicApiService } from '@features/academic/services';
import { ScheduleSlotItem, NonTeachingBlockItem } from '@features/academic/models';
import { ScheduleGridComponent } from '@features/academic/components/schedule-grid.component';
import {
  TimeSlotAssignmentOption,
  TimeSlotFormModalComponent,
} from '@features/academic/components/time-slot-form-modal.component';
import {
  dedupeYearScheduleSlots,
  groupTeacherAssignmentsAsYearOptions,
} from '@features/academic/utils/schedule-assignment.util';
import { ScheduleApiService } from '@features/schedule/services/schedule-api.service';
import { TeachersApiService } from '../services';

/**
 * Sub-tab "Horario" dentro de {@code teacher-detail}.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Week view con recreos vía ScheduleApi.</li>
 *   <li>TENANT_ADMIN puede crear/editar TimeSlots (API solo admin).</li>
 *   <li>TEACHER: solo lectura.</li>
 * </ul>
 */
@Component({
  selector: 'app-teacher-schedule-tab',
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
        <h3 class="text-base font-semibold text-content">
          {{ canEdit() ? 'Horario semanal' : 'Mi Horario Semanal' }}
        </h3>
        <p class="text-sm text-content-muted">
          @if (canEdit()) {
            Bloques de clase del docente. Un solape con recreo muestra el error en el modal.
          } @else {
            Resumen de todas tus asignaciones activas.
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
            [editable]="canEdit()"
            [showSectionView]="true"
            [showTeacherView]="false"
            emptyTitle="Aún no tienes horario configurado"
            (addRequested)="openCreate($event)"
            (slotSelected)="openEdit($event)"
          />
        </div>
      }
    </section>

    @if (modalOpen()) {
      <app-time-slot-form-modal
        [assignments]="assignmentOptions()"
        [yearSlots]="yearSlots()"
        [initialDayOfWeek]="modalDay()"
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
export class TeacherScheduleTabComponent implements OnChanges {
  private readonly academicApi = inject(AcademicApiService);
  private readonly scheduleApi = inject(ScheduleApiService);
  private readonly teachersApi = inject(TeachersApiService);
  private readonly auth = inject(AuthService);

  readonly teacherPublicUuid = input.required<string>();

  protected readonly slots = signal<ScheduleSlotItem[]>([]);
  /** Undeduped week slots for year-sibling find in the modal. */
  protected readonly yearSlots = signal<readonly ScheduleSlotItem[]>([]);
  protected readonly nonTeachingBlocks = signal<NonTeachingBlockItem[]>([]);
  protected readonly assignmentOptions = signal<TimeSlotAssignmentOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly modalOpen = signal(false);
  protected readonly modalDay = signal<number | null>(null);
  protected readonly editingSlot = signal<ScheduleSlotItem | null>(null);

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
        const [view, assignments] = await Promise.all([
          firstValueFrom(this.scheduleApi.getTeacherScheduleWeek(uuid)),
          firstValueFrom(this.teachersApi.listAssignments(uuid, { active: true })),
        ]);
        const rawSlots = view.slots ?? [];
        this.yearSlots.set(rawSlots);
        this.slots.set(dedupeYearScheduleSlots(rawSlots));
        this.nonTeachingBlocks.set(view.nonTeachingBlocks ?? []);
        this.assignmentOptions.set(groupTeacherAssignmentsAsYearOptions(assignments));
      } else {
        // Teacher self: week if available, else flat schedule
        try {
          const view = await firstValueFrom(this.scheduleApi.getTeacherScheduleWeek(uuid));
          const rawSlots = view.slots ?? [];
          this.yearSlots.set(rawSlots);
          this.slots.set(dedupeYearScheduleSlots(rawSlots));
          this.nonTeachingBlocks.set(view.nonTeachingBlocks ?? []);
        } catch {
          const data = await firstValueFrom(this.academicApi.getTeacherSchedule(uuid));
          this.yearSlots.set(data);
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

  protected openCreate(dayOfWeek: number): void {
    this.editingSlot.set(null);
    this.modalDay.set(dayOfWeek);
    this.modalOpen.set(true);
  }

  protected openEdit(slot: ScheduleSlotItem): void {
    this.editingSlot.set(slot);
    this.modalDay.set(null);
    this.modalOpen.set(true);
  }

  protected closeModal(): void {
    this.modalOpen.set(false);
    this.editingSlot.set(null);
    this.modalDay.set(null);
  }

  protected onModalSaved(): void {
    this.closeModal();
    void this.loadAll();
  }
}

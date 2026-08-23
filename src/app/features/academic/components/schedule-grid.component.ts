import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  input,
  output,
} from '@angular/core';
import { IconComponent, EmptyStateComponent } from '@shared/components';
import {
  ScheduleSlotItem,
  NonTeachingBlockItem,
  SuggestedPeriodItem,
  DAYS_OF_WEEK,
  WEEKDAY_VALUES,
  formatTime,
} from '../models';

export interface SuggestedPeriodSelection {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
}

/**
 * Componente reutilizable para visualizar (y opcionalmente editar) un horario semanal.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Desktop: Grid de 7 columnas (días) donde cada celda muestra los
 *       slots ordenados por hora de inicio.</li>
 *   <li>Mobile: Lista vertical agrupada por día de la semana.</li>
 *   <li>Bloques no lectivos ({@code nonTeachingBlocks}): tarjetas muted/dashed
 *       con etiqueta + hora (sin curso). {@code dayOfWeek == null} aplica
 *       a lun–vie (1–5).</li>
 *   <li>Con {@code editable=true}: botón “Agregar” por día y click en slot
 *       para editar (UAT-SCH-05 desde la grilla).</li>
 * </ul>
 */
@Component({
  selector: 'app-schedule-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, EmptyStateComponent],
  template: `
    @if (isEmpty()) {
      <app-empty-state
        icon="calendar"
        [title]="emptyTitle"
        description="Aún no hay horario configurado."
      />
    } @else {
      <!-- Vista Desktop: Grid -->
      <div class="hidden overflow-x-auto md:block">
        <div class="min-w-[800px]">
          <!-- Header -->
          <div
            class="grid grid-cols-7 gap-px overflow-hidden rounded-t-lg border border-border-subtle bg-border-subtle"
          >
            @for (day of daysOfWeek; track day.value) {
              <div
                class="bg-surface-subtle p-2 text-center text-xs font-semibold uppercase tracking-wider text-content-muted"
              >
                {{ day.label }}
              </div>
            }
          </div>
          <!-- Body -->
          <div
            class="grid grid-cols-7 gap-px overflow-hidden rounded-b-lg border-x border-b border-border-subtle bg-border-subtle"
          >
            @for (day of daysOfWeek; track day.value) {
              <div class="min-h-[120px] bg-surface p-2">
                @if (editable() && day.value <= 5) {
                  <button
                    type="button"
                    class="mb-2 flex w-full items-center justify-center gap-1 rounded border border-dashed border-border-subtle px-1 py-1.5 text-[10px] font-medium text-content-muted transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
                    (click)="onAdd(day.value)"
                  >
                    <app-icon name="plus" [size]="12" />
                    Agregar
                  </button>
                }
                @for (item of itemsByDay()[day.value]; track item.trackId) {
                  @if (item.kind === 'slot') {
                    <div
                      class="mb-2 w-full rounded border border-border-subtle bg-surface-subtle p-2 text-left text-xs transition-shadow last:mb-0 hover:shadow-sm"
                      [class.cursor-pointer]="editable()"
                      [class.hover:border-primary]="editable()"
                      role="button"
                      [attr.tabindex]="editable() ? 0 : null"
                      (click)="onSlotClick(item.slot)"
                      (keydown.enter)="onSlotClick(item.slot)"
                    >
                      <p class="truncate font-semibold text-content">
                        {{ item.slot.course.code }} - {{ item.slot.course.name }}
                      </p>
                      @if (showSection()) {
                        <p class="truncate text-content-muted">
                          {{ item.slot.section?.name }}
                        </p>
                      }
                      @if (showTeacher()) {
                        <p class="truncate text-content-muted">
                          {{ item.slot.teacher?.firstName }} {{ item.slot.teacher?.lastName }}
                        </p>
                      }
                      <div class="mt-1 flex items-center gap-1 text-[10px] text-content-muted">
                        <app-icon name="clock" [size]="12" />
                        <span
                          >{{ formatTime(item.slot.startTime) }} -
                          {{ formatTime(item.slot.endTime) }}</span
                        >
                      </div>
                      @if (item.slot.classroom) {
                        <div class="mt-0.5 flex items-center gap-1 text-[10px] text-content-muted">
                          <app-icon name="map-pin" [size]="12" />
                          <span class="truncate">{{ item.slot.classroom }}</span>
                        </div>
                      }
                    </div>
                  } @else if (item.kind === 'period') {
                    <button
                      type="button"
                      class="mb-2 w-full rounded border border-dashed border-primary/30 bg-primary/5 p-2 text-left text-xs text-primary transition-colors last:mb-0 hover:bg-primary/10"
                      [disabled]="!editable()"
                      (click)="onPeriodClick(day.value, item.period)"
                    >
                      <p class="truncate font-medium">{{ item.period.label }}</p>
                      <div class="mt-1 flex items-center gap-1 text-[10px] opacity-80">
                        <app-icon name="clock" [size]="12" />
                        <span
                          >{{ formatTime(item.period.startTime) }} -
                          {{ formatTime(item.period.endTime) }}</span
                        >
                      </div>
                      @if (editable()) {
                        <p class="mt-1 text-[10px] opacity-70">Asignar curso…</p>
                      }
                    </button>
                  } @else {
                    <div
                      class="mb-2 rounded border border-dashed border-border-subtle bg-surface/60 p-2 text-xs text-content-muted last:mb-0"
                    >
                      <p class="truncate font-medium">{{ item.block.label }}</p>
                      <div class="mt-1 flex items-center gap-1 text-[10px]">
                        <app-icon name="clock" [size]="12" />
                        <span
                          >{{ formatTime(item.block.startTime) }} -
                          {{ formatTime(item.block.endTime) }}</span
                        >
                      </div>
                    </div>
                  }
                }
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Vista Mobile: Lista vertical agrupada por día -->
      <div class="space-y-4 md:hidden">
        @for (day of daysOfWeek; track day.value) {
          @if (itemsByDay()[day.value].length > 0 || (editable() && day.value <= 5)) {
            <div class="card">
              <header class="card-header flex items-center justify-between gap-2">
                <h3 class="card-title text-sm">{{ day.label }}</h3>
                @if (editable() && day.value <= 5) {
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    (click)="onAdd(day.value)"
                  >
                    <app-icon name="plus" [size]="14" />
                    Agregar
                  </button>
                }
              </header>
              <div class="card-body space-y-2">
                @for (item of itemsByDay()[day.value]; track item.trackId) {
                  @if (item.kind === 'slot') {
                    <div
                      class="w-full rounded border border-border-subtle bg-surface-subtle p-3 text-left"
                      [class.cursor-pointer]="editable()"
                      role="button"
                      [attr.tabindex]="editable() ? 0 : null"
                      (click)="onSlotClick(item.slot)"
                      (keydown.enter)="onSlotClick(item.slot)"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-semibold text-content">
                            {{ item.slot.course.code }} - {{ item.slot.course.name }}
                          </p>
                          @if (showSection()) {
                            <p class="truncate text-xs text-content-muted">
                              {{ item.slot.section?.name }}
                            </p>
                          }
                          @if (showTeacher()) {
                            <p class="truncate text-xs text-content-muted">
                              {{ item.slot.teacher?.firstName }} {{ item.slot.teacher?.lastName }}
                            </p>
                          }
                          <div
                            class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted"
                          >
                            <span class="flex items-center gap-1">
                              <app-icon name="clock" [size]="14" />
                              {{ formatTime(item.slot.startTime) }} -
                              {{ formatTime(item.slot.endTime) }}
                            </span>
                            @if (item.slot.classroom) {
                              <span class="flex items-center gap-1">
                                <app-icon name="map-pin" [size]="14" />
                                {{ item.slot.classroom }}
                              </span>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  } @else if (item.kind === 'period') {
                    <button
                      type="button"
                      class="w-full rounded border border-dashed border-primary/30 bg-primary/5 p-3 text-left text-primary"
                      [disabled]="!editable()"
                      (click)="onPeriodClick(day.value, item.period)"
                    >
                      <p class="truncate text-sm font-medium">{{ item.period.label }}</p>
                      <div class="mt-1.5 flex items-center gap-1 text-xs opacity-80">
                        <app-icon name="clock" [size]="14" />
                        {{ formatTime(item.period.startTime) }} -
                        {{ formatTime(item.period.endTime) }}
                      </div>
                    </button>
                  } @else {
                    <div
                      class="rounded border border-dashed border-border-subtle bg-surface/60 p-3 text-content-muted"
                    >
                      <p class="truncate text-sm font-medium">{{ item.block.label }}</p>
                      <div class="mt-1.5 flex items-center gap-1 text-xs">
                        <app-icon name="clock" [size]="14" />
                        {{ formatTime(item.block.startTime) }} - {{ formatTime(item.block.endTime) }}
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          }
        }
      </div>
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
export class ScheduleGridComponent {
  readonly slots = input<readonly ScheduleSlotItem[]>([]);
  /** Optional non-teaching blocks (recess/lunch/assembly). */
  readonly nonTeachingBlocks = input<readonly NonTeachingBlockItem[]>([]);
  /** Suggested academic periods from day plan (ADR-SCH-12). */
  readonly suggestedPeriods = input<readonly SuggestedPeriodItem[]>([]);
  /** When true, shows per-day add controls and makes slots clickable. */
  readonly editable = input(false);
  /** Si es true, muestra la sección en cada slot (modo Teacher-centric). */
  @Input() showSectionView = true;
  /** Si es true, muestra el docente en cada slot (modo Section-centric). */
  @Input() showTeacherView = true;
  @Input() emptyTitle = 'Aún no hay horario configurado';

  readonly addRequested = output<number>();
  readonly slotSelected = output<ScheduleSlotItem>();
  readonly periodSelected = output<SuggestedPeriodSelection>();

  protected readonly daysOfWeek = DAYS_OF_WEEK;
  protected readonly formatTime = formatTime;

  protected readonly itemsByDay = computed(() => {
    type DayItem =
      | { kind: 'slot'; trackId: string; startTime: string; slot: ScheduleSlotItem }
      | { kind: 'block'; trackId: string; startTime: string; block: NonTeachingBlockItem }
      | { kind: 'period'; trackId: string; startTime: string; period: SuggestedPeriodItem };

    const grouped: Record<number, DayItem[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    };

    for (const slot of this.slots()) {
      if (grouped[slot.dayOfWeek]) {
        grouped[slot.dayOfWeek].push({
          kind: 'slot',
          trackId: `s-${slot.slotPublicUuid}`,
          startTime: slot.startTime,
          slot,
        });
      }
    }

    for (const block of this.nonTeachingBlocks()) {
      const days =
        block.dayOfWeek == null ? [...WEEKDAY_VALUES] : [block.dayOfWeek];
      for (const day of days) {
        if (grouped[day]) {
          grouped[day].push({
            kind: 'block',
            trackId: `b-${block.blockPublicUuid}-${day}`,
            startTime: block.startTime,
            block,
          });
        }
      }
    }

    const periods = this.suggestedPeriods();
    if (periods.length > 0) {
      for (const day of WEEKDAY_VALUES) {
        const daySlots = this.slots().filter((s) => s.dayOfWeek === day);
        for (const period of periods) {
          const overlapsSlot = daySlots.some((s) =>
            this.timesOverlap(s.startTime, s.endTime, period.startTime, period.endTime),
          );
          if (overlapsSlot) continue;
          grouped[day].push({
            kind: 'period',
            trackId: `p-${period.ordinal}-${day}`,
            startTime: period.startTime,
            period,
          });
        }
      }
    }

    for (const day of Object.keys(grouped)) {
      grouped[+day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return grouped;
  });

  protected readonly isEmpty = computed(
    () =>
      !this.editable() &&
      this.slots().length === 0 &&
      this.nonTeachingBlocks().length === 0 &&
      this.suggestedPeriods().length === 0,
  );
  protected readonly showSection = computed(() => this.showSectionView);
  protected readonly showTeacher = computed(() => this.showTeacherView);

  protected onAdd(dayOfWeek: number): void {
    this.addRequested.emit(dayOfWeek);
  }

  protected onSlotClick(slot: ScheduleSlotItem): void {
    if (!this.editable()) return;
    this.slotSelected.emit(slot);
  }

  protected onPeriodClick(dayOfWeek: number, period: SuggestedPeriodItem): void {
    if (!this.editable()) return;
    this.periodSelected.emit({
      dayOfWeek,
      startTime: period.startTime,
      endTime: period.endTime,
      label: period.label,
    });
  }

  private timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    return aStart < bEnd && bStart < aEnd;
  }
}

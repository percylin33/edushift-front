import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { IconComponent, EmptyStateComponent } from '@shared/components';
import { ScheduleSlotItem, DAYS_OF_WEEK, formatTime } from '../models';

/**
 * Componente reutilizable para visualizar un horario semanal.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li>Desktop: Grid de 7 columnas (días) donde cada celda muestra los
 *       slots ordenados por hora de inicio.</li>
 *   <li>Mobile: Lista vertical agrupada por día de la semana.</li>
 *   <li>Soporta dos modos de visualización según el contexto:
 *       - Teacher-centric: muestra {@code course} y {@code section}.</li>
 *       - Section-centric: muestra {@code course} y {@code teacher}.</li>
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
                @for (slot of slotsByDay()[day.value]; track slot.slotPublicUuid) {
                  <div
                    class="mb-2 rounded border border-border-subtle bg-surface-subtle p-2 text-xs transition-shadow last:mb-0 hover:shadow-sm"
                  >
                    <p class="truncate font-semibold text-content">
                      {{ slot.course.code }} - {{ slot.course.name }}
                    </p>
                    @if (showSection()) {
                      <p class="truncate text-content-muted">
                        {{ slot.section?.name }}
                      </p>
                    }
                    @if (showTeacher()) {
                      <p class="truncate text-content-muted">
                        {{ slot.teacher?.firstName }} {{ slot.teacher?.lastName }}
                      </p>
                    }
                    <div class="mt-1 flex items-center gap-1 text-[10px] text-content-muted">
                      <app-icon name="clock" [size]="12" />
                      <span>{{ formatTime(slot.startTime) }} - {{ formatTime(slot.endTime) }}</span>
                    </div>
                    @if (slot.classroom) {
                      <div class="mt-0.5 flex items-center gap-1 text-[10px] text-content-muted">
                        <app-icon name="map-pin" [size]="12" />
                        <span class="truncate">{{ slot.classroom }}</span>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Vista Mobile: Lista vertical agrupada por día -->
      <div class="space-y-4 md:hidden">
        @for (day of daysOfWeek; track day.value) {
          @if (slotsByDay()[day.value].length > 0) {
            <div class="card">
              <header class="card-header">
                <h3 class="card-title text-sm">{{ day.label }}</h3>
              </header>
              <div class="card-body space-y-2">
                @for (slot of slotsByDay()[day.value]; track slot.slotPublicUuid) {
                  <div class="rounded border border-border-subtle bg-surface-subtle p-3">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-semibold text-content">
                          {{ slot.course.code }} - {{ slot.course.name }}
                        </p>
                        @if (showSection()) {
                          <p class="truncate text-xs text-content-muted">
                            {{ slot.section?.name }}
                          </p>
                        }
                        @if (showTeacher()) {
                          <p class="truncate text-xs text-content-muted">
                            {{ slot.teacher?.firstName }} {{ slot.teacher?.lastName }}
                          </p>
                        }
                        <div
                          class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted"
                        >
                          <span class="flex items-center gap-1">
                            <app-icon name="clock" [size]="14" />
                            {{ formatTime(slot.startTime) }} - {{ formatTime(slot.endTime) }}
                          </span>
                          @if (slot.classroom) {
                            <span class="flex items-center gap-1">
                              <app-icon name="map-pin" [size]="14" />
                              {{ slot.classroom }}
                            </span>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
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
  @Input() slots: ScheduleSlotItem[] = [];
  /** Si es true, muestra la sección en cada slot (modo Teacher-centric). */
  @Input() showSectionView = true;
  /** Si es true, muestra el docente en cada slot (modo Section-centric). */
  @Input() showTeacherView = true;
  @Input() emptyTitle = 'Aún no hay horario configurado';

  protected readonly daysOfWeek = DAYS_OF_WEEK;
  protected readonly formatTime = formatTime;

  protected readonly slotsByDay = computed(() => {
    const grouped: Record<number, ScheduleSlotItem[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    };
    for (const slot of this.slots) {
      if (grouped[slot.dayOfWeek]) {
        grouped[slot.dayOfWeek].push(slot);
      }
    }
    // Ordenar por hora de inicio dentro de cada día
    for (const day of Object.keys(grouped)) {
      grouped[+day].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return grouped;
  });

  protected readonly isEmpty = computed(() => this.slots.length === 0);
  protected readonly showSection = computed(() => this.showSectionView);
  protected readonly showTeacher = computed(() => this.showTeacherView);
}

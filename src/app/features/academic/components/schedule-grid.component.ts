import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { IconComponent, EmptyStateComponent, IconName } from '@shared/components';
import {
  courseTintAvatarBg,
  courseTintBg,
  courseTintBorder,
  resolveCourseVisual,
} from '../utils/course-visual.util';
import {
  NonTeachingBlockItem,
  ScheduleSlotItem,
  SuggestedPeriodItem,
  DAYS_OF_WEEK,
  WEEKDAY_VALUES,
  formatTime,
  scheduleSectionGrade,
  scheduleSectionLine,
} from '../models';

export interface SuggestedPeriodSelection {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  label: string;
}

const LS_COLOR_VIEW = 'edushift.schedule.colorView';
const LS_SHOW_WEEKEND = 'edushift.schedule.showWeekend';

function readLsFlag(key: string, fallback: boolean): boolean {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === '1' || raw === 'true';
  } catch {
    return fallback;
  }
}

function writeLsFlag(key: string, value: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}

type LaidOutItem =
  | {
      kind: 'slot';
      trackId: string;
      startTime: string;
      endTime: string;
      topPx: number;
      heightPx: number;
      slot: ScheduleSlotItem;
    }
  | {
      kind: 'block';
      trackId: string;
      startTime: string;
      endTime: string;
      topPx: number;
      heightPx: number;
      block: NonTeachingBlockItem;
    }
  | {
      kind: 'period';
      trackId: string;
      startTime: string;
      endTime: string;
      topPx: number;
      heightPx: number;
      period: SuggestedPeriodItem;
    };

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
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="btn btn-sm"
          [class.btn-primary]="colorView()"
          [class.btn-ghost]="!colorView()"
          [attr.aria-pressed]="colorView()"
          (click)="toggleColorView()"
        >
          <app-icon name="palette" [size]="14" />
          <span>Vista a color</span>
        </button>
        <button
          type="button"
          class="btn btn-sm"
          [class.btn-primary]="showWeekend()"
          [class.btn-ghost]="!showWeekend()"
          [attr.aria-pressed]="showWeekend()"
          (click)="toggleWeekend()"
        >
          <app-icon name="calendar" [size]="14" />
          <span>Fin de semana</span>
        </button>
      </div>
      <!-- Vista Desktop: Grid alineada por hora -->
      <div class="hidden overflow-x-auto md:block">
        <div class="sch-shell min-w-[800px]" [class.sch-shell--weekend]="showWeekend()">
          <!-- Header -->
          <div
            class="sch-grid sch-grid--header rounded-t-lg border border-border-subtle bg-border-subtle"
            [style.grid-template-columns]="gridTemplateColumns()"
          >
            @for (day of visibleDays(); track day.value) {
              <div
                class="sch-day-head bg-surface-subtle px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-content-muted"
                [class.sch-day-head--weekend]="day.value > 5"
              >
                {{ day.label }}
              </div>
            }
          </div>
          <!-- Body -->
          <div class="sch-week-body rounded-b-lg border-x border-b border-border-subtle bg-border-subtle">
            <div
              class="sch-grid sch-grid--toolbar"
              [style.grid-template-columns]="gridTemplateColumns()"
            >
              @for (day of visibleDays(); track day.value) {
                <div class="sch-toolbar-cell bg-surface px-2 pt-2" [class.sch-toolbar-cell--weekend]="day.value > 5">
                  @if (editable() && day.value <= 5) {
                    <button
                      type="button"
                      class="sch-add-btn mb-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border-subtle px-1 py-1.5 text-[10px] font-medium text-content-muted transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                      (click)="onAdd(day.value)"
                    >
                      <app-icon name="plus" [size]="12" />
                      Agregar
                    </button>
                  }
                </div>
              }
            </div>
            <div class="sch-timeline-shell px-2 pb-2 pt-1">
              <div class="sch-timeline relative" [style.height.px]="timelineHeightPx()">
                <div
                  class="sch-grid sch-timeline-grid h-full"
                  [style.grid-template-columns]="gridTemplateColumns()"
                >
                  @for (day of visibleDays(); track day.value) {
                    <div
                      class="sch-day-lane relative h-full min-w-0"
                      [class.sch-day-lane--weekend]="day.value > 5"
                    >
                      @for (row of uniformGridRows(); track row.key) {
                        @if (row.kind === 'teach') {
                          <div
                            class="sch-row-guide sch-row-guide--teach"
                            [class.sch-row-guide--free]="!rowHasCoverage(day.value, row)"
                            [style.top.px]="row.topPx"
                            [style.height.px]="row.heightPx"
                          >
                            @if (!rowHasCoverage(day.value, row)) {
                              <span class="sch-free-label">Hora libre</span>
                            }
                          </div>
                        } @else {
                          <div
                            class="sch-row-guide"
                            [style.top.px]="row.topPx"
                            [style.height.px]="row.heightPx"
                          ></div>
                        }
                      }
                      @for (item of laidOutByDay()[day.value]; track item.trackId) {
                        @if (item.kind === 'slot') {
                          <div
                            class="sch-item sch-item--slot"
                            [class.sch-item--colored]="colorView()"
                            [class.sch-item--tall]="isTall(item.heightPx)"
                            [class.sch-item--compact]="isCompact(item.heightPx)"
                            [style.top.px]="item.topPx"
                            [style.height.px]="item.heightPx"
                            [style.background]="slotBg(item.slot)"
                            [style.border-left-color]="colorView() ? slotBorder(item.slot) : null"
                            [class.sch-item--interactive]="editable()"
                            role="button"
                            [attr.tabindex]="editable() ? 0 : null"
                            (click)="onSlotClick(item.slot)"
                            (keydown.enter)="onSlotClick(item.slot)"
                          >
                            @if (isCompact(item.heightPx)) {
                              <div class="flex items-center gap-1">
                                @if (colorView()) {
                                  <span
                                    class="sch-slot-icon shrink-0"
                                    [style.background-color]="slotAvatarBg(item.slot)"
                                    [style.color]="slotVisual(item.slot).color"
                                    aria-hidden="true"
                                  >
                                    <app-icon [name]="slotVisual(item.slot).icon" [size]="11" />
                                  </span>
                                }
                                <p class="sch-compact-line min-w-0 flex-1 font-semibold text-content">
                                  {{ item.slot.course.code }}
                                  · {{ formatTime(item.slot.startTime) }}-{{
                                    formatTime(item.slot.endTime)
                                  }}
                                </p>
                              </div>
                            } @else {
                              <div class="flex items-start justify-between gap-1">
                                <p class="min-w-0 flex-1 truncate font-semibold text-content">
                                  {{ item.slot.course.code }} - {{ item.slot.course.name }}
                                </p>
                                @if (colorView()) {
                                  <span
                                    class="sch-slot-icon shrink-0"
                                    [style.background-color]="slotAvatarBg(item.slot)"
                                    [style.color]="slotVisual(item.slot).color"
                                    aria-hidden="true"
                                  >
                                    <app-icon [name]="slotVisual(item.slot).icon" [size]="12" />
                                  </span>
                                }
                              </div>
                              @if (showSection()) {
                                <div class="space-y-0.5">
                                  @if (scheduleSectionGrade(item.slot.section)) {
                                    <p class="truncate text-[11px] text-content-muted">
                                      {{ scheduleSectionGrade(item.slot.section) }}
                                    </p>
                                  }
                                  @if (scheduleSectionLine(item.slot.section)) {
                                    <p class="truncate text-[10px] text-content-subtle">
                                      {{ scheduleSectionLine(item.slot.section) }}
                                    </p>
                                  }
                                </div>
                              }
                              @if (showTeacher()) {
                                <p class="truncate text-content-muted">
                                  {{ item.slot.teacher?.firstName }}
                                  {{ item.slot.teacher?.lastName }}
                                </p>
                              }
                              <div
                                class="flex items-center gap-1 text-[10px] text-content-muted"
                                [class.mt-0.5]="!isTall(item.heightPx)"
                                [class.justify-center]="isTall(item.heightPx)"
                              >
                                <app-icon name="clock" [size]="12" />
                                <span
                                  >{{ formatTime(item.slot.startTime) }} -
                                  {{ formatTime(item.slot.endTime) }}</span
                                >
                              </div>
                              @if (item.slot.classroom) {
                                <div
                                  class="flex items-center gap-1 text-[10px] text-content-muted"
                                  [class.mt-0.5]="!isTall(item.heightPx)"
                                  [class.justify-center]="isTall(item.heightPx)"
                                >
                                  <app-icon name="map-pin" [size]="12" />
                                  <span class="truncate">{{ item.slot.classroom }}</span>
                                </div>
                              }
                            }
                          </div>
                        } @else if (item.kind === 'period') {
                          <button
                            type="button"
                            class="sch-item sch-item--period"
                            [class.sch-item--tall]="isTall(item.heightPx)"
                            [class.sch-item--compact]="isCompact(item.heightPx)"
                            [style.top.px]="item.topPx"
                            [style.height.px]="item.heightPx"
                            [disabled]="!editable()"
                            (click)="onPeriodClick(day.value, item.period)"
                          >
                            @if (isCompact(item.heightPx)) {
                              <span class="sch-compact-line">
                                {{ item.period.label }}
                                · {{ formatTime(item.period.startTime) }}-{{
                                  formatTime(item.period.endTime)
                                }}
                              </span>
                            } @else {
                              <p class="truncate font-medium">{{ item.period.label }}</p>
                              <div
                                class="flex items-center gap-1 text-[10px] opacity-80"
                                [class.mt-0.5]="!isTall(item.heightPx)"
                                [class.justify-center]="isTall(item.heightPx)"
                              >
                                <app-icon name="clock" [size]="12" />
                                <span
                                  >{{ formatTime(item.period.startTime) }} -
                                  {{ formatTime(item.period.endTime) }}</span
                                >
                              </div>
                              @if (editable()) {
                                <p class="sch-period-cta">Asignar curso…</p>
                              }
                            }
                          </button>
                        } @else if (item.kind === 'block' && !isBandBlockItem(item.block)) {
                          <div
                            class="sch-item sch-item--block rounded border border-dashed border-border-subtle bg-surface/60 text-xs text-content-muted"
                            [class.sch-item--tall]="isTall(item.heightPx)"
                            [style.top.px]="item.topPx"
                            [style.height.px]="item.heightPx"
                          >
                            <p class="truncate font-medium">{{ item.block.label }}</p>
                            <div class="mt-0.5 flex items-center gap-1 text-[10px]">
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
                @if (sharedBands().length > 0) {
                  <div
                    class="sch-bands-layer"
                    [style.grid-template-columns]="gridTemplateColumns()"
                  >
                    @for (band of sharedBands(); track band.trackId) {
                      <div
                        class="sch-band"
                        [class.sch-band--recess]="isRecessBand(band.block)"
                        [class.sch-band--lunch]="isLunchBand(band.block)"
                        [style.grid-column]="'1 / span ' + bandSpan()"
                        [style.margin-top.px]="band.topPx"
                        [style.height.px]="band.heightPx"
                      >
                        <p class="sch-band-label">{{ band.label }}</p>
                        <p class="sch-band-time">
                          {{ formatTime(band.startTime) }} – {{ formatTime(band.endTime) }}
                        </p>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Vista Mobile: Lista vertical agrupada por día -->
      <div class="space-y-4 md:hidden">
        @if (sharedBands().length > 0) {
          <div class="card">
            <div class="card-body flex flex-wrap gap-3">
              @for (band of sharedBands(); track band.trackId) {
                <div
                  class="min-w-[140px] flex-1 rounded-lg border border-dashed border-border-subtle bg-surface-subtle px-3 py-2 text-center"
                >
                  <p class="text-xs font-semibold uppercase tracking-wide text-content-muted">
                    {{ band.label }}
                  </p>
                  <p class="text-sm font-bold text-content">
                    {{ formatTime(band.startTime) }} – {{ formatTime(band.endTime) }}
                  </p>
                </div>
              }
            </div>
          </div>
        }
        @for (day of visibleDays(); track day.value) {
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
                      class="w-full rounded border border-border-subtle p-3 text-left"
                      [class.bg-surface-subtle]="!colorView()"
                      [class.cursor-pointer]="editable()"
                      [style.background]="slotBg(item.slot)"
                      [style.border-left]="colorView() ? '3px solid ' + slotBorder(item.slot) : null"
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
                            <div class="space-y-0.5">
                              @if (scheduleSectionGrade(item.slot.section)) {
                                <p class="truncate text-xs text-content-muted">
                                  {{ scheduleSectionGrade(item.slot.section) }}
                                </p>
                              }
                              @if (scheduleSectionLine(item.slot.section)) {
                                <p class="truncate text-[11px] text-content-subtle">
                                  {{ scheduleSectionLine(item.slot.section) }}
                                </p>
                              }
                            </div>
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
                        @if (colorView()) {
                          <span
                            class="sch-slot-icon shrink-0"
                            [style.background-color]="slotAvatarBg(item.slot)"
                            [style.color]="slotVisual(item.slot).color"
                            aria-hidden="true"
                          >
                            <app-icon [name]="slotVisual(item.slot).icon" [size]="14" />
                          </span>
                        }
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
        --sch-teach-row-h: 72px;
        --sch-slot-accent: var(--color-primary, #2563eb);
        --sch-band-recess-bg: #e2e8f0;
        --sch-band-lunch-bg: #cbd5e1;
      }

      .sch-shell {
        overflow: hidden;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgb(15 23 42 / 6%);
      }

      .sch-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 1px;
      }

      .sch-grid--header {
        overflow: hidden;
      }

      .sch-day-head--weekend,
      .sch-toolbar-cell--weekend,
      .sch-day-lane--weekend {
        opacity: 0.72;
      }

      .sch-day-lane--weekend {
        background: rgb(248 250 252 / 65%);
      }

      .sch-week-body {
        overflow: visible;
      }

      .sch-timeline-shell,
      .sch-timeline {
        overflow: visible;
      }

      .sch-timeline {
        position: relative;
      }

      .sch-timeline-grid {
        position: relative;
        z-index: 1;
      }

      .sch-day-lane {
        position: relative;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        background: rgb(255 255 255 / 96%);
      }

      .sch-row-guide {
        position: absolute;
        inset-inline: 0;
        pointer-events: none;
        box-sizing: border-box;
        border-bottom: 1px solid rgb(148 163 184 / 22%);
      }

      .sch-row-guide--teach {
        display: flex;
        align-items: center;
        justify-content: center;
        padding-inline: 4px;
      }

      .sch-row-guide--free {
        background: rgb(248 250 252 / 72%);
        border-bottom: 1px dashed rgb(148 163 184 / 28%);
      }

      .sch-free-label {
        font-size: 10px;
        font-weight: 600;
        line-height: 1.2;
        color: rgb(148 163 184);
        text-transform: uppercase;
        letter-spacing: 0.07em;
        user-select: none;
      }

      .sch-bands-layer {
        position: absolute;
        inset: 0;
        z-index: 30;
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 1px;
        pointer-events: none;
        align-content: start;
      }

      .sch-band {
        grid-row: 1;
        width: calc(100% - 4px);
        margin-inline: 2px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        box-sizing: border-box;
        padding: 4px 12px;
        text-align: center;
        border: 1px dashed rgb(100 116 139 / 55%);
        border-radius: 8px;
        background: var(--sch-band-recess-bg);
        box-shadow: inset 0 1px 0 rgb(255 255 255 / 65%);
      }

      .sch-band--lunch {
        background: var(--sch-band-lunch-bg);
        border-color: rgb(71 85 105 / 45%);
      }

      .sch-band-label {
        margin: 0;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.2;
        color: rgb(71 85 105);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .sch-band-time {
        margin: 0;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        color: rgb(15 23 42);
        font-variant-numeric: tabular-nums;
      }

      .sch-item {
        position: absolute !important;
        inset-inline: 3px;
        width: auto;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        overflow: hidden;
        margin: 0;
        padding: 5px 7px;
        font-size: 11px;
        line-height: 1.25;
        text-align: left;
        z-index: 2;
        border-radius: 7px;
        transition:
          box-shadow 0.15s ease,
          border-color 0.15s ease,
          transform 0.15s ease;
      }

      .sch-item--slot {
        border: 1px solid rgb(148 163 184 / 45%);
        border-left-width: 3px;
        border-left-color: var(--sch-slot-accent);
        background: linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 100%);
        color: inherit;
        box-shadow: 0 1px 2px rgb(15 23 42 / 5%);
      }

      .sch-item--slot.sch-item--colored {
        background: transparent;
      }

      .sch-slot-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 0.4rem;
      }

      .sch-item--period {
        border: 1px dashed rgb(37 99 235 / 28%);
        background: rgb(37 99 235 / 5%);
        color: rgb(29 78 216);
      }

      .sch-item--period:not(:disabled):hover {
        background: rgb(37 99 235 / 9%);
        border-color: rgb(37 99 235 / 42%);
      }

      .sch-item--interactive {
        cursor: pointer;
      }

      .sch-item--interactive:hover {
        border-color: rgb(37 99 235 / 45%);
        box-shadow: 0 2px 6px rgb(15 23 42 / 8%);
      }

      .sch-item--block {
        border: 1px dashed rgb(148 163 184 / 50%);
        background: rgb(248 250 252 / 85%);
        color: rgb(100 116 139);
      }

      .sch-item--tall {
        align-items: center;
        justify-content: center;
        place-content: center;
        text-align: center;
        padding-inline: 8px;
      }

      .sch-item--compact {
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 3px 5px;
      }

      .sch-compact-line {
        width: 100%;
        font-size: 10px;
        line-height: 1.2;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .sch-period-cta {
        margin: 2px 0 0;
        font-size: 10px;
        font-weight: 500;
        opacity: 0.75;
      }

      button.sch-item {
        appearance: none;
        -webkit-appearance: none;
        font-family: inherit;
      }

      button.sch-item:disabled {
        opacity: 0.85;
        cursor: default;
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

  /** Nominal period length from API (fallback: inferred from suggested periods). */
  readonly periodMinutes = input<number | null>(null);

  readonly addRequested = output<number>();
  readonly slotSelected = output<ScheduleSlotItem>();
  readonly periodSelected = output<SuggestedPeriodSelection>();

  protected readonly colorView = signal(readLsFlag(LS_COLOR_VIEW, false));
  protected readonly showWeekend = signal(readLsFlag(LS_SHOW_WEEKEND, false));

  protected readonly visibleDays = computed(() =>
    this.showWeekend() ? DAYS_OF_WEEK : DAYS_OF_WEEK.filter((d) => d.value <= 5),
  );

  protected readonly gridTemplateColumns = computed(
    () => `repeat(${this.visibleDays().length}, minmax(0, 1fr))`,
  );

  /** Recess/lunch bands span weekday columns only. */
  protected readonly bandSpan = computed(() =>
    this.visibleDays().filter((d) => d.value <= 5).length,
  );

  protected readonly formatTime = formatTime;

  protected toggleColorView(): void {
    this.colorView.update((v) => {
      const next = !v;
      writeLsFlag(LS_COLOR_VIEW, next);
      return next;
    });
  }

  protected toggleWeekend(): void {
    this.showWeekend.update((v) => {
      const next = !v;
      writeLsFlag(LS_SHOW_WEEKEND, next);
      return next;
    });
  }

  protected slotVisual(slot: ScheduleSlotItem): { icon: IconName; color: string } {
    return resolveCourseVisual(slot.course.code, slot.course.color, slot.course.icon);
  }

  protected slotBg(slot: ScheduleSlotItem): string | null {
    if (!this.colorView()) return null;
    return courseTintBg(this.slotVisual(slot).color);
  }

  protected slotBorder(slot: ScheduleSlotItem): string {
    return courseTintBorder(this.slotVisual(slot).color);
  }

  protected slotAvatarBg(slot: ScheduleSlotItem): string {
    return courseTintAvatarBg(this.slotVisual(slot).color);
  }

  protected readonly itemsByDay = computed(() => {
    type DayItem =
      | {
          kind: 'slot';
          trackId: string;
          startTime: string;
          endTime: string;
          slot: ScheduleSlotItem;
        }
      | {
          kind: 'block';
          trackId: string;
          startTime: string;
          endTime: string;
          block: NonTeachingBlockItem;
        }
      | {
          kind: 'period';
          trackId: string;
          startTime: string;
          endTime: string;
          period: SuggestedPeriodItem;
        };

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
          endTime: slot.endTime,
          slot,
        });
      }
    }

    for (const block of this.nonTeachingBlocks()) {
      if (this.isBandBlock(block)) {
        continue;
      }
      if (block.dayOfWeek != null && grouped[block.dayOfWeek]) {
        grouped[block.dayOfWeek].push({
          kind: 'block',
          trackId: `b-${block.blockPublicUuid}-${block.dayOfWeek}`,
          startTime: block.startTime,
          endTime: block.endTime,
          block,
        });
      }
    }

    const bandBlocks = this.bandBlocksDeduped();
    const blocksForDay = (day: number): NonTeachingBlockItem[] =>
      bandBlocks.filter((b) =>
        b.dayOfWeek == null
          ? (WEEKDAY_VALUES as readonly number[]).includes(day)
          : b.dayOfWeek === day,
      );

    const periods = this.suggestedPeriods();
    if (periods.length > 0) {
      for (const day of WEEKDAY_VALUES) {
        const daySlots = this.slots().filter((s) => s.dayOfWeek === day);
        const dayBlocks = blocksForDay(day);
        for (const period of periods) {
          const overlapsSlot = daySlots.some((s) =>
            this.timesOverlap(s.startTime, s.endTime, period.startTime, period.endTime),
          );
          const overlapsBlock = dayBlocks.some((b) =>
            this.timesOverlap(b.startTime, b.endTime, period.startTime, period.endTime),
          );
          if (overlapsSlot || overlapsBlock) continue;
          grouped[day].push({
            kind: 'period',
            trackId: `p-${period.ordinal}-${day}`,
            startTime: period.startTime,
            endTime: period.endTime,
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

  /** Uniform row grid: fixed height per period slice + fixed band rows (shared x-axis). */
  protected readonly uniformGridRows = computed(() => this.buildUniformGridRows());

  protected readonly timelineHeightPx = computed(() => {
    const rows = this.uniformGridRows();
    if (!rows.length) return 120;
    const last = rows[rows.length - 1];
    return last.topPx + last.heightPx;
  });

  /** Recess/lunch blocks shared Mon–Fri — one horizontal band instead of per-day tiles. */
  protected readonly sharedBands = computed(() => {
    const rows = this.uniformGridRows();
    return this.bandBlocksDeduped().map((block) => {
      const layout = this.layoutOnUniformRows(
        this.toMinutes(block.startTime),
        this.toMinutes(block.endTime),
        rows,
      );
      return {
        trackId: `band-${block.blockPublicUuid}`,
        label: block.label,
        startTime: block.startTime,
        endTime: block.endTime,
        topPx: layout?.topPx ?? 0,
        heightPx: layout?.heightPx ?? this.bandSegmentHeightPx(
          this.toMinutes(block.startTime),
          this.toMinutes(block.endTime),
          this.resolvePeriodMinutes(),
        ),
        block,
      };
    });
  });

  /** Items snapped to uniform rows so every column shares the same horizontal grid. */
  protected readonly laidOutByDay = computed(() => {
    const grouped = this.itemsByDay();
    const rows = this.uniformGridRows();
    const result: Record<number, LaidOutItem[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
      7: [],
    };

    for (const dayKey of Object.keys(grouped)) {
      const day = +dayKey;
      result[day] = grouped[day].flatMap((item): LaidOutItem[] => {
        const startMin = this.toMinutes(item.startTime);
        const endMin = this.toMinutes(item.endTime);
        const layout = this.layoutOnUniformRows(startMin, endMin, rows);
        if (!layout) return [];
        const base = {
          trackId: item.trackId,
          startTime: item.startTime,
          endTime: item.endTime,
          topPx: layout.topPx,
          heightPx: layout.heightPx,
        };
        if (item.kind === 'slot') {
          return [{ kind: 'slot', ...base, slot: item.slot }];
        }
        if (item.kind === 'period') {
          return [{ kind: 'period', ...base, period: item.period }];
        }
        return [{ kind: 'block', ...base, block: item.block }];
      });
    }
    return result;
  });

  private readonly teachRowHeightPx = 72;

  private bandSegmentHeightPx(startMin: number, endMin: number, sliceMin: number): number {
    const duration = Math.max(1, endMin - startMin);
    return Math.max(28, Math.round((duration / sliceMin) * this.teachRowHeightPx));
  }

  private buildUniformGridRows(): Array<{
    key: string;
    kind: 'teach' | 'band';
    startMin: number;
    endMin: number;
    topPx: number;
    heightPx: number;
  }> {
    const sliceMin = this.resolvePeriodMinutes();
    type Seg = { startMin: number; endMin: number; kind: 'teach' | 'band' };
    const segments: Seg[] = [];

    for (const interval of this.teachIntervalsForGrid()) {
      let cursor = interval.startMin;
      const end = interval.endMin;
      while (cursor < end) {
        const sliceEnd = Math.min(cursor + sliceMin, end);
        segments.push({ startMin: cursor, endMin: sliceEnd, kind: 'teach' });
        cursor = sliceEnd;
      }
    }

    for (const band of this.bandBlocksDeduped()) {
      segments.push({
        startMin: this.toMinutes(band.startTime),
        endMin: this.toMinutes(band.endTime),
        kind: 'band',
      });
    }

    segments.sort((a, b) => a.startMin - b.startMin || (a.kind === 'teach' ? -1 : 1));

    let top = 0;
    return segments.map((seg, index) => {
      const heightPx =
        seg.kind === 'band'
          ? this.bandSegmentHeightPx(seg.startMin, seg.endMin, sliceMin)
          : this.teachRowHeightPx;
      const row = {
        key: `${seg.kind}-${index}-${seg.startMin}`,
        kind: seg.kind,
        startMin: seg.startMin,
        endMin: seg.endMin,
        topPx: top,
        heightPx,
      };
      top += heightPx;
      return row;
    });
  }

  /**
   * Preferred: day-plan {@code suggestedPeriods} (section week view).
   * Fallback: derive teach windows from slots (teacher / student week views
   * do not ship suggested periods — without this, desktop layout drops every slot).
   */
  private teachIntervalsForGrid(): Array<{ startMin: number; endMin: number }> {
    const fromPlan = [...this.suggestedPeriods()]
      .map((p) => ({
        startMin: this.toMinutes(p.startTime),
        endMin: this.toMinutes(p.endTime),
      }))
      .filter((i) => i.endMin > i.startMin)
      .sort((a, b) => a.startMin - b.startMin);

    if (fromPlan.length) {
      return this.mergeIntervals(fromPlan);
    }

    const fromSlots = this.slots()
      .map((s) => ({
        startMin: this.toMinutes(s.startTime),
        endMin: this.toMinutes(s.endTime),
      }))
      .filter((i) => i.endMin > i.startMin)
      .sort((a, b) => a.startMin - b.startMin);

    return this.mergeIntervals(fromSlots);
  }

  private mergeIntervals(
    intervals: Array<{ startMin: number; endMin: number }>,
  ): Array<{ startMin: number; endMin: number }> {
    if (!intervals.length) return [];
    const merged: Array<{ startMin: number; endMin: number }> = [
      { ...intervals[0] },
    ];
    for (let i = 1; i < intervals.length; i++) {
      const cur = intervals[i];
      const last = merged[merged.length - 1];
      if (cur.startMin <= last.endMin) {
        last.endMin = Math.max(last.endMin, cur.endMin);
      } else {
        merged.push({ ...cur });
      }
    }
    return merged;
  }

  private layoutOnUniformRows(
    startMin: number,
    endMin: number,
    rows: ReturnType<ScheduleGridComponent['buildUniformGridRows']>,
  ): { topPx: number; heightPx: number } | null {
    const overlapping = rows.filter((r) => startMin < r.endMin && r.startMin < endMin);
    if (!overlapping.length) return null;
    const first = overlapping[0];
    const last = overlapping[overlapping.length - 1];
    return { topPx: first.topPx, heightPx: last.topPx + last.heightPx - first.topPx };
  }

  private resolvePeriodMinutes(): number {
    const fromInput = this.periodMinutes();
    if (fromInput != null && fromInput >= 15) return fromInput;
    const periods = this.suggestedPeriods();
    if (!periods.length) return 45;
    const durations = periods.map(
      (p) => this.toMinutes(p.endTime) - this.toMinutes(p.startTime),
    );
    const standard = durations.filter((d) => d > 0 && d <= 45);
    if (standard.length) {
      return Math.min(...standard);
    }
    return 45;
  }

  protected readonly isEmpty = computed(
    () =>
      !this.editable() &&
      this.slots().length === 0 &&
      this.nonTeachingBlocks().length === 0 &&
      this.suggestedPeriods().length === 0,
  );
  protected readonly showSection = computed(() => this.showSectionView);
  protected readonly showTeacher = computed(() => this.showTeacherView);
  protected readonly scheduleSectionGrade = scheduleSectionGrade;
  protected readonly scheduleSectionLine = scheduleSectionLine;

  /** >= two standard rows or one full row with extra content. */
  protected isTall(heightPx: number): boolean {
    return heightPx >= this.teachRowHeightPx * 1.5;
  }

  /** Single short row (recess band, etc.). */
  protected isCompact(heightPx: number): boolean {
    return heightPx < 52;
  }

  protected isRecessBand(block: NonTeachingBlockItem): boolean {
    const type = String(block.blockType ?? '').toUpperCase();
    const label = String(block.label ?? '').toLowerCase();
    return type === 'RECESS' || label.includes('recreo');
  }

  protected isLunchBand(block: NonTeachingBlockItem): boolean {
    const type = String(block.blockType ?? '').toUpperCase();
    const label = String(block.label ?? '').toLowerCase();
    return type === 'LUNCH' || label.includes('lonchera') || label.includes('almuerzo');
  }

  /** Template guard — band blocks render only in {@link sharedBands}. */
  protected isBandBlockItem(block: NonTeachingBlockItem): boolean {
    return this.isBandBlock(block);
  }

  /** True when a slot, suggested period, or non-band block covers this teach row. */
  protected rowHasCoverage(
    day: number,
    row: { startMin: number; endMin: number; kind: 'teach' | 'band' },
  ): boolean {
    if (row.kind !== 'teach') return true;
    return this.itemsByDay()[day].some((item) =>
      this.toMinutes(item.startTime) < row.endMin && row.startMin < this.toMinutes(item.endTime),
    );
  }

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

  /** Recess/lunch (or all-weekday) blocks render as one horizontal ribbon. */
  private isBandBlock(block: NonTeachingBlockItem): boolean {
    const type = String(block.blockType ?? '').toUpperCase();
    const label = String(block.label ?? '').toLowerCase();
    return (
      block.dayOfWeek == null ||
      type === 'RECESS' ||
      type === 'LUNCH' ||
      label.includes('recreo') ||
      label.includes('lonchera') ||
      label.includes('almuerzo')
    );
  }

  private bandBlocksDeduped(): NonTeachingBlockItem[] {
    const seen = new Set<string>();
    const result: NonTeachingBlockItem[] = [];
    for (const block of this.nonTeachingBlocks()) {
      if (!this.isBandBlock(block)) continue;
      if (seen.has(block.blockPublicUuid)) continue;
      seen.add(block.blockPublicUuid);
      result.push(block);
    }
    return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  private toMinutes(time: string): number {
    const [h, m] = (time || '00:00').split(':').map((p) => Number(p) || 0);
    return h * 60 + m;
  }
}

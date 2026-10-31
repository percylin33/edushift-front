import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IconComponent, IconName } from '@shared/components';
import {
  DayPlanPreviewItem,
  DayPlanTimelineSegment,
  previewToTimelineSegments,
} from '../../utils/day-plan.util';

const SEGMENT_STYLES: Record<
  DayPlanTimelineSegment['kind'],
  { bar: string; icon: IconName; swatch: string }
> = {
  period: {
    bar: 'border border-emerald-700/30 bg-emerald-600 text-white shadow-sm',
    icon: 'book-open',
    swatch: 'bg-emerald-600',
  },
  recess: {
    bar: 'border border-sky-800/30 bg-sky-600 text-white shadow-sm',
    icon: 'clock',
    swatch: 'bg-sky-600',
  },
  lunch: {
    bar: 'border border-violet-800/40 bg-violet-700 text-white shadow-sm dark:border-violet-300/40 dark:bg-violet-400 dark:text-violet-950',
    icon: 'cake',
    swatch: 'bg-violet-700 dark:bg-violet-400',
  },
  other: {
    bar: 'border border-slate-500/40 bg-slate-600 text-white shadow-sm',
    icon: 'calendar',
    swatch: 'bg-slate-600',
  },
};

/** Visual timeline for a contiguous school day (periods + recess + lunch). */
@Component({
  selector: 'app-day-plan-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent],
  template: `
    @if (segments().length === 0) {
      <div
        class="rounded-lg border border-dashed border-border-subtle bg-surface-subtle/50 px-4 py-8 text-center text-sm text-content-muted"
      >
        Ajustá entrada, salida y duración del periodo para ver el día.
      </div>
    } @else {
      <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-content-muted">
        <span class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-sm bg-emerald-600"></span> Clase
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-sm bg-sky-600"></span> Recreo
        </span>
        <span class="inline-flex items-center gap-1.5">
          <span class="h-2.5 w-2.5 rounded-sm bg-violet-700 dark:bg-violet-400"></span> Almuerzo
        </span>
        <span class="ml-auto text-sm font-semibold text-content">{{ summaryText() }}</span>
      </div>

      <!-- Desktop: proportional horizontal bar -->
      <div class="hidden sm:block">
        <div class="relative h-28 rounded-xl border border-border-subtle bg-slate-100/80 p-2 dark:bg-slate-900/40">
          <div class="relative h-full w-full">
            @for (seg of segments(); track seg.startTime + seg.endTime + seg.label + seg.kind; let i = $index) {
              <div
                class="absolute top-0.5 bottom-0.5 flex flex-col items-center justify-center overflow-hidden rounded-md px-1.5 text-center"
                [ngClass]="segmentStyle(seg.kind).bar"
                [style.left.%]="segmentLeft(seg, i)"
                [style.width.%]="segmentWidth(seg)"
                [attr.title]="seg.label + ' · ' + seg.startTime + '–' + seg.endTime"
              >
                @if (seg.widthPct >= 9) {
                  <span class="w-full truncate text-xs font-bold leading-tight tracking-tight">{{
                    shortLabel(seg)
                  }}</span>
                  <span class="mt-0.5 w-full truncate text-[11px] font-medium leading-tight opacity-95">
                    {{ seg.startTime }}–{{ seg.endTime }}
                  </span>
                } @else if (seg.widthPct >= 5) {
                  <span class="w-full truncate text-xs font-bold leading-tight">{{
                    shortLabel(seg)
                  }}</span>
                } @else {
                  <span class="text-[11px] font-bold leading-none">{{ tinyLabel(seg) }}</span>
                }
              </div>
            }
          </div>
        </div>
        <div class="mt-1.5 flex justify-between text-xs font-medium text-content-muted">
          <span>Entrada {{ dayStartLabel() }}</span>
          <span>Salida {{ dayEndLabel() }}</span>
        </div>
      </div>

      <!-- Mobile: vertical list -->
      <ol class="space-y-2 sm:hidden">
        @for (seg of segments(); track seg.startTime + seg.endTime + seg.label + seg.kind) {
          <li
            class="flex items-center gap-3 rounded-lg border px-3 py-2.5"
            [ngClass]="segmentStyle(seg.kind).bar"
          >
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20"
            >
              <app-icon [name]="segmentStyle(seg.kind).icon" [size]="16" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-bold">{{ seg.label }}</p>
              <p class="text-xs font-medium opacity-95">
                {{ seg.startTime }} – {{ seg.endTime }}
              </p>
            </div>
          </li>
        }
      </ol>
    }
  `,
})
export class DayPlanTimelineComponent {
  readonly preview = input<DayPlanPreviewItem[]>([]);
  /** Full school-day bounds so the bar reaches salida even after the last block. */
  readonly dayStart = input<string>('');
  readonly dayEnd = input<string>('');

  private static readonly GAP_PCT = 0.45;

  protected readonly segments = computed(() =>
    previewToTimelineSegments(this.preview(), this.dayStart() || undefined, this.dayEnd() || undefined),
  );

  protected readonly dayStartLabel = computed(
    () => this.dayStart() || this.segments()[0]?.startTime || '',
  );

  protected readonly dayEndLabel = computed(() => {
    if (this.dayEnd()) return this.dayEnd();
    const segs = this.segments();
    return segs[segs.length - 1]?.endTime ?? '';
  });

  protected readonly summaryText = computed(() => {
    const segs = this.segments();
    const periods = segs.filter((s) => s.kind === 'period').length;
    const recesses = segs.filter((s) => s.kind === 'recess').length;
    const lunches = segs.filter((s) => s.kind === 'lunch').length;
    const parts = [`${periods} periodo${periods === 1 ? '' : 's'}`];
    if (recesses) parts.push(`${recesses} recreo${recesses === 1 ? '' : 's'}`);
    if (lunches) parts.push('almuerzo');
    return parts.join(' · ');
  });

  protected segmentStyle(kind: DayPlanTimelineSegment['kind']) {
    return SEGMENT_STYLES[kind];
  }

  /** Leave a hairline gap between adjacent blocks so labels don't collide. */
  protected segmentLeft(seg: DayPlanTimelineSegment, index: number): number {
    return seg.leftPct + (index === 0 ? 0 : DayPlanTimelineComponent.GAP_PCT / 2);
  }

  protected segmentWidth(seg: DayPlanTimelineSegment): number {
    return Math.max(seg.widthPct - DayPlanTimelineComponent.GAP_PCT, 1.2);
  }

  protected shortLabel(seg: DayPlanTimelineSegment): string {
    if (seg.kind === 'period') {
      const m = /^Periodo\s+(\d+)/i.exec(seg.label);
      return m ? `P${m[1]}` : seg.label;
    }
    return seg.label;
  }

  protected tinyLabel(seg: DayPlanTimelineSegment): string {
    if (seg.kind === 'period') return this.shortLabel(seg);
    if (seg.kind === 'recess') return 'R';
    if (seg.kind === 'lunch') return 'A';
    return '·';
  }
}

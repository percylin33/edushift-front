import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';
import {
  AcademicPeriodRow,
  PERIOD_TYPE_LABELS,
  PeriodType
} from '../models';

/** Item del preview pendiente de commit (bulk-generator o form). */
export interface TimelinePreviewItem {
  id: string;
  periodType: PeriodType;
  ordinal: number;
  name: string;
  startDate: Date;
  endDate: Date;
  /** Si {@code true}, el bloque se pinta en rojo (overlap). */
  conflict?: boolean;
}

/**
 * Visualización horizontal del año académico con sus periodos por
 * tipo. Renderiza una "barra del año" como referencia y, sobre ella,
 * los periodos como bloques posicionados con CSS {@code calc()} a
 * partir del ratio {@code (start - yearStart) / yearLength}.
 *
 * <h3>Diseño</h3>
 * <ul>
 *   <li>Una fila por {@link PeriodType} con datos. Tipos sin datos no
 *       se muestran (ej. si solo hay BIMESTRE, no se renderiza la
 *       fila vacía de TRIMESTRE).</li>
 *   <li>Bloques con color por type (Bimestre = primary, Trimestre =
 *       indigo, Anual = emerald).</li>
 *   <li>Soporta un <em>preview</em> en modo "ghost" (líneas
 *       punteadas) para previsualizar el bulk-generator o el form
 *       antes del submit.</li>
 *   <li>Click en un bloque emite {@link #blockClicked} con el
 *       periodo — útil para editar inline en el list.</li>
 * </ul>
 *
 * <h3>Implementación</h3>
 * Sin libs externas (D3 sería overkill). Usamos
 * {@code position: absolute} dentro de un track {@code position:
 * relative} y calculamos {@code left}/{@code width} en porcentaje.
 * El año se muestra siempre como referencia base y nunca se solapa
 * con los bloques (el track tiene altura propia).
 */
@Component({
  selector: 'app-period-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    @if (yearStart() && yearEnd()) {
      <div class="period-timeline" role="img" [attr.aria-label]="ariaLabel()">
        <!-- Year ruler -->
        <div class="period-timeline__ruler" aria-hidden="true">
          <span>{{ formatDate(yearStart()) }}</span>
          <span>{{ formatDate(yearEnd()) }}</span>
        </div>

        <!-- Type rows -->
        @for (row of rows(); track row.type) {
          <div class="period-timeline__row">
            <div class="period-timeline__row-label">{{ row.label }}</div>
            <div class="period-timeline__track">
              <div class="period-timeline__year-bar" aria-hidden="true"></div>

              @for (block of row.blocks; track block.id) {
                <div
                  class="period-timeline__block"
                  [class.period-timeline__block--bimestre]="row.type === bimestre"
                  [class.period-timeline__block--trimestre]="row.type === trimestre"
                  [class.period-timeline__block--anual]="row.type === anual"
                  [class.period-timeline__block--preview]="block.preview"
                  [class.period-timeline__block--conflict]="block.conflict"
                  [style.left.%]="block.leftPct"
                  [style.width.%]="block.widthPct"
                  [attr.title]="block.tooltip"
                  (click)="block.preview ? null : blockClicked.emit(block.source!)"
                  [class.cursor-pointer]="!block.preview"
                >
                  <span class="period-timeline__block-label">
                    {{ block.shortLabel }}
                  </span>
                </div>
              }
            </div>
          </div>
        }

        @if (rows().length === 0) {
          <p class="px-3 py-6 text-center text-sm text-content-muted">
            Aún no hay periodos definidos para este año.
          </p>
        }
      </div>
    }
  `,
  styles: [
    `
      :host { display: block; }
      .period-timeline {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .period-timeline__ruler {
        display: flex;
        justify-content: space-between;
        padding: 0 0.25rem;
        font-size: 0.7rem;
        color: rgb(var(--color-content-muted-rgb, 107 114 128));
        font-variant-numeric: tabular-nums;
      }
      .period-timeline__row {
        display: grid;
        grid-template-columns: 6rem 1fr;
        align-items: center;
        gap: 0.5rem;
      }
      .period-timeline__row-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: rgb(var(--color-content-rgb, 17 24 39));
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .period-timeline__track {
        position: relative;
        height: 2.25rem;
        padding: 0.25rem 0;
      }
      .period-timeline__year-bar {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        height: 0.4rem;
        transform: translateY(-50%);
        border-radius: 9999px;
        background: rgb(var(--color-border-subtle-rgb, 229 231 235));
      }
      .period-timeline__block {
        position: absolute;
        top: 0.125rem;
        bottom: 0.125rem;
        min-width: 1.25rem;
        padding: 0 0.5rem;
        border-radius: 0.375rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        font-weight: 600;
        color: white;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: filter 0.15s, transform 0.15s;
      }
      .period-timeline__block:hover:not(.period-timeline__block--preview) {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }
      .period-timeline__block-label {
        line-height: 1;
      }
      .period-timeline__block--bimestre {
        background: rgb(var(--color-primary-600-rgb, 37 99 235));
      }
      .period-timeline__block--trimestre {
        background: rgb(99 102 241); /* indigo-500 */
      }
      .period-timeline__block--anual {
        background: rgb(16 185 129); /* emerald-500 */
      }
      .period-timeline__block--preview {
        background: transparent !important;
        color: rgb(var(--color-primary-700-rgb, 29 78 216));
        border: 1.5px dashed rgb(var(--color-primary-500-rgb, 59 130 246));
        box-shadow: none;
      }
      .period-timeline__block--conflict {
        background: rgb(220 38 38) !important; /* red-600 */
        color: white !important;
        border: 0;
        animation: chipPulse 1.4s ease-in-out infinite;
      }
      @keyframes chipPulse {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.15); }
      }
    `
  ]
})
export class PeriodTimelineComponent {
  readonly yearStart = input<Date | null>(null);
  readonly yearEnd = input<Date | null>(null);
  readonly periods = input<AcademicPeriodRow[]>([]);
  readonly preview = input<TimelinePreviewItem[]>([]);

  readonly blockClicked = output<AcademicPeriodRow>();

  /* Aliases para usar enums en el template sin ngTemplateContextGuard. */
  protected readonly bimestre = PeriodType.Bimestre;
  protected readonly trimestre = PeriodType.Trimestre;
  protected readonly anual = PeriodType.Anual;

  protected readonly rows = computed<TimelineRow[]>(() => {
    const ys = this.yearStart();
    const ye = this.yearEnd();
    if (!ys || !ye) return [];

    const total = Math.max(1, ye.getTime() - ys.getTime());

    /* Agrupa periodos reales + preview por type. Preview blocks se
     * marcan con `preview: true` para distinguirlos visualmente. */
    const buckets = new Map<PeriodType, TimelineBlock[]>();

    for (const p of this.periods()) {
      this.addBlock(buckets, p.periodType, {
        id: p.publicUuid,
        leftPct: clamp((p.startDate.getTime() - ys.getTime()) / total) * 100,
        widthPct: Math.max(
          1,
          clamp(
            (p.endDate.getTime() - p.startDate.getTime()) / total
          ) * 100
        ),
        shortLabel: shortLabel(p.name, p.ordinal),
        tooltip: `${p.name}\n${formatRange(p.startDate, p.endDate)}`,
        preview: false,
        source: p
      });
    }

    for (const pv of this.preview()) {
      this.addBlock(buckets, pv.periodType, {
        id: `preview-${pv.id}`,
        leftPct: clamp((pv.startDate.getTime() - ys.getTime()) / total) * 100,
        widthPct: Math.max(
          1,
          clamp((pv.endDate.getTime() - pv.startDate.getTime()) / total) * 100
        ),
        shortLabel: shortLabel(pv.name, pv.ordinal),
        tooltip: `${pv.name} (preview)\n${formatRange(pv.startDate, pv.endDate)}`,
        preview: true,
        conflict: pv.conflict
      });
    }

    /* Orden de filas: solo las que tienen datos, en orden enum. */
    const order: PeriodType[] = [
      PeriodType.Bimestre,
      PeriodType.Trimestre,
      PeriodType.Anual
    ];
    const out: TimelineRow[] = [];
    for (const t of order) {
      const blocks = buckets.get(t);
      if (!blocks || blocks.length === 0) continue;
      out.push({
        type: t,
        label: PERIOD_TYPE_LABELS[t],
        blocks: blocks.slice().sort((a, b) => a.leftPct - b.leftPct)
      });
    }
    return out;
  });

  protected readonly ariaLabel = computed(() => {
    const n = this.periods().length;
    return `Línea de tiempo del año académico con ${n} ${
      n === 1 ? 'periodo' : 'periodos'
    }`;
  });

  protected formatDate(d: Date | null): string {
    if (!d) return '';
    return d.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  private addBlock(
    buckets: Map<PeriodType, TimelineBlock[]>,
    type: PeriodType,
    block: TimelineBlock
  ): void {
    const list = buckets.get(type) ?? [];
    list.push(block);
    buckets.set(type, list);
  }
}

// =============================================================================
// Internal types
// =============================================================================

interface TimelineRow {
  type: PeriodType;
  label: string;
  blocks: TimelineBlock[];
}

interface TimelineBlock {
  id: string;
  leftPct: number;
  widthPct: number;
  shortLabel: string;
  tooltip: string;
  preview: boolean;
  conflict?: boolean;
  /** Solo para bloques reales — emitido en {@code blockClicked}. */
  source?: AcademicPeriodRow;
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Etiqueta corta dentro del bloque. Si el {@code name} es corto cabe
 * directo (ej. "I Bimestre"); si es muy largo cae al ordinal romano
 * solo, que es el mínimo informativo (la tabla muestra el name
 * completo).
 */
function shortLabel(name: string, ordinal: number): string {
  if (name.length <= 12) return name;
  return romanFromOrdinal(ordinal);
}

const ROMAN_FALLBACK = [
  '', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII'
];

function romanFromOrdinal(n: number): string {
  return ROMAN_FALLBACK[n] ?? String(n);
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date): string =>
    d.toLocaleDateString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  return `${fmt(start)} → ${fmt(end)}`;
}

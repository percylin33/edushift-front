import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { EvaluationScale } from '@features/evaluations/models';
import {
  ALLOWED_LITERALS_BY_SCALE,
  BULK_MAX_ROWS,
  BulkGradeRecordSummary,
  CreateGradeRecordRequest,
  SCORE_MAX,
  SCORE_MIN,
  validateGradeShape,
} from '../models';

interface ParsedRow {
  index: number;
  raw: string;
  payload: CreateGradeRecordRequest | null;
  error: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Modal de bulk CSV para registrar varias notas en una sola transacción
 * (FE-5B.3 / ADR-5B.6). El parser ES-PE soporta:
 *
 * <pre>
 * studentPublicUuid, score [, comments]                  ← SCORE_0_20
 * studentPublicUuid, literal [, comments]                ← LITERAL_*
 * </pre>
 *
 * <p>Líneas en blanco y filas que arrancan con {@code #} se ignoran;
 * coma decimal en notas se normaliza a punto. La primera fila inválida
 * NO bloquea el preview — el usuario las ve marcadas en rojo y solo se
 * envían las válidas. El backend igual valida atomically: cualquier
 * fila que pase nuestro check pero falle gates de enrollment / lifecycle
 * aborta el batch entero (lo manejamos como error de banner).</p>
 */
@Component({
  selector: 'app-grade-records-bulk-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IconComponent, SpinnerComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-grade-title"
      (click)="onBackdropClick($event)"
    >
      <div
        class="card flex max-h-[92vh] w-full max-w-3xl flex-col shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <header class="card-header flex items-start justify-between gap-3">
          <div>
            <h2 id="bulk-grade-title" class="card-title">Registro masivo</h2>
            <p class="card-description">
              Pega un CSV con
              <code>studentPublicUuid, {{ valueColumnLabel() }} [, comentarios]</code>. Una fila por
              estudiante (máx {{ maxRows }}). Líneas vacías y comentarios <code>#</code> se ignoran.
              La nota usa coma o punto decimal indistintamente.
            </p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" aria-label="Cerrar" (click)="cancel()">
            <app-icon name="x" [size]="18" />
          </button>
        </header>

        <div class="card-body grid flex-1 gap-4 overflow-y-auto">
          <div class="field">
            <label class="label" for="bulk-textarea">CSV</label>
            <textarea
              id="bulk-textarea"
              class="input font-mono text-xs"
              rows="8"
              [value]="csv()"
              (input)="onCsvChange($any($event.target).value)"
              [placeholder]="placeholder()"
            ></textarea>
            <p class="field-hint">
              {{ parsed().length }} fila(s) detectada(s) · {{ validCount() }} válida(s) ·
              {{ invalidCount() }} con error.
            </p>
          </div>

          @if (rejectedTooMany()) {
            <div class="alert alert-warning">
              <app-icon name="alert-circle" [size]="16" />
              <p class="flex-1 text-sm">
                Solo procesaremos las primeras {{ maxRows }} filas. Las demás se ignoran.
              </p>
            </div>
          }

          @if (errorBanner()) {
            <div class="alert alert-danger">
              <app-icon name="alert-circle" [size]="16" />
              <p class="flex-1 text-sm">{{ errorBanner() }}</p>
            </div>
          }

          @if (parsed().length > 0) {
            <div class="overflow-auto rounded-md border border-border-subtle">
              <table class="table">
                <thead>
                  <tr>
                    <th class="w-12">#</th>
                    <th>Student UUID</th>
                    <th>{{ valueColumnLabel() }}</th>
                    <th>Comentarios</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of parsed(); track row.index) {
                    <tr [class.bg-danger-50]="row.error">
                      <td class="text-content-muted">{{ row.index + 1 }}</td>
                      <td class="font-mono text-xs">
                        {{ shorten(row.payload?.studentPublicUuid ?? row.raw) }}
                      </td>
                      <td class="font-mono text-xs">
                        @if (scale() === scaleScore) {
                          {{ row.payload?.score ?? '—' }}
                        } @else {
                          {{ row.payload?.literal ?? '—' }}
                        }
                      </td>
                      <td class="max-w-[180px] truncate text-xs text-content-muted">
                        {{ row.payload?.comments || '—' }}
                      </td>
                      <td>
                        @if (row.error) {
                          <span class="text-danger-700 text-xs">
                            {{ row.error }}
                          </span>
                        } @else {
                          <span class="text-xs text-emerald-700">OK</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <footer
          class="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-5 py-3"
        >
          <button type="button" class="btn btn-ghost btn-sm" (click)="cancel()">Cancelar</button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="saving() || validCount() === 0"
            (click)="submit()"
          >
            @if (saving()) {
              <app-spinner [size]="14" />
              <span>Enviando…</span>
            } @else {
              <app-icon name="check" [size]="16" />
              <span>Registrar {{ validCount() }}</span>
            }
          </button>
        </footer>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .table {
        @apply w-full text-left text-sm;
      }
      .table th {
        @apply border-b border-border-subtle bg-surface-subtle px-3 py-2 text-xs font-semibold uppercase tracking-wider text-content-muted;
      }
      .table td {
        @apply border-b border-border-subtle px-3 py-2;
      }
      .table tr:last-child td {
        border-bottom: none;
      }
    `,
  ],
})
export class GradeRecordsBulkModalComponent implements OnInit {
  /** Scale del padre evaluation; determina cómo parseamos la 2da columna. */
  readonly scale = input.required<EvaluationScale>();
  /** Indica que el submit está in-flight; deshabilita el botón. */
  readonly saving = input<boolean>(false);
  /** Banner de error (server-side); el modal NO lo limpia solo. */
  readonly errorBanner = input<string | null>(null);
  /** Resumen del último bulk para que el host decida cuándo cerrar. */
  readonly lastSummary = input<BulkGradeRecordSummary | null>(null);

  readonly closed = output<void>();
  readonly submitted = output<CreateGradeRecordRequest[]>();

  protected readonly maxRows = BULK_MAX_ROWS;
  protected readonly scaleScore = EvaluationScale.SCORE_0_20;

  protected readonly csv = signal<string>('');
  protected readonly rejectedTooMany = signal<boolean>(false);

  protected readonly parsed = computed<ParsedRow[]>(() => {
    const lines = this.csv()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    const trimmed = lines.slice(0, this.maxRows);
    return trimmed.map((raw, index) => this.parseRow(raw, index));
  });

  protected readonly validCount = computed(
    () => this.parsed().filter((r) => !r.error && r.payload).length,
  );
  protected readonly invalidCount = computed(() => this.parsed().filter((r) => r.error).length);

  protected valueColumnLabel(): string {
    return this.scale() === EvaluationScale.SCORE_0_20 ? 'nota' : 'literal';
  }

  protected placeholder(): string {
    if (this.scale() === EvaluationScale.SCORE_0_20) {
      return [
        '# Una fila por estudiante. Coma decimal o punto valen.',
        '# studentPublicUuid, score [, comentarios]',
        'a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, 18.5, Excelente',
        'b3f7e2c8-1234-4abc-9999-bbbbbbbbbbbb, 14, ',
        'c3f7e2c8-1234-4abc-9999-cccccccccccc, 11,75',
      ].join('\n');
    }
    const allowed = ALLOWED_LITERALS_BY_SCALE[this.scale()].join(' / ');
    return [
      '# Literales permitidos: ' + allowed,
      '# studentPublicUuid, literal [, comentarios]',
      'a3f7e2c8-1234-4abc-9999-aaaaaaaaaaaa, A, Logrado',
      'b3f7e2c8-1234-4abc-9999-bbbbbbbbbbbb, B',
    ].join('\n');
  }

  ngOnInit(): void {
    this.rejectedTooMany.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cancel();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  protected onCsvChange(value: string): void {
    this.csv.set(value);
    const linesCount = value
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0 && !l.trim().startsWith('#')).length;
    this.rejectedTooMany.set(linesCount > this.maxRows);
  }

  protected cancel(): void {
    this.closed.emit();
  }

  protected submit(): void {
    const valid = this.parsed()
      .filter((r) => !r.error && r.payload)
      .map((r) => r.payload!);
    if (valid.length === 0) return;
    this.submitted.emit(valid);
  }

  protected shorten(value: string | undefined): string {
    if (!value) return '—';
    if (value.length < 12) return value;
    return value.slice(0, 8) + '…';
  }

  // ---------------------------------------------------------------------------
  // CSV parser
  // ---------------------------------------------------------------------------

  private parseRow(raw: string, index: number): ParsedRow {
    const cells = raw.split(',').map((c) => c.trim());
    if (cells.length < 2) {
      return {
        index,
        raw,
        payload: null,
        error: 'Faltan columnas (esperado: uuid, valor [, comentarios]).',
      };
    }
    const [uuid, valueRaw, ...rest] = cells;
    if (!UUID_REGEX.test(uuid)) {
      return { index, raw, payload: null, error: 'UUID inválido.' };
    }
    const comments = rest.length ? rest.join(',').trim() : null;

    if (this.scale() === EvaluationScale.SCORE_0_20) {
      const normalized = valueRaw.replace(',', '.');
      if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
        return { index, raw, payload: null, error: 'Nota debe ser numérica.' };
      }
      const score = Number(normalized);
      const shape = validateGradeShape(this.scale(), { score });
      if (shape) {
        return { index, raw, payload: null, error: shape };
      }
      return {
        index,
        raw,
        payload: {
          studentPublicUuid: uuid,
          score,
          literal: null,
          comments: comments || null,
        },
        error: null,
      };
    }

    // LITERAL_*
    const literal = valueRaw.toUpperCase();
    const shape = validateGradeShape(this.scale(), { literal });
    if (shape) {
      return { index, raw, payload: null, error: shape };
    }
    return {
      index,
      raw,
      payload: {
        studentPublicUuid: uuid,
        score: null,
        literal,
        comments: comments || null,
      },
      error: null,
    };
  }
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Mantenemos referencia a SCORE_MIN / SCORE_MAX para que el contenedor
// pueda pasarlos a los tooltips si quisiera; no se usan acá.
const _scoreBounds = { SCORE_MIN, SCORE_MAX };

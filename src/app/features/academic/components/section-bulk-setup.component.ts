import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent, SpinnerComponent } from '@shared/components';
import { AcademicStore } from '../store';
import {
  AcademicLevel,
  AcademicYearRow,
  AcademicYearStatus,
  CreateSectionRequest,
  Grade,
  isSectionMutable,
} from '../models';

const SECTION_LETTERS = ['A', 'B', 'C'] as const;
type SectionLetter = (typeof SECTION_LETTERS)[number];

function cellKey(gradeUuid: string, letter: SectionLetter): string {
  return `${gradeUuid}:${letter}`;
}

/**
 * Panel de setup masivo: una tabla por nivel (filas = grados, cols = A/B/C)
 * y un botón que materializa las celdas seleccionadas vía
 * {@link AcademicStore#createSectionsBulk}.
 */
@Component({
  selector: 'app-section-bulk-setup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IconComponent, SpinnerComponent],
  template: `
    <section
      class="card mb-4 w-full"
      [class.ml-auto]="compactCollapsed()"
      [class.max-w-md]="compactCollapsed()"
    >
      <header
        class="card-header flex flex-wrap items-center justify-between gap-3"
        [class.items-start]="expanded()"
      >
        <div class="min-w-0">
          <h3
            class="card-title"
            [class.text-base]="expanded() || !alreadyConfigured()"
            [class.text-sm]="compactCollapsed()"
          >
            Configurar secciones del colegio
          </h3>
          @if (expanded()) {
            <p class="card-description">
              Marca las letras (A, B, C) que tiene cada grado. Las celdas ya creadas aparecen
              bloqueadas.
            </p>
          }
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm shrink-0"
          (click)="expanded.set(!expanded())"
          [attr.aria-expanded]="expanded()"
        >
          <app-icon [name]="expanded() ? 'chevron-up' : 'chevron-down'" [size]="16" />
          {{ expanded() ? 'Ocultar' : 'Mostrar' }}
        </button>
      </header>

      @if (expanded()) {
        <div class="card-body space-y-4">
          <div class="grid gap-3 sm:grid-cols-12 sm:items-end">
            <div class="sm:col-span-4">
              <label class="label" for="bulk-section-year">Año académico</label>
              <select
                id="bulk-section-year"
                class="select"
                [ngModel]="yearUuid()"
                (ngModelChange)="onYearChange($event)"
              >
                <option [ngValue]="null" disabled>— Elige un año —</option>
                @for (y of mutableYears(); track y.publicUuid) {
                  <option [ngValue]="y.publicUuid">
                    {{ y.name }} · {{ statusLabel(y.status) }}
                  </option>
                }
              </select>
            </div>
            <div class="flex flex-wrap gap-2 sm:col-span-8 sm:justify-end">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                [disabled]="!canSubmit()"
                (click)="submit()"
              >
                @if (busy()) {
                  <app-spinner [size]="14" label="Creando" />
                } @else {
                  <app-icon name="sparkles" [size]="16" />
                }
                Crear secciones seleccionadas
                @if (pendingCount() > 0) {
                  <span class="badge badge-neutral ml-1">{{ pendingCount() }}</span>
                }
              </button>
            </div>
          </div>

          @if (bulkProgress(); as bp) {
            <div class="alert alert-info">
              <app-spinner [size]="16" label="Generando" />
              <p class="flex-1 text-sm">
                Creando secciones…
                <span class="font-medium">{{ bp.current }} / {{ bp.total }}</span>
              </p>
            </div>
          }

          @if (resultMessage(); as msg) {
            <div class="alert" [class.alert-success]="!resultIsError()" [class.alert-danger]="resultIsError()">
              <app-icon [name]="resultIsError() ? 'alert-circle' : 'check'" [size]="16" />
              <p class="flex-1 text-sm">{{ msg }}</p>
              <button type="button" class="btn btn-ghost btn-sm" (click)="resultMessage.set(null)">
                Cerrar
              </button>
            </div>
          }

          @if (!yearUuid()) {
            <p class="text-sm text-content-muted">Selecciona un año PLANNING o ACTIVE para continuar.</p>
          } @else if (levels().length === 0) {
            <p class="text-sm text-content-muted">
              No hay niveles cargados. Ve a Niveles para crear la estructura del colegio.
            </p>
          } @else {
            <div class="space-y-5">
              @for (level of levels(); track level.publicUuid) {
                <div class="rounded-lg border border-border overflow-hidden">
                  <div
                    class="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-muted/40 px-3 py-2"
                  >
                    <div>
                      <p class="text-sm font-semibold text-content">{{ level.name }}</p>
                      <p class="text-xs text-content-muted">{{ level.code }}</p>
                    </div>
                    <div class="flex flex-wrap gap-1">
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm text-xs"
                        (click)="markLevel(level, ['A'])"
                      >
                        Solo A
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm text-xs"
                        (click)="markLevel(level, ['A', 'B'])"
                      >
                        A + B
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm text-xs"
                        (click)="markLevel(level, ['A', 'B', 'C'])"
                      >
                        A + B + C
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-sm text-xs"
                        (click)="clearLevel(level)"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  @if (sortedGrades(level).length === 0) {
                    <p class="px-3 py-4 text-sm text-content-muted">Este nivel no tiene grados.</p>
                  } @else {
                    <div class="overflow-x-auto">
                      <table class="table">
                        <thead>
                          <tr>
                            <th class="min-w-[160px]">Grado</th>
                            @for (letter of letters; track letter) {
                              <th class="w-20 text-center">{{ letter }}</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (grade of sortedGrades(level); track grade.publicUuid) {
                            <tr>
                              <td class="font-medium text-content">{{ grade.name }}</td>
                              @for (letter of letters; track letter) {
                                <td class="text-center">
                                  <input
                                    type="checkbox"
                                    class="checkbox"
                                    [checked]="isChecked(grade.publicUuid, letter)"
                                    [disabled]="isExisting(grade.publicUuid, letter) || busy()"
                                    (change)="toggle(grade.publicUuid, letter, $event)"
                                    [attr.aria-label]="grade.name + ' — sección ' + letter"
                                    [title]="
                                      isExisting(grade.publicUuid, letter)
                                        ? 'Ya existe'
                                        : 'Incluir sección ' + letter
                                    "
                                  />
                                </td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class SectionBulkSetupComponent {
  private readonly store = inject(AcademicStore);

  /** Año sugerido al abrir (p.ej. filtro de la lista o ACTIVE). */
  readonly defaultYearUuid = input<string | null>(null);

  /** Emite tras un bulk exitoso para que la lista refresque. */
  readonly completed = output<void>();

  /** Cuando el usuario cambia el año del panel (para alinear filtros de la lista). */
  readonly yearChange = output<string>();

  protected readonly letters = SECTION_LETTERS;
  protected readonly levels = this.store.levels;
  protected readonly bulkProgress = this.store.bulkProgress;

  protected readonly expanded = signal(false);
  protected readonly yearUuid = signal<string | null>(null);
  /** Selección pendiente: keys {@code gradeUuid:letter}. */
  protected readonly selected = signal<Set<string>>(new Set());
  protected readonly busy = signal(false);
  protected readonly resultMessage = signal<string | null>(null);
  protected readonly resultIsError = signal(false);

  /** Evita re-emitir yearChange en cada tick del effect cuando ya estamos alineados. */
  private lastEmittedYear: string | null = null;

  protected readonly mutableYears = computed<AcademicYearRow[]>(() =>
    this.store.years().filter((y) => isSectionMutable(y.status)),
  );

  /** Keys ya materializadas en el store para el año elegido. */
  private readonly existingKeys = computed<Set<string>>(() => {
    const yearId = this.yearUuid();
    if (!yearId) return new Set();
    const keys = new Set<string>();
    for (const s of this.store.sections()) {
      if (s.academicYearPublicUuid !== yearId) continue;
      const letter = s.name.trim().toUpperCase();
      if (letter === 'A' || letter === 'B' || letter === 'C') {
        keys.add(cellKey(s.gradePublicUuid, letter));
      }
    }
    return keys;
  });

  /** Tras el primer uso (hay A/B/C): chip compacto a la derecha cuando está cerrado. */
  protected readonly alreadyConfigured = computed(() => this.existingKeys().size > 0);

  /** Compacto solo cerrado; al expandir ocupa todo el ancho. */
  protected readonly compactCollapsed = computed(
    () => this.alreadyConfigured() && !this.expanded(),
  );

  protected readonly pendingCount = computed(() => {
    const existing = this.existingKeys();
    let n = 0;
    for (const key of this.selected()) {
      if (!existing.has(key)) n++;
    }
    return n;
  });

  protected readonly canSubmit = computed(
    () => !!this.yearUuid() && this.pendingCount() > 0 && !this.busy() && !this.bulkProgress(),
  );

  constructor() {
    /**
     * El padre hidrata {@code ?yearId} / años de forma async; este effect
     * aplica el año de la lista (o ACTIVE) en cuanto estén disponibles,
     * evitando el paso vacío “Elige un año”.
     */
    effect(() => {
      const def = this.defaultYearUuid();
      const years = this.mutableYears();
      if (years.length === 0) return;

      const current = this.yearUuid();
      const currentOk = !!current && years.some((y) => y.publicUuid === current);
      const defOk = !!def && years.some((y) => y.publicUuid === def);

      // Preferir el año del filtro/URL de la página cuando cambia o aún no hay año.
      const pick = defOk
        ? def!
        : currentOk
          ? current!
          : (years.find((y) => y.status === AcademicYearStatus.Active)?.publicUuid ??
            years[0]?.publicUuid ??
            null);

      if (!pick || pick === current) return;

      untracked(() => {
        this.yearUuid.set(pick);
        this.selected.set(new Set());
        this.seedSelectionFromExisting();
        this.syncExpandedForMode();
        if (this.lastEmittedYear !== pick) {
          this.lastEmittedYear = pick;
          this.yearChange.emit(pick);
        }
      });
    });
  }

  protected statusLabel(status: AcademicYearStatus): string {
    switch (status) {
      case AcademicYearStatus.Planning:
        return 'Planificación';
      case AcademicYearStatus.Active:
        return 'Activo';
      case AcademicYearStatus.Closed:
        return 'Cerrado';
    }
  }

  protected sortedGrades(level: AcademicLevel): Grade[] {
    return level.grades.slice().sort((a, b) => a.ordinal - b.ordinal);
  }

  protected isExisting(gradeUuid: string, letter: SectionLetter): boolean {
    return this.existingKeys().has(cellKey(gradeUuid, letter));
  }

  protected isChecked(gradeUuid: string, letter: SectionLetter): boolean {
    const key = cellKey(gradeUuid, letter);
    return this.existingKeys().has(key) || this.selected().has(key);
  }

  protected toggle(gradeUuid: string, letter: SectionLetter, event: Event): void {
    if (this.isExisting(gradeUuid, letter)) return;
    const key = cellKey(gradeUuid, letter);
    const checked = (event.target as HTMLInputElement).checked;
    this.selected.update((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  protected markLevel(level: AcademicLevel, letters: SectionLetter[]): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      for (const g of level.grades) {
        for (const letter of SECTION_LETTERS) {
          const key = cellKey(g.publicUuid, letter);
          if (this.existingKeys().has(key)) continue;
          if (letters.includes(letter)) next.add(key);
          else next.delete(key);
        }
      }
      return next;
    });
  }

  protected clearLevel(level: AcademicLevel): void {
    this.selected.update((prev) => {
      const next = new Set(prev);
      for (const g of level.grades) {
        for (const letter of SECTION_LETTERS) {
          const key = cellKey(g.publicUuid, letter);
          if (!this.existingKeys().has(key)) next.delete(key);
        }
      }
      return next;
    });
  }

  protected onYearChange(value: string | null): void {
    this.yearUuid.set(value);
    this.selected.set(new Set());
    this.resultMessage.set(null);
    this.seedSelectionFromExisting();
    this.syncExpandedForMode();
    if (value) {
      this.lastEmittedYear = value;
      this.yearChange.emit(value);
    }
  }

  protected async submit(): Promise<void> {
    const yearId = this.yearUuid();
    if (!yearId || this.pendingCount() === 0) return;

    const existing = this.existingKeys();
    const items: CreateSectionRequest[] = [];
    for (const key of this.selected()) {
      if (existing.has(key)) continue;
      const [gradePublicUuid, name] = key.split(':');
      if (!gradePublicUuid || !name) continue;
      items.push({ academicYearPublicUuid: yearId, gradePublicUuid, name });
    }
    if (items.length === 0) return;

    this.busy.set(true);
    this.resultMessage.set(null);
    this.resultIsError.set(false);

    try {
      const result = await this.store.createSectionsBulk(items);
      if (result.failedAt != null) {
        this.resultIsError.set(true);
        this.resultMessage.set(
          `Se detuvo en la sección ${result.failedAt}. Creadas: ${result.created}. Omitidas: ${result.skipped}. ${this.store.error() ?? ''}`.trim(),
        );
      } else {
        this.resultIsError.set(false);
        this.resultMessage.set(
          `Listo: ${result.created} creadas` +
            (result.skipped > 0 ? `, ${result.skipped} ya existían` : '') +
            '.',
        );
        this.selected.set(new Set());
        this.completed.emit();
        this.syncExpandedForMode();
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Siempre cerrado al montar / cambiar año / tras crear. */
  private syncExpandedForMode(): void {
    this.expanded.set(false);
  }

  /** Pre-marca A en grados sin ninguna sección del año (arranque típico). */
  private seedSelectionFromExisting(): void {
    const yearId = this.yearUuid();
    if (!yearId) return;
    const existing = this.existingKeys();
    const next = new Set<string>();
    for (const level of this.levels()) {
      for (const g of level.grades) {
        const hasAny = SECTION_LETTERS.some((l) => existing.has(cellKey(g.publicUuid, l)));
        if (!hasAny) {
          const key = cellKey(g.publicUuid, 'A');
          if (!existing.has(key)) next.add(key);
        }
      }
    }
    this.selected.set(next);
  }
}

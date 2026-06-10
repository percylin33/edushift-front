import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  signal
} from '@angular/core';
import {
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { IconComponent } from '@shared/components';
import {
  CRITERIA_MAX,
  CRITERIA_MIN,
  CRITERION_DESCRIPTION_MAX_LENGTH,
  CRITERION_KEY_MAX_LENGTH,
  CRITERION_KEY_PATTERN,
  CRITERION_NAME_MAX_LENGTH,
  CriterionInput,
  DESCRIPTOR_TEXT_MAX_LENGTH,
  LEVELS_MAX,
  LEVELS_MIN,
  LEVEL_CODE_MAX_LENGTH,
  LEVEL_NAME_MAX_LENGTH,
  LevelInput,
  WEIGHT_SUM_TARGET,
  isCriterionKeyValid,
  totalCriteriaWeight,
  uniqueCriterionKeys,
  uniqueLevelCodes
} from '../models';

interface CriteriaLevelsValue {
  criteria: CriterionInput[];
  levels: LevelInput[];
}

/**
 * Editor reactive de criterios + niveles + descriptores, con dos
 * sub-FormArrays. Implementa ControlValueAccessor para que el form
 * padre lo binde con `formControlName` o `[(ngModel)]`.
 *
 * <h3>Comportamiento</h3>
 * <ul>
 *   <li><b>Niveles</b> — 2..4 items con `code` único (case-insensitive
 *       server-side). Default: AD/A/B/C estilo MINEDU.</li>
 *   <li><b>Criterios</b> — 1..10 items con `key` snake_case único y
 *       `weight` ∈ [0, 100]. La suma debe ser exactamente 100 (banner
 *       en vivo si la suma es ≠ 100).</li>
 *   <li><b>Descriptores</b> — opcional por criterio, uno por nivel.
 *       Permite documentar "qué significa AD en este criterio".</li>
 * </ul>
 *
 * <p>El componente solo expone reordenado básico (botones up/down).
 * Drag-and-drop quedaría para FE-5B.2-followup si el feedback lo pide.</p>
 */
@Component({
  selector: 'app-criterion-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, IconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CriterionEditorComponent),
      multi: true
    }
  ],
  template: `
    <div class="grid gap-6">
      <!-- ===================== Levels ===================== -->
      <section class="card">
        <header class="card-header">
          <div>
            <h3 class="card-title">Niveles de logro</h3>
            <p class="card-description">
              Entre {{ LEVELS_MIN }} y {{ LEVELS_MAX }} niveles. Cada criterio
              puede tener un descriptor por nivel.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            [disabled]="readonly() || levels.length >= LEVELS_MAX"
            (click)="addLevel()"
          >
            <app-icon name="plus" [size]="14" />
            <span>Agregar nivel</span>
          </button>
        </header>

        <div class="card-body grid gap-3">
          @for (lvl of levels.controls; let i = $index; track lvl) {
            <div class="grid gap-2 sm:grid-cols-[120px_1fr_80px_auto] items-end">
              <div class="field">
                <label class="label text-xs">Código</label>
                <input
                  type="text"
                  class="input"
                  [formControl]="$any(lvl.get('code'))"
                  [maxlength]="LEVEL_CODE_MAX_LENGTH"
                  placeholder="AD"
                  [readonly]="readonly()"
                />
              </div>
              <div class="field">
                <label class="label text-xs">Nombre</label>
                <input
                  type="text"
                  class="input"
                  [formControl]="$any(lvl.get('name'))"
                  [maxlength]="LEVEL_NAME_MAX_LENGTH"
                  placeholder="Logro destacado"
                  [readonly]="readonly()"
                />
              </div>
              <div class="field">
                <label class="label text-xs">Orden</label>
                <input
                  type="number"
                  min="0"
                  class="input"
                  [formControl]="$any(lvl.get('order'))"
                  placeholder="0"
                  [readonly]="readonly()"
                />
              </div>
              <button
                type="button"
                class="btn btn-ghost btn-xs text-danger-600 hover:bg-danger-50"
                title="Quitar nivel"
                [disabled]="readonly() || levels.length <= LEVELS_MIN"
                (click)="removeLevel(i)"
              >
                <app-icon name="trash-2" [size]="14" />
              </button>
            </div>
          }

          @if (levelsError(); as msg) {
            <p class="field-error">{{ msg }}</p>
          }
        </div>
      </section>

      <!-- ===================== Criteria ===================== -->
      <section class="card">
        <header class="card-header">
          <div>
            <h3 class="card-title">Criterios</h3>
            <p class="card-description">
              Entre {{ CRITERIA_MIN }} y {{ CRITERIA_MAX }} criterios. La suma de
              pesos debe ser <strong>{{ WEIGHT_SUM_TARGET }}</strong>.
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span
              class="text-sm font-mono px-3 py-1 rounded"
              [class.bg-success-50]="weightSumOk()"
              [class.text-success-700]="weightSumOk()"
              [class.bg-warning-50]="!weightSumOk() && weightSumTotal() > 0"
              [class.text-warning-700]="!weightSumOk() && weightSumTotal() > 0"
              [class.bg-surface-subtle]="weightSumTotal() === 0"
              [class.text-content-muted]="weightSumTotal() === 0"
            >
              Σ {{ weightSumTotal() | number: '1.0-2' }}/{{ WEIGHT_SUM_TARGET }}
            </span>
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              [disabled]="readonly() || criteria.length >= CRITERIA_MAX"
              (click)="addCriterion()"
            >
              <app-icon name="plus" [size]="14" />
              <span>Agregar criterio</span>
            </button>
          </div>
        </header>

        <div class="card-body grid gap-4">
          @for (c of criteria.controls; let ci = $index; track c) {
            <article
              class="rounded-lg border border-border-subtle p-4 grid gap-3"
            >
              <div class="grid gap-3 sm:grid-cols-[160px_1fr_120px_auto]">
                <div class="field">
                  <label class="label text-xs">Key (snake_case)</label>
                  <input
                    type="text"
                    class="input font-mono"
                    [formControl]="$any(c.get('key'))"
                    [maxlength]="CRITERION_KEY_MAX_LENGTH"
                    placeholder="organizacion"
                    [readonly]="readonly()"
                  />
                  @if (showKeyError(ci); as msg) {
                    <p class="field-error">{{ msg }}</p>
                  }
                </div>
                <div class="field">
                  <label class="label text-xs">Nombre del criterio</label>
                  <input
                    type="text"
                    class="input"
                    [formControl]="$any(c.get('name'))"
                    [maxlength]="CRITERION_NAME_MAX_LENGTH"
                    placeholder="Organización del texto"
                    [readonly]="readonly()"
                  />
                </div>
                <div class="field">
                  <label class="label text-xs">Peso (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    class="input"
                    [formControl]="$any(c.get('weight'))"
                    placeholder="25"
                    [readonly]="readonly()"
                  />
                </div>
                <button
                  type="button"
                  class="btn btn-ghost btn-xs text-danger-600 hover:bg-danger-50 self-end"
                  title="Quitar criterio"
                  [disabled]="readonly() || criteria.length <= CRITERIA_MIN"
                  (click)="removeCriterion(ci)"
                >
                  <app-icon name="trash-2" [size]="14" />
                </button>
              </div>

              <div class="field">
                <label class="label text-xs">Descripción del criterio</label>
                <textarea
                  class="input"
                  [formControl]="$any(c.get('description'))"
                  rows="2"
                  [maxlength]="CRITERION_DESCRIPTION_MAX_LENGTH"
                  placeholder="Detalle pedagógico — opcional."
                  [readonly]="readonly()"
                ></textarea>
              </div>

              <details class="rounded border border-border-subtle px-3 py-2">
                <summary class="text-sm cursor-pointer">
                  Descriptores por nivel
                  <span class="text-xs text-content-muted ml-2">
                    ({{ getDescriptors(ci).length }} de
                    {{ levels.length }})
                  </span>
                </summary>
                <div class="mt-3 grid gap-2">
                  @for (lvl of levels.controls; let li = $index; track lvl) {
                    <div class="grid gap-1">
                      <label class="label text-xs">
                        {{ lvl.get('code')?.value }} —
                        {{ lvl.get('name')?.value }}
                      </label>
                      <textarea
                        class="input"
                        [value]="getDescriptorText(ci, lvl.get('code')?.value)"
                        (change)="onDescriptorChange(ci, lvl.get('code')?.value, $any($event.target).value)"
                        rows="2"
                        [attr.maxlength]="DESCRIPTOR_TEXT_MAX_LENGTH"
                        [readonly]="readonly()"
                        placeholder="Cómo se ve este criterio en este nivel."
                      ></textarea>
                    </div>
                  }
                </div>
              </details>
            </article>
          }

          @if (criteriaError(); as msg) {
            <p class="field-error">{{ msg }}</p>
          }
        </div>
      </section>
    </div>
  `
})
export class CriterionEditorComponent implements ControlValueAccessor {
  private readonly fb = inject(FormBuilder);

  /** Lectura: deshabilita ediciones para system rubrics. */
  readonly readonly = input<boolean>(false);

  protected readonly LEVELS_MIN = LEVELS_MIN;
  protected readonly LEVELS_MAX = LEVELS_MAX;
  protected readonly LEVEL_CODE_MAX_LENGTH = LEVEL_CODE_MAX_LENGTH;
  protected readonly LEVEL_NAME_MAX_LENGTH = LEVEL_NAME_MAX_LENGTH;
  protected readonly CRITERIA_MIN = CRITERIA_MIN;
  protected readonly CRITERIA_MAX = CRITERIA_MAX;
  protected readonly CRITERION_KEY_MAX_LENGTH = CRITERION_KEY_MAX_LENGTH;
  protected readonly CRITERION_NAME_MAX_LENGTH = CRITERION_NAME_MAX_LENGTH;
  protected readonly CRITERION_DESCRIPTION_MAX_LENGTH =
    CRITERION_DESCRIPTION_MAX_LENGTH;
  protected readonly DESCRIPTOR_TEXT_MAX_LENGTH = DESCRIPTOR_TEXT_MAX_LENGTH;
  protected readonly WEIGHT_SUM_TARGET = WEIGHT_SUM_TARGET;

  /**
   * Map descriptor `(criterionIndex, levelCode) → text`. Mantenemos los
   * descriptores fuera del FormArray porque su forma depende de `levels`
   * (length variable, codes mutables); el patrón de FormArray anidado
   * doblaría la complejidad sin ganar nada.
   */
  protected readonly descriptorsMap = signal<Map<string, string>>(new Map());

  protected readonly form: FormGroup = this.fb.group({
    levels: this.fb.array<FormGroup>([]),
    criteria: this.fb.array<FormGroup>([])
  });

  get levels(): FormArray<FormGroup> {
    return this.form.get('levels') as FormArray<FormGroup>;
  }
  get criteria(): FormArray<FormGroup> {
    return this.form.get('criteria') as FormArray<FormGroup>;
  }

  protected readonly weightSumTotal = computed(() => {
    // Re-evaluar cada vez que cambia un criterio. signal() es una hint
    // para que el computed se invalide; el valor real viene del form.
    void this.formVersion();
    return totalCriteriaWeight(
      this.criteria.controls.map((c) => ({
        weight: parseFloat(String(c.get('weight')?.value ?? 0))
      }))
    );
  });

  protected readonly weightSumOk = computed(
    () => Math.abs(this.weightSumTotal() - WEIGHT_SUM_TARGET) < 0.01
  );

  /** Dummy signal para invalidar computeds al cambiar el form. */
  private readonly formVersion = signal(0);

  // ---- ControlValueAccessor ----

  private onChange: (val: CriteriaLevelsValue) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: CriteriaLevelsValue | null): void {
    this.levels.clear();
    this.criteria.clear();
    this.descriptorsMap.set(new Map());

    const v = val ?? this.defaultValue();
    for (const lvl of v.levels) {
      this.levels.push(this.buildLevelGroup(lvl));
    }
    if (this.levels.length === 0) {
      this.defaultLevels().forEach((l) => this.levels.push(this.buildLevelGroup(l)));
    }
    for (let i = 0; i < v.criteria.length; i++) {
      const c = v.criteria[i];
      this.criteria.push(this.buildCriterionGroup(c));
      for (const d of c.descriptors ?? []) {
        this.descriptorsMap.update((m) => {
          const next = new Map(m);
          next.set(this.descriptorKey(i, d.level), d.text);
          return next;
        });
      }
    }
    if (this.criteria.length === 0) {
      this.criteria.push(this.buildCriterionGroup(this.emptyCriterion()));
    }
    this.bumpVersion();
  }

  registerOnChange(fn: (val: CriteriaLevelsValue) => void): void {
    this.onChange = fn;
    this.form.valueChanges.subscribe(() => {
      this.bumpVersion();
      this.onChange(this.toValue());
    });
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) this.form.disable();
    else this.form.enable();
  }

  // ---- Public API ----

  /** Valor actual con descriptores ya integrados. */
  toValue(): CriteriaLevelsValue {
    const levels: LevelInput[] = this.levels.controls.map((c) => ({
      code: c.get('code')?.value ?? '',
      name: c.get('name')?.value ?? '',
      order: numberOrUndefined(c.get('order')?.value)
    }));
    const criteria: CriterionInput[] = this.criteria.controls.map(
      (c, ci): CriterionInput => ({
        key: (c.get('key')?.value ?? '').trim(),
        name: (c.get('name')?.value ?? '').trim(),
        description:
          ((c.get('description')?.value as string) ?? '').trim() || undefined,
        weight: parseFloat(String(c.get('weight')?.value ?? 0)),
        descriptors: this.collectDescriptors(ci, levels)
      })
    );
    return { levels, criteria };
  }

  /** True si el contenido pasa todas las validaciones cliente-side. */
  isValid(): boolean {
    if (this.levels.length < LEVELS_MIN || this.levels.length > LEVELS_MAX) return false;
    if (this.criteria.length < CRITERIA_MIN || this.criteria.length > CRITERIA_MAX) return false;
    if (!this.weightSumOk()) return false;
    if (this.criteria.controls.some((c) => !isCriterionKeyValid(c.get('key')?.value ?? ''))) {
      return false;
    }
    if (
      !uniqueCriterionKeys(
        this.criteria.controls.map((c) => ({ key: c.get('key')?.value ?? '' }))
      )
    ) {
      return false;
    }
    if (
      !uniqueLevelCodes(
        this.levels.controls.map((l) => ({ code: l.get('code')?.value ?? '' }))
      )
    ) {
      return false;
    }
    return true;
  }

  // ---- Add / remove ----

  protected addLevel(): void {
    if (this.levels.length >= LEVELS_MAX) return;
    this.levels.push(this.buildLevelGroup({ code: '', name: '', order: this.levels.length }));
    this.onTouched();
  }

  protected removeLevel(i: number): void {
    if (this.levels.length <= LEVELS_MIN) return;
    const code = this.levels.at(i).get('code')?.value as string;
    this.levels.removeAt(i);
    if (code) this.dropDescriptorsForLevel(code);
    this.onTouched();
  }

  protected addCriterion(): void {
    if (this.criteria.length >= CRITERIA_MAX) return;
    this.criteria.push(this.buildCriterionGroup(this.emptyCriterion()));
    this.onTouched();
  }

  protected removeCriterion(i: number): void {
    if (this.criteria.length <= CRITERIA_MIN) return;
    this.criteria.removeAt(i);
    this.dropDescriptorsForCriterion(i);
    this.shiftDescriptorsAfter(i);
    this.onTouched();
  }

  // ---- Descriptors ----

  protected getDescriptors(criterionIndex: number): { level: string; text: string }[] {
    return this.collectDescriptors(
      criterionIndex,
      this.levels.controls.map((c) => ({
        code: c.get('code')?.value ?? '',
        name: c.get('name')?.value ?? '',
        order: numberOrUndefined(c.get('order')?.value)
      }))
    );
  }

  protected getDescriptorText(criterionIndex: number, levelCode: string | undefined): string {
    if (!levelCode) return '';
    return this.descriptorsMap().get(this.descriptorKey(criterionIndex, levelCode)) ?? '';
  }

  protected onDescriptorChange(
    criterionIndex: number,
    levelCode: string | undefined,
    text: string
  ): void {
    if (!levelCode) return;
    this.descriptorsMap.update((m) => {
      const next = new Map(m);
      const key = this.descriptorKey(criterionIndex, levelCode);
      const trimmed = text?.trim() ?? '';
      if (trimmed) next.set(key, trimmed);
      else next.delete(key);
      return next;
    });
    this.onChange(this.toValue());
    this.onTouched();
  }

  // ---- Errors ----

  protected showKeyError(i: number): string | null {
    const ctrl = this.criteria.at(i).get('key');
    if (!ctrl) return null;
    const v = (ctrl.value as string) ?? '';
    if (!v && (ctrl.dirty || ctrl.touched)) return 'Requerido.';
    if (v && !isCriterionKeyValid(v)) {
      return 'Solo a-z, 0-9 y _ (snake_case).';
    }
    return null;
  }

  protected criteriaError(): string | null {
    if (this.criteria.length === 0) return 'Debe haber al menos un criterio.';
    if (
      !uniqueCriterionKeys(
        this.criteria.controls.map((c) => ({ key: c.get('key')?.value ?? '' }))
      )
    ) {
      return 'Las keys de criterios deben ser únicas.';
    }
    if (this.weightSumTotal() > 0 && !this.weightSumOk()) {
      return `La suma de pesos debe ser ${WEIGHT_SUM_TARGET} (actual ${this.weightSumTotal().toFixed(2)}).`;
    }
    return null;
  }

  protected levelsError(): string | null {
    if (this.levels.length < LEVELS_MIN) {
      return `Debe haber al menos ${LEVELS_MIN} niveles.`;
    }
    if (
      !uniqueLevelCodes(
        this.levels.controls.map((l) => ({ code: l.get('code')?.value ?? '' }))
      )
    ) {
      return 'Los códigos de nivel deben ser únicos.';
    }
    return null;
  }

  // ---- Internals ----

  private bumpVersion(): void {
    this.formVersion.update((n) => n + 1);
  }

  private buildLevelGroup(lvl: LevelInput): FormGroup {
    return this.fb.group({
      code: new FormControl(lvl.code ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(LEVEL_CODE_MAX_LENGTH)]
      }),
      name: new FormControl(lvl.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(LEVEL_NAME_MAX_LENGTH)]
      }),
      order: new FormControl(lvl.order ?? null, {
        validators: [Validators.min(0)]
      })
    });
  }

  private buildCriterionGroup(c: CriterionInput): FormGroup {
    return this.fb.group({
      key: new FormControl(c.key ?? '', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.maxLength(CRITERION_KEY_MAX_LENGTH),
          Validators.pattern(CRITERION_KEY_PATTERN)
        ]
      }),
      name: new FormControl(c.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(CRITERION_NAME_MAX_LENGTH)]
      }),
      description: new FormControl(c.description ?? '', {
        nonNullable: true,
        validators: [Validators.maxLength(CRITERION_DESCRIPTION_MAX_LENGTH)]
      }),
      weight: new FormControl(c.weight ?? 0, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(0), Validators.max(100)]
      })
    });
  }

  private emptyCriterion(): CriterionInput {
    return { key: '', name: '', description: '', weight: 0, descriptors: [] };
  }

  private defaultValue(): CriteriaLevelsValue {
    return { levels: this.defaultLevels(), criteria: [this.emptyCriterion()] };
  }

  private defaultLevels(): LevelInput[] {
    return [
      { code: 'AD', name: 'Logro destacado', order: 0 },
      { code: 'A', name: 'Logro esperado', order: 1 },
      { code: 'B', name: 'En proceso', order: 2 },
      { code: 'C', name: 'En inicio', order: 3 }
    ];
  }

  private descriptorKey(criterionIndex: number, levelCode: string): string {
    return `${criterionIndex}::${levelCode}`;
  }

  private collectDescriptors(
    criterionIndex: number,
    levels: LevelInput[]
  ): { level: string; text: string }[] {
    const out: { level: string; text: string }[] = [];
    for (const lvl of levels) {
      const txt = this.descriptorsMap().get(
        this.descriptorKey(criterionIndex, lvl.code)
      );
      if (txt) out.push({ level: lvl.code, text: txt });
    }
    return out;
  }

  private dropDescriptorsForLevel(levelCode: string): void {
    this.descriptorsMap.update((m) => {
      const next = new Map(m);
      const suffix = `::${levelCode}`;
      for (const k of [...next.keys()]) {
        if (k.endsWith(suffix)) next.delete(k);
      }
      return next;
    });
  }

  private dropDescriptorsForCriterion(criterionIndex: number): void {
    this.descriptorsMap.update((m) => {
      const next = new Map(m);
      const prefix = `${criterionIndex}::`;
      for (const k of [...next.keys()]) {
        if (k.startsWith(prefix)) next.delete(k);
      }
      return next;
    });
  }

  /**
   * Cuando se elimina un criterio en index `i`, los descriptores de los
   * criterios `> i` deben re-indexarse `i+1 → i`, `i+2 → i+1`, ... para
   * que sigan apuntando a la posición correcta del FormArray.
   */
  private shiftDescriptorsAfter(removedIndex: number): void {
    this.descriptorsMap.update((m) => {
      const next = new Map<string, string>();
      for (const [k, v] of m.entries()) {
        const [idxStr, ...rest] = k.split('::');
        const idx = parseInt(idxStr, 10);
        if (idx < removedIndex) next.set(k, v);
        else if (idx > removedIndex) {
          next.set(`${idx - 1}::${rest.join('::')}`, v);
        }
        // idx === removedIndex se descarta (ya eliminado).
      }
      return next;
    });
  }
}

function numberOrUndefined(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : undefined;
}

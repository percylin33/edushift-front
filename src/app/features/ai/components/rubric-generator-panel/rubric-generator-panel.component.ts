import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { RubricGeneratorService, RubricDraft } from '../../services/rubric-generator.service';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';

/**
 * Rubric generator panel (FE-8.2).
 *
 * <p>Standalone component that asks the (BE-8.2) assistant to draft
 * a rubric. The teacher supplies a course + a list of criteria
 * (one per line). The panel can optionally fork an existing rubric
 * (ADR-8.3) when {@code seedRubricId} is provided as input.</p>
 *
 * <p>On accept the panel emits the {@link RubricDraft} so the parent
 * page can POST it to {@code /v1/academic/rubrics}. This is the same
 * decoupling as the session generator (no auto-persist).</p>
 */
@Component({
  selector: 'app-rubric-generator-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, EmptyStateComponent, IconComponent, SpinnerComponent],
  template: `
    <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <header class="mb-3 flex items-center gap-2">
        <app-icon name="list-checks" class="h-5 w-5 text-indigo-500"></app-icon>
        <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Generar rúbrica con IA
        </h3>
        @if (seedRubricId) {
          <span class="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800
                       dark:bg-amber-900/30 dark:text-amber-300">
            Fork de rúbrica existente
          </span>
        }
      </header>

      <form [formGroup]="form" (ngSubmit)="onGenerate()" class="space-y-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Curso</span>
          <input
            type="text"
            formControlName="courseName"
            placeholder="Historia, Geografía..."
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                   focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                   dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <div>
          <span class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Criterios (uno por línea)
          </span>
          <div formArrayName="criteria" class="space-y-1">
            @for (c of criteriaControls.controls; track $index) {
              <div class="flex items-center gap-2">
                <input
                  [formControlName]="$index"
                  placeholder="p. ej. Análisis de fuentes primarias"
                  class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                         focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                         dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  (click)="removeCriterion($index)"
                  [disabled]="criteriaControls.length === 1"
                  class="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700
                         hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30
                         dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  aria-label="Quitar criterio"
                >×</button>
              </div>
            }
          </div>
          <button
            type="button"
            (click)="addCriterion()"
            class="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >+ Añadir criterio</button>
        </div>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Niveles</span>
          <select
            formControlName="levelCount"
            class="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm
                   focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500
                   dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <option [ngValue]="3">3 niveles</option>
            <option [ngValue]="4">4 niveles</option>
            <option [ngValue]="5">5 niveles</option>
          </select>
        </label>

        <div class="flex items-center justify-between">
          <p class="text-xs" [ngClass]="statusClass()">{{ statusLabel() }}</p>
          <div class="flex gap-2">
            @if (draft(); as d) {
              <button
                type="button"
                (click)="onRegenerate()"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700
                       hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >Regenerar</button>
              <button
                type="button"
                (click)="onAccept()"
                class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >Aceptar borrador</button>
            } @else {
              <button
                type="submit"
                [disabled]="form.invalid || loading()"
                class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white
                       hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                @if (loading()) { <app-spinner class="h-3 w-3"></app-spinner> }
                Generar
              </button>
            }
          </div>
        </div>
      </form>

      @if (error(); as e) {
        <p class="mt-2 text-xs text-rose-600 dark:text-rose-400">{{ e.message }}</p>
      }

      @if (draft(); as d) {
        <article class="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm
                        dark:border-slate-700 dark:bg-slate-900">
          <h4 class="font-semibold text-slate-900 dark:text-slate-100">{{ d.title }}</h4>
          @if (d.description) {
            <p class="text-xs text-slate-600 dark:text-slate-400">{{ d.description }}</p>
          }
          <div class="overflow-x-auto">
            <table class="min-w-full text-xs">
              <thead>
                <tr class="text-left text-slate-500 dark:text-slate-400">
                  <th class="px-2 py-1">Criterio</th>
                  <th class="px-2 py-1">Peso</th>
                  @for (lvl of levelLabels(d); track lvl) {
                    <th class="px-2 py-1">{{ lvl }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (c of d.criteria; track c.name) {
                  <tr class="border-t border-slate-200 dark:border-slate-700">
                    <td class="px-2 py-1 font-medium text-slate-800 dark:text-slate-200">{{ c.name }}</td>
                    <td class="px-2 py-1 text-slate-700 dark:text-slate-300">{{ c.weight }}%</td>
                    @for (lvl of levelLabels(d); track lvl) {
                      <td class="px-2 py-1 text-slate-700 dark:text-slate-300">
                        {{ c.descriptors?.[lvl] ?? '—' }}
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </article>
      } @else if (!loading()) {
        <app-empty-state
          class="mt-3"
          title="Sin borrador"
          description="Añade los criterios y pulsa Generar para que la IA proponga una rúbrica ponderada."
        ></app-empty-state>
      }
    </section>
  `
})
export class RubricGeneratorPanelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(RubricGeneratorService);

  @Input() seedRubricId: string | null = null;

  @Output() accept = new EventEmitter<RubricDraft>();

  readonly form = this.fb.nonNullable.group({
    courseName: ['', Validators.required],
    criteria: this.fb.array<FormControl<string>>(
      [this.fb.nonNullable.control('', Validators.required)],
      [Validators.required, Validators.minLength(1)]
    ),
    levelCount: [4, Validators.required]
  });

  get criteriaControls(): FormArray<FormControl<string>> {
    return this.form.get('criteria') as FormArray<FormControl<string>>;
  }

  readonly draft = signal<RubricDraft | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<{ code: string; message: string } | null>(null);

  addCriterion(): void {
    this.criteriaControls.push(this.fb.nonNullable.control('', Validators.required));
  }
  removeCriterion(i: number): void {
    if (this.criteriaControls.length > 1) this.criteriaControls.removeAt(i);
  }

  statusLabel(): string {
    if (this.loading()) return 'Generando rúbrica…';
    if (this.error())    return 'Error al generar';
    if (this.draft())    return 'Borrador listo';
    return 'Listo';
  }
  statusClass(): string {
    if (this.loading()) return 'text-indigo-600 dark:text-indigo-400';
    if (this.error())    return 'text-rose-600 dark:text-rose-400';
    if (this.draft())    return 'text-emerald-600 dark:text-emerald-400';
    return 'text-slate-500 dark:text-slate-400';
  }

  async onGenerate(): Promise<void> {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      const raw = this.form.getRawValue();
      const criteria = raw.criteria.map((s) => (s ?? '').trim()).filter((s) => s.length > 0);
      const req = {
        courseName: raw.courseName,
        criteria,
        seedRubricId: this.seedRubricId,
        levelCount: raw.levelCount
      };
      const d = await firstValueFrom(this.service.generate(req));
      this.draft.set(d);
    } catch (e: any) {
      this.error.set({ code: e?.code ?? 'AI_UNKNOWN', message: e?.message ?? 'Error desconocido.' });
      this.draft.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  onRegenerate(): void { void this.onGenerate(); }
  onAccept(): void {
    const d = this.draft();
    if (d) this.accept.emit(d);
  }

  /**
   * Compute the level labels for the rendered table based on how many
   * distinct levels appear in the descriptors. Fallback to a 4-level
   * label set when descriptors are missing.
   */
  levelLabels(d: RubricDraft): string[] {
    const firstWithDescriptors = d.criteria.find((c) =>
      c.descriptors && Object.keys(c.descriptors).length > 0);
    if (firstWithDescriptors) {
      return Object.keys(firstWithDescriptors.descriptors);
    }
    return ['L1', 'L2', 'L3', 'L4'];
  }
}

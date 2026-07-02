import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { SessionGeneratorService, SessionDraft } from '../../services/session-generator.service';
import { EmptyStateComponent, IconComponent, SpinnerComponent } from '@shared/components';

/**
 * Session generator panel (FE-8.1).
 *
 * <p>Standalone component that asks the (BE-8.1) assistant to draft a
 * learning session aligned to the MINEDU Peru template (INICIO /
 * DESARROLLO / CIERRE). The teacher can then:</p>
 * <ol>
 *   <li>Review the JSON-shaped draft (preview rendered in a card).</li>
 *   <li>Regenerate → re-runs {@code generate} with the same form,
 *       replacing the draft.</li>
 *   <li>Accept → emits {@link accept} with the {@link SessionDraft} so
 *       the parent page can POST it to {@code /v1/learning-sessions}.</li>
 * </ol>
 *
 * <h3>Decisions</h3>
 * <ul>
 *   <li><b>ADR-8.2</b> — backend enforces strict JSON schema; the FE
 *       just renders the validated payload.</li>
 *   <li><b>Decoupling</b> — the FE does NOT persist the session; it
 *       shows the AI-suggested draft and lets the parent call
 *       {@code POST /v1/learning-sessions} once the teacher accepts.
 *       This is documented in the sprint review and prevents the AI
 *       from creating artifacts without explicit human approval.</li>
 * </ul>
 */
@Component({
  selector: 'app-session-generator-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
  ],
  template: `
    <section
      class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <header class="mb-3 flex items-center gap-2">
        <app-icon name="sparkles" class="h-5 w-5 text-indigo-500"></app-icon>
        <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Generar sesión con IA
        </h3>
      </header>

      <form [formGroup]="form" (ngSubmit)="onGenerate()" class="space-y-3">
        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >Tema</span
          >
          <input
            type="text"
            formControlName="topic"
            placeholder="p. ej. La Revolución Francesa"
            class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <div class="grid grid-cols-2 gap-2">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >Curso</span
            >
            <input
              type="text"
              formControlName="courseName"
              placeholder="Historia, Geografía..."
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
              >Grado</span
            >
            <input
              type="text"
              formControlName="gradeName"
              placeholder="5to secundaria"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>

        <label class="block">
          <span class="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300"
            >Duración (min)</span
          >
          <input
            type="number"
            formControlName="durationMinutes"
            min="15"
            max="240"
            class="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <div class="flex items-center justify-between">
          <p class="text-xs" [ngClass]="statusClass()">{{ statusLabel() }}</p>
          <div class="flex gap-2">
            @if (draft(); as d) {
              <button
                type="button"
                (click)="onRegenerate()"
                class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Regenerar
              </button>
              <button
                type="button"
                (click)="onAccept()"
                class="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              >
                Aceptar borrador
              </button>
            } @else {
              <button
                type="submit"
                [disabled]="form.invalid || loading()"
                class="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                @if (loading()) {
                  <app-spinner class="h-3 w-3"></app-spinner>
                }
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
        <article
          class="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <h4 class="font-semibold text-slate-900 dark:text-slate-100">{{ d.title }}</h4>

          <ol class="space-y-2">
            @for (a of d.activities; track a.phase) {
              <li class="rounded-lg bg-white p-2 dark:bg-slate-800">
                <p
                  class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400"
                >
                  {{ a.phase }} · {{ a.durationMinutes }} min
                </p>
                <p class="text-sm text-slate-700 dark:text-slate-300">{{ a.description }}</p>
              </li>
            }
          </ol>

          @if (d.resources?.length) {
            <div>
              <p
                class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Recursos
              </p>
              <ul class="list-disc pl-5 text-xs text-slate-700 dark:text-slate-300">
                @for (r of d.resources; track r.title) {
                  <li>
                    <span class="font-medium">{{ r.type }}:</span> {{ r.title }}
                    @if (r.url) {
                      <a
                        [href]="r.url"
                        target="_blank"
                        rel="noopener"
                        class="ml-1 text-indigo-600 underline"
                        >abrir</a
                      >
                    }
                  </li>
                }
              </ul>
            </div>
          }

          @if (d.evaluationCriteria?.length) {
            <div>
              <p
                class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
              >
                Criterios de evaluación
              </p>
              <ul class="list-disc pl-5 text-xs text-slate-700 dark:text-slate-300">
                @for (c of d.evaluationCriteria; track c) {
                  <li>{{ c }}</li>
                }
              </ul>
            </div>
          }
        </article>
      } @else if (!loading()) {
        <app-empty-state
          class="mt-3"
          title="Sin borrador"
          description="Completa el formulario y pulsa Generar para que la IA proponga una sesión alineada a la plantilla MINEDU."
        ></app-empty-state>
      }
    </section>
  `,
})
export class SessionGeneratorPanelComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SessionGeneratorService);

  @Input() courseOptions: string[] = [];
  @Input() gradeOptions: string[] = [];

  @Output() accept = new EventEmitter<SessionDraft>();

  /** Reactive form with sensible defaults for a 90-minute lesson. */
  readonly form = this.fb.nonNullable.group({
    topic: ['', [Validators.required, Validators.minLength(3)]],
    courseName: ['', Validators.required],
    gradeName: ['', Validators.required],
    durationMinutes: [90, [Validators.required, Validators.min(15), Validators.max(240)]],
  });

  readonly draft = signal<SessionDraft | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<{ code: string; message: string } | null>(null);

  /** Composite status used to color the small label. */
  statusLabel(): string {
    if (this.loading()) return 'Generando sesión…';
    if (this.error()) return 'Error al generar';
    if (this.draft()) return 'Borrador listo';
    return 'Listo';
  }

  statusClass(): string {
    if (this.loading()) return 'text-indigo-600 dark:text-indigo-400';
    if (this.error()) return 'text-rose-600 dark:text-rose-400';
    if (this.draft()) return 'text-emerald-600 dark:text-emerald-400';
    return 'text-slate-500 dark:text-slate-400';
  }

  async onGenerate(): Promise<void> {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    try {
      const d = await firstValueFrom(this.service.generate(this.form.getRawValue()));
      this.draft.set(d);
    } catch (e: any) {
      this.error.set({
        code: e?.code ?? 'AI_UNKNOWN',
        message: e?.message ?? 'Error desconocido.',
      });
      this.draft.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  /** Re-runs the LLM with the same form. */
  onRegenerate(): void {
    void this.onGenerate();
  }

  onAccept(): void {
    const d = this.draft();
    if (d) this.accept.emit(d);
  }
}

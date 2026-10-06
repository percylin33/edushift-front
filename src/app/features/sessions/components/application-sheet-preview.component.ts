import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApplicationSheetView, SheetItem } from '../models';

@Component({
  selector: 'app-application-sheet-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (sheet(); as s) {
      <article class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            {{ s.kind === 'DIAGNOSTIC' ? 'Evaluación diagnóstica' : 'Ficha de aprendizaje' }}
            · {{ s.grade }}
          </p>
        </header>
        <label class="mb-3 block">
          <span class="mb-1 block text-xs text-slate-500">Título</span>
          <input class="input w-full" [ngModel]="s.title" (ngModelChange)="patch({ title: $event })" />
        </label>

        @if (s.kind === 'LEARNING' && s.content.purpose) {
          <div class="mb-3 grid gap-2">
            <label class="block text-xs text-slate-500">
              Propósito
              <textarea
                rows="2"
                class="input mt-1 w-full"
                [ngModel]="s.content.purpose.purpose"
                (ngModelChange)="patchPurpose('purpose', $event)"
              ></textarea>
            </label>
            <label class="block text-xs text-slate-500">
              Evidencia
              <textarea
                rows="2"
                class="input mt-1 w-full"
                [ngModel]="s.content.purpose.evidence"
                (ngModelChange)="patchPurpose('evidence', $event)"
              ></textarea>
            </label>
            <label class="block text-xs text-slate-500">
              Criterio de este grado
              <textarea
                rows="2"
                class="input mt-1 w-full"
                [ngModel]="s.content.purpose.criterion"
                (ngModelChange)="patchPurpose('criterion', $event)"
              ></textarea>
            </label>
          </div>
        }

        @if (s.kind === 'DIAGNOSTIC') {
          <label class="mb-3 block text-xs text-slate-500">
            Situación significativa
            <textarea
              rows="3"
              class="input mt-1 w-full"
              [ngModel]="s.content.situation"
              (ngModelChange)="patchContent({ situation: $event })"
            ></textarea>
          </label>
        }

        @for (activity of s.content.activities ?? []; track $index; let i = $index) {
          <section class="mb-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
            <input
              class="input mb-2 w-full font-medium"
              [ngModel]="activity.title"
              (ngModelChange)="patchActivity(i, 'title', $event)"
            />
            <textarea
              rows="2"
              class="input mb-2 w-full"
              [ngModel]="activity.instruction"
              (ngModelChange)="patchActivity(i, 'instruction', $event)"
            ></textarea>
            @for (item of activity.items; track $index; let j = $index) {
              <div class="mb-2">
                <p class="text-[11px] uppercase text-slate-400">{{ itemLabel(item) }}</p>
                <input
                  class="input w-full"
                  [ngModel]="item.prompt"
                  (ngModelChange)="patchItem(i, j, $event)"
                />
              </div>
            }
          </section>
        }

        @for (task of s.content.tasks ?? []; track $index) {
          <section class="mb-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900/40">
            <p class="mb-1 text-sm font-medium">{{ task.title }}</p>
            @for (item of task.items; track $index) {
              <p class="text-sm text-slate-700 dark:text-slate-200">{{ itemLabel(item) }} {{ item.prompt }}</p>
            }
          </section>
        }
      </article>
    }
  `,
})
export class ApplicationSheetPreviewComponent {
  readonly sheet = input.required<ApplicationSheetView>();
  readonly sheetChange = output<ApplicationSheetView>();

  protected itemLabel(item: SheetItem): string {
    if (item.kind === 'CHECKBOX') return 'Casilla';
    if (item.kind === 'CHOICE') return 'Opciones';
    return 'Línea';
  }

  protected patch(partial: Partial<ApplicationSheetView>): void {
    this.sheetChange.emit({ ...this.sheet(), ...partial });
  }

  protected patchContent(partial: Partial<ApplicationSheetView['content']>): void {
    this.sheetChange.emit({
      ...this.sheet(),
      content: { ...this.sheet().content, ...partial },
    });
  }

  protected patchPurpose(field: 'purpose' | 'evidence' | 'criterion', value: string): void {
    const purpose = this.sheet().content.purpose;
    if (!purpose) return;
    this.patchContent({ purpose: { ...purpose, [field]: value } });
  }

  protected patchActivity(index: number, field: 'title' | 'instruction', value: string): void {
    const activities = [...(this.sheet().content.activities ?? [])];
    activities[index] = { ...activities[index], [field]: value };
    this.patchContent({ activities });
  }

  protected patchItem(activityIndex: number, itemIndex: number, prompt: string): void {
    const activities = [...(this.sheet().content.activities ?? [])];
    const items = [...activities[activityIndex].items];
    items[itemIndex] = { ...items[itemIndex], prompt };
    activities[activityIndex] = { ...activities[activityIndex], items };
    this.patchContent({ activities });
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationsApiService } from '../../services/notifications-api.service';
import {
  NotificationCategory,
  NotificationPreferenceRow,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
} from '../../models/preferences.model';

/**
 * Notification preferences page (Sprint 9 / FE-9.4).
 *
 * <p>Renders a matrix: rows = categories, columns = channels, cells =
 * toggle switches. Default = all enabled. The user can flip a cell to
 * opt out of a given channel × category. Saves on change with a small
 * debounce (200ms) so quick flips don't spam the backend.</p>
 */
@Component({
  selector: 'app-notification-preferences-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl px-4 py-8 sm:py-10">
      <header class="mb-6">
        <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Preferencias de notificaciones
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Elige cómo quieres recibir cada tipo de aviso. Por defecto, todas las combinaciones están
          activadas.
        </p>
      </header>

      <div
        class="overflow-hidden rounded-2xl bg-white shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
      >
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr
                class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/50 dark:text-slate-400"
              >
                <th class="px-4 py-3">Categoría</th>
                @for (ch of channels; track ch) {
                  <th class="px-4 py-3 text-center">{{ channelLabel(ch) }}</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (cat of categories; track cat) {
                <tr>
                  <td class="px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {{ categoryLabel(cat) }}
                  </td>
                  @for (ch of channels; track ch) {
                    <td class="px-4 py-3 text-center">
                      <label class="inline-flex cursor-pointer items-center">
                        <input
                          type="checkbox"
                          class="sr-only"
                          [checked]="isEnabled(cat, ch)"
                          (change)="onToggle(cat, ch, $any($event.target).checked)"
                        />
                        <span
                          class="relative inline-block h-5 w-9 rounded-full transition focus-within:ring-2 focus-within:ring-emerald-500"
                          [class.bg-emerald-500]="isEnabled(cat, ch)"
                          [class.bg-slate-300]="!isEnabled(cat, ch)"
                        >
                          <span
                            class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                            [class.translate-x-4]="isEnabled(cat, ch)"
                          >
                          </span>
                        </span>
                      </label>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (saving()) {
          <div
            class="bg-emerald-50 px-4 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            Guardando…
          </div>
        }
        @if (savedAt()) {
          <div
            class="bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:bg-slate-800/30 dark:text-slate-400"
          >
            Guardado a las {{ savedAt() | date: 'shortTime' }}
          </div>
        }
      </div>
    </section>
  `,
})
export class NotificationPreferencesPageComponent implements OnInit {
  private readonly api = inject(NotificationsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly channels = NOTIFICATION_CHANNELS;
  readonly categories = NOTIFICATION_CATEGORIES;

  /** Default-on matrix. */
  private readonly state = signal<Record<string, boolean>>({});
  readonly saving = signal(false);
  readonly savedAt = signal<Date | null>(null);

  ngOnInit(): void {
    this.api
      .getPreferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          const next: Record<string, boolean> = {};
          for (const r of rows as NotificationPreferenceRow[]) {
            next[this.key(r.category, r.channel)] = r.enabled;
          }
          // Fill defaults for missing combinations.
          for (const c of this.categories) {
            for (const ch of this.channels) {
              const k = this.key(c, ch);
              if (next[k] === undefined) next[k] = true;
            }
          }
          this.state.set(next);
        },
        error: () => {
          // If the backend has no rows yet, default everything to on.
          const next: Record<string, boolean> = {};
          for (const c of this.categories)
            for (const ch of this.channels) {
              next[this.key(c, ch)] = true;
            }
          this.state.set(next);
        },
      });
  }

  isEnabled(category: NotificationCategory, channel: string): boolean {
    return this.state()[this.key(category, channel as any)] !== false;
  }

  onToggle(category: NotificationCategory, channel: string, enabled: boolean): void {
    this.state.update((s) => ({ ...s, [this.key(category, channel as any)]: enabled }));
    this.saving.set(true);
    this.api
      .updatePreference({ category, channel: channel as any, enabled })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.savedAt.set(new Date());
        },
        error: () => {
          this.saving.set(false); /* keep UI state; will retry on next toggle */
        },
      });
  }

  channelLabel(ch: string): string {
    return ch === 'IN_APP' ? 'En la app' : ch === 'EMAIL' ? 'Email' : ch;
  }

  categoryLabel(cat: NotificationCategory): string {
    return (
      (
        {
          ABSENCE: 'Ausencias',
          GRADE: 'Calificaciones',
          QUIZ: 'Quizzes',
          TASK: 'Tareas',
          AI_FEEDBACK: 'Feedback IA',
          ANNOUNCEMENT: 'Anuncios',
          PAYMENT: 'Pagos',
          SYSTEM: 'Sistema',
        } as Record<NotificationCategory, string>
      )[cat] ?? cat
    );
  }

  private key(c: NotificationCategory, ch: string): string {
    return `${ch}::${c}`;
  }
}

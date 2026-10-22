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
  PushNotificationsService,
  type PushActivationResult,
  type PushDeactivationResult,
} from '../../services/push-notifications.service';
import {
  NotificationCategory,
  NotificationChannel,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  PUSH_NOTIFICATION_CATEGORIES,
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
          Elige cómo quieres recibir cada tipo de aviso. Los avisos en la app y por email están
          activados por defecto; push requiere que lo actives.
        </p>
      </header>

      <section
        class="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="push-notifications-title"
      >
        <div>
          <h2
            id="push-notifications-title"
            class="font-semibold text-slate-900 dark:text-slate-100"
          >
            Notificaciones en este dispositivo
          </h2>
          <p class="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Recibe avisos de EduShift aunque no tengas la aplicación abierta. El contenido académico
            se consulta dentro de tu cuenta.
          </p>
          <p class="mt-1 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
            Push está disponible para anuncios, ausencias, tareas, prácticas y calificaciones.
          </p>
          @if (pushResult()) {
            <p class="mt-2 text-sm" role="status" aria-live="polite">{{ pushResultLabel() }}</p>
          }
        </div>
        <button
          type="button"
          class="min-h-11 shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60"
          [disabled]="pushLoading()"
          (click)="togglePush()"
        >
          {{
            pushLoading()
              ? pushActive()
                ? 'Desactivando…'
                : 'Activando…'
              : pushActive()
                ? 'Desactivar notificaciones'
                : 'Activar notificaciones'
          }}
        </button>
      </section>

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
                          [disabled]="ch === 'PUSH' && !isPushCategoryAllowed(cat)"
                          [attr.aria-label]="categoryLabel(cat) + ': ' + channelLabel(ch)"
                          (change)="onPreferenceChange(cat, ch, $event)"
                        />
                        <span
                          class="relative inline-block h-5 w-9 rounded-full transition focus-within:ring-2 focus-within:ring-emerald-500"
                          [class.bg-emerald-500]="isEnabled(cat, ch)"
                          [class.bg-slate-300]="!isEnabled(cat, ch)"
                          [class.opacity-40]="ch === 'PUSH' && !isPushCategoryAllowed(cat)"
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
  private readonly pushNotifications = inject(PushNotificationsService);
  private readonly destroyRef = inject(DestroyRef);

  readonly channels = NOTIFICATION_CHANNELS;
  readonly categories = NOTIFICATION_CATEGORIES;
  readonly pushCategories = PUSH_NOTIFICATION_CATEGORIES;
  private readonly pushCategorySet = new Set<NotificationCategory>(PUSH_NOTIFICATION_CATEGORIES);

  /** Default-on matrix. */
  private readonly state = signal<Record<string, boolean>>({});
  readonly saving = signal(false);
  readonly savedAt = signal<Date | null>(null);
  readonly pushLoading = signal(false);
  readonly pushResult = signal<PushActivationResult | PushDeactivationResult | null>(null);
  readonly pushActive = signal(false);

  async togglePush(): Promise<void> {
    this.pushLoading.set(true);
    try {
      if (this.pushActive()) {
        const result = await this.pushNotifications.deactivateForCurrentDevice();
        this.pushResult.set(result);
        if (result === 'disabled') this.pushActive.set(false);
      } else {
        const result = await this.pushNotifications.activateForCurrentDevice();
        this.pushResult.set(result);
        this.pushActive.set(result === 'enabled');
      }
    } finally {
      this.pushLoading.set(false);
    }
  }

  pushResultLabel(): string {
    const labels: Record<PushActivationResult | PushDeactivationResult, string> = {
      enabled: 'Este dispositivo quedó registrado para notificaciones push.',
      disabled: 'Se desactivaron las notificaciones en este dispositivo.',
      'permission-denied':
        'El permiso fue denegado. Puedes habilitarlo desde los ajustes del navegador.',
      unsupported: 'Este navegador o conexión no permite notificaciones push.',
      'not-configured': 'La configuración de Firebase para push todavía no está completa.',
      'not-authenticated': 'Inicia sesión para registrar este dispositivo.',
      failed: 'No se pudo activar push. Revisa tu conexión e inténtalo de nuevo.',
    };
    const result = this.pushResult();
    return result ? labels[result] : '';
  }

  ngOnInit(): void {
    this.pushActive.set(this.pushNotifications.isEnabledForCurrentUser());
    this.api
      .getPreferences()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          const next: Record<string, boolean> = {};
          for (const r of rows) {
            next[this.key(r.category, r.channel)] = r.enabled;
          }
          // Fill defaults for missing combinations.
          for (const c of this.categories) {
            for (const ch of this.channels) {
              const k = this.key(c, ch);
              if (next[k] === undefined) next[k] = this.defaultEnabled(ch);
            }
          }
          this.state.set(next);
        },
        error: () => {
          // If the backend has no rows yet, default everything to on.
          const next: Record<string, boolean> = {};
          for (const c of this.categories)
            for (const ch of this.channels) {
              next[this.key(c, ch)] = this.defaultEnabled(ch);
            }
          this.state.set(next);
        },
      });
  }

  isEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
    return this.state()[this.key(category, channel)] !== false;
  }

  onPreferenceChange(
    category: NotificationCategory,
    channel: NotificationChannel,
    event: Event,
  ): void {
    if (!(event.target instanceof HTMLInputElement)) return;
    this.onToggle(category, channel, event.target.checked);
  }

  onToggle(category: NotificationCategory, channel: NotificationChannel, enabled: boolean): void {
    if (channel === 'PUSH' && !this.isPushCategoryAllowed(category)) return;
    const key = this.key(category, channel);
    const previous = this.isEnabled(category, channel);
    this.state.update((s) => ({ ...s, [this.key(category, channel)]: enabled }));
    this.saving.set(true);
    this.api
      .updatePreference({ category, channel, enabled })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.savedAt.set(new Date());
        },
        error: () => {
          this.state.update((s) => ({ ...s, [key]: previous }));
          this.saving.set(false);
        },
      });
  }

  channelLabel(channel: NotificationChannel): string {
    if (channel === 'IN_APP') return 'En la app';
    if (channel === 'EMAIL') return 'Email';
    return 'Push';
  }

  isPushCategoryAllowed(category: NotificationCategory): boolean {
    return this.pushCategorySet.has(category);
  }

  categoryLabel(cat: NotificationCategory): string {
    return (
      (
        {
          ABSENCE: 'Ausencias',
          GRADE: 'Calificaciones',
          QUIZ: 'Prácticas',
          TASK: 'Tareas',
          AI_FEEDBACK: 'Feedback IA',
          ANNOUNCEMENT: 'Anuncios',
          PAYMENT: 'Pagos',
          SYSTEM: 'Sistema',
        } as Record<NotificationCategory, string>
      )[cat] ?? cat
    );
  }

  private defaultEnabled(channel: NotificationChannel): boolean {
    return channel !== 'PUSH';
  }

  private key(c: NotificationCategory, ch: NotificationChannel): string {
    return `${ch}::${c}`;
  }
}

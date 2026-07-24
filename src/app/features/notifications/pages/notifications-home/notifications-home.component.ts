import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import {
  EmptyStateComponent,
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import { NotificationsStore } from '../../store';
import { NotificationItem } from '../../models';

/**
 * In-app notifications home (Sprint 9 / FE-9.3 + Sprint 5C cascade wiring).
 *
 * <h3>State source</h3>
 * Reads from {@link NotificationsStore} so the bell badge in the
 * layout and this page always agree. {@link markAsRead} delegates to
 * the store, which mutates the in-memory list and lets the bell
 * re-evaluate {@code unreadCount} without a refetch.
 *
 * <h3>Backend contract</h3>
 * {@code GET /v1/notifications?unreadOnly=false} returns an
 * {@link ApiResponse} envelope; pagination meta lives in
 * {@code response.meta}, rows in {@code response.data}. Each row
 * carries {@code subject} ("{template} · {sentAt}") and
 * {@code bodyHtml} (the rendered payload JSON).
 */
@Component({
  selector: 'app-notifications-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    PageContainerComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    SpinnerComponent,
    IconComponent,
  ],
  template: `
    <app-page-container size="narrow">
      <app-page-header
        title="Notificaciones"
        subtitle="Centro de notificaciones del tenant."
      />

      @if (loading()) {
        <div
          class="flex items-center justify-center py-12"
          data-testid="notifications-loading"
        >
          <app-spinner [size]="32" />
        </div>
      } @else if (error()) {
        <div class="card">
          <div class="card-body">
            <app-empty-state
              icon="alert-circle"
              title="No se pudieron cargar las notificaciones"
              description="Vuelve a intentarlo en unos segundos; el error ya quedó registrado."
            >
              <button type="button" class="btn btn-secondary" (click)="reload()">
                Reintentar
              </button>
            </app-empty-state>
          </div>
        </div>
      } @else if (notifications().length === 0) {
        <div class="card" data-testid="notifications-empty">
          <div class="card-body">
            <app-empty-state
              icon="bell"
              title="Sin notificaciones"
              description="Te avisaremos aquí cuando ocurra algo importante."
            />
          </div>
        </div>
      } @else {
        <ul
          class="divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800"
          data-testid="notifications-list"
        >
          @for (n of notifications(); track n.publicUuid) {
            <li
              class="flex items-start gap-4 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
              [class.opacity-60]="isRead(n)"
              [attr.data-testid]="'notification-' + n.publicUuid"
              [attr.data-read]="isRead(n) ? 'true' : 'false'"
            >
              <div
                class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                [class.bg-rose-50]="!isRead(n)"
                [class.text-rose-600]="!isRead(n)"
                [class.bg-slate-100]="isRead(n)"
                [class.text-slate-400]="isRead(n)"
                [attr.aria-hidden]="true"
              >
                <app-icon [name]="iconFor(n)" [size]="18" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-3">
                  <p class="truncate text-sm font-semibold text-content">
                    {{ n.subject }}
                  </p>
                  <span class="shrink-0 text-xs text-content-subtle">
                    @if (n.sentAt) {
                      {{ n.sentAt | date: 'short' }}
                    }
                  </span>
                </div>
                <p class="mt-0.5 line-clamp-2 text-sm text-content-muted">
                  {{ summarize(n) }}
                </p>
                <div class="mt-2 flex items-center gap-2 text-xs">
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    [class.bg-emerald-50]="n.status === 'READ'"
                    [class.text-emerald-700]="n.status === 'READ'"
                    [class.bg-sky-50]="n.status !== 'READ'"
                    [class.text-sky-700]="n.status !== 'READ'"
                  >
                    {{ n.status === 'READ' ? 'Leída' : 'Nueva' }}
                  </span>
                  <span class="text-content-subtle">·</span>
                  <span class="text-content-subtle">{{ categoryLabel(n.category) }}</span>
                  @if (!isRead(n)) {
                    <span class="text-content-subtle">·</span>
                    <button
                      type="button"
                      class="font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:underline"
                      (click)="markAsRead(n)"
                    >
                      Marcar como leída
                    </button>
                  }
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </app-page-container>
  `,
})
export class NotificationsHomeComponent implements OnInit {
  private readonly store = inject(NotificationsStore);
  private readonly destroyRef = inject(DestroyRef);

  readonly notifications = this.store.items;
  readonly loading = this.store.loading;
  readonly error = computed(() => Boolean(this.store.error()));

  constructor() {
    // Touch the store's items signal so this component re-renders
    // when the store mutates (e.g. after markRead from this page or
    // after refreshUnreadCount from the bell).
    effect(() => {
      this.notifications();
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.store
      .loadAll()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of(null))
      )
      .subscribe();
  }

  markAsRead(n: NotificationItem): void {
    this.store
      .markRead(n.publicUuid)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => of(null))
      )
      .subscribe();
  }

  isRead(n: NotificationItem): boolean {
    return n.status === 'READ' || Boolean(n.readAt);
  }

  iconFor(n: NotificationItem): 'bell' | 'megaphone' | 'sparkles' {
    switch (n.category) {
      case 'ANNOUNCEMENT':
        return 'megaphone';
      case 'SYSTEM':
        return 'sparkles';
      default:
        return 'bell';
    }
  }

  categoryLabel(cat: string): string {
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
        } as Record<string, string>
      )[cat] ?? cat
    );
  }

  summarize(n: NotificationItem): string {
    try {
      const parsed = JSON.parse(n.bodyHtml ?? '{}');
      const section = parsed['sectionName'];
      const teacher = parsed['teacherName'];
      const course = parsed['courseCode'];
      const title = parsed['title'];
      const body = parsed['body'];
      const parts: string[] = [];
      if (course) parts.push(`Curso ${course}`);
      if (section) parts.push(`sección ${section}`);
      if (teacher && teacher !== n.subject) parts.push(`docente ${teacher}`);
      if (parts.length > 0) return parts.join(' · ');
      if (title) return title;
      if (body) return body.replace(/<[^>]+>/g, '').slice(0, 120);
    } catch {
      /* payload not JSON — fall through */
    }
    return n.subject ?? '';
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { PageHeaderComponent } from '@shared/components';
import { PageContainerComponent } from '@shared/components';
import { SpinnerComponent } from '@shared/components';
import { EmptyStateComponent } from '@shared/components';
import { IconComponent } from '@shared/components';

import { HelpService } from '../../services/help.service';
import { ManualIndexEntry } from '../../models/help.model';

interface ManualCard extends ManualIndexEntry {
  /** Display label for the status badge (`live` → "Completo", `partial` → "Cobertura parcial"). */
  statusLabel: string;
  /** CSS classes for the status badge. */
  statusClass: string;
}

/**
 * Help manuals index page.
 *
 * <p>Lands at `/help`. Lists every manual available on the platform
 * (one per role) as a card grid. Clicking a card opens the role's
 * {@code README} in the {@link HelpViewerPageComponent}.
 *
 * <p>Public — does not require an authenticated session, so an
 * unauthenticated user landing on the login screen can browse the
 * manuals before signing in.</p>
 */
@Component({
  selector: 'app-help-index',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    DatePipe,
    PageHeaderComponent,
    PageContainerComponent,
    SpinnerComponent,
    EmptyStateComponent,
    IconComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Manuales de usuario"
        subtitle="Guías por rol: cómo entrar, qué puedes hacer y cómo evaluar tu dominio de EduShift."
      >
        <a
          routerLink="/dashboard"
          class="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
        >
          <app-icon name="arrow-left" [size]="14" />
          Volver al dashboard
        </a>
      </app-page-header>

      @if (loading()) {
        <div class="flex items-center justify-center py-12">
          <app-spinner [size]="20" />
        </div>
      } @else if (loadError()) {
        <div
          role="alert"
          class="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm text-danger"
        >
          <p class="font-medium">No se pudo cargar el índice de manuales.</p>
          <p class="mt-1 text-danger/80">{{ loadError() }}</p>
          <button
            type="button"
            (click)="reload()"
            class="mt-3 inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-content hover:bg-surface-muted"
          >
            <app-icon name="rotate-ccw" [size]="14" />
            Reintentar
          </button>
        </div>
      } @else if (cards().length === 0) {
        <app-empty-state
          title="No hay manuales disponibles"
          description="El backend aún no ha publicado manuales. Contacta al administrador de la plataforma."
        />
      } @else {
        <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (card of cards(); track card.role) {
            <li>
              <a
                [routerLink]="['/help', card.role]"
                class="group flex h-full flex-col gap-3 rounded-lg border border-border bg-surface-raised p-5 shadow-sm transition hover:border-primary-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30"
              >
                <header class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span
                      class="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary-500/10 text-primary-700 dark:text-primary-300"
                      aria-hidden="true"
                    >
                      <app-icon name="book-open" [size]="18" />
                    </span>
                    <div class="min-w-0">
                      <p class="text-2xs font-semibold uppercase tracking-wider text-content-subtle">
                        {{ card.role }}
                      </p>
                      <h2 class="truncate text-base font-semibold text-content">{{ card.title }}</h2>
                    </div>
                  </div>
                  <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium"
                    [class]="card.statusClass"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      [class.bg-success]="card.status === 'live'"
                      [class.bg-warning]="card.status === 'partial'"
                      aria-hidden="true"
                    ></span>
                    {{ card.statusLabel }}
                  </span>
                </header>

                <p class="line-clamp-3 text-sm text-content-muted">{{ card.summary }}</p>

                <footer class="mt-auto flex items-center justify-between text-xs text-content-subtle">
                  <span>Actualizado {{ card.updatedAt | date: 'longDate' }}</span>
                  <span
                    class="inline-flex items-center gap-1 font-medium text-primary-600 transition group-hover:gap-1.5"
                  >
                    Leer manual
                    <app-icon name="arrow-right" [size]="12" />
                  </span>
                </footer>
              </a>
            </li>
          }
        </ul>
      }
    </app-page-container>
  `,
})
export class HelpIndexPageComponent {
  private readonly helpService = inject(HelpService);

  protected readonly entries = signal<ManualIndexEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly cards = computed<ManualCard[]>(() =>
    this.entries().map((e) => ({
      ...e,
      statusLabel: e.status === 'live' ? 'Completo' : 'Cobertura parcial',
      statusClass:
        e.status === 'live'
          ? 'bg-success/10 text-success'
          : 'bg-warning/10 text-warning',
    })),
  );

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.helpService
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (entries) => this.entries.set(entries ?? []),
        error: (err: HttpErrorResponse) => {
          this.loadError.set(this.toMessage(err));
        },
      });
  }

  private toMessage(err: HttpErrorResponse): string {
    if (err.status === 0) return 'No se pudo conectar con el servidor.';
    if (err.status >= 500) return 'Error del servidor. Intenta nuevamente en unos minutos.';
    return 'Respuesta inesperada del servidor.';
  }
}
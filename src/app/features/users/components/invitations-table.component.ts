import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { InvitationStatus } from '@core/enums';
import {
  EmptyStateComponent,
  IconComponent,
  SpinnerComponent
} from '@shared/components';
import { Invitation } from '../models';
import { InvitationsStore } from '../store';
import { InvitationStatusBadgeComponent } from './invitation-status-badge.component';
import { UserRoleBadgeComponent } from './user-role-badge.component';

/**
 * Pending-invitations sub-view of the {@code /users} page.
 *
 * <p>Self-loading: the parent doesn't need to call {@code loadList} on
 * the {@link InvitationsStore} — when this component mounts (i.e. the
 * tab becomes visible) it pulls page 0. Subsequent navigation between
 * tabs preserves the cursor; only an explicit refresh action will
 * re-fetch.
 *
 * <p>Surface-level concerns:
 * <ul>
 *   <li>Cancel CTA gated to PENDING rows; once cancelled the row stays
 *       in the table for audit, with a faded badge.</li>
 *   <li>"Copiar enlace" is intentionally absent here — list rows do
 *       not carry the token (the backend strips it on purpose, see
 *       {@code InvitationResponse.withoutToken}). The token is only
 *       available in the create-success step inside the modal.</li>
 * </ul>
 */
@Component({
  selector: 'app-invitations-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    IconComponent,
    SpinnerComponent,
    InvitationStatusBadgeComponent,
    UserRoleBadgeComponent
  ],
  template: `
    @if (loading() && !hasItems()) {
      <div class="flex items-center justify-center py-16">
        <app-spinner [size]="24" label="Cargando invitaciones…" />
      </div>
    } @else if (errorMessage()) {
      <div class="alert alert-danger m-5">
        <app-icon name="alert-circle" [size]="18" />
        <div class="flex-1">
          <p class="font-medium">No pudimos cargar las invitaciones.</p>
          <p class="mt-1 text-xs opacity-80">{{ errorMessage() }}</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" (click)="retry()">Reintentar</button>
      </div>
    } @else if (isEmpty()) {
      <app-empty-state
        icon="mail"
        title="Aún no hay invitaciones"
        description="Invita al primer miembro del equipo para empezar."
      />
    } @else {
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th class="min-w-[220px]">Destinatario</th>
              <th class="hidden md:table-cell">Roles</th>
              <th>Estado</th>
              <th class="hidden lg:table-cell">Expira</th>
              <th class="hidden lg:table-cell">Creada</th>
              <th class="text-right" aria-label="Acciones"></th>
            </tr>
          </thead>
          <tbody>
            @for (inv of items(); track inv.publicUuid) {
              <tr>
                <td>
                  <p class="font-medium text-content">{{ inv.fullName }}</p>
                  <p class="text-xs text-content-muted">{{ inv.email }}</p>
                </td>
                <td class="hidden md:table-cell">
                  <div class="flex flex-wrap gap-1.5">
                    @for (r of inv.roles; track r) {
                      <app-user-role-badge [role]="r" />
                    }
                  </div>
                </td>
                <td>
                  <app-invitation-status-badge [status]="inv.status" />
                </td>
                <td class="hidden lg:table-cell text-content-muted">
                  {{ formatDate(inv.expiresAt) }}
                </td>
                <td class="hidden lg:table-cell text-content-muted">
                  {{ formatDate(inv.createdAt) }}
                </td>
                <td class="text-right">
                  @if (canCancel(inv)) {
                    <button
                      type="button"
                      class="btn btn-ghost btn-sm"
                      [disabled]="pendingCancelId() === inv.publicUuid"
                      (click)="onCancel(inv)"
                    >
                      @if (pendingCancelId() === inv.publicUuid) {
                        <app-spinner [size]="14" />
                      } @else {
                        <app-icon name="x" [size]="16" />
                      }
                      <span class="hidden sm:inline">Cancelar</span>
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <footer
        class="flex flex-col items-center justify-between gap-3 border-t border-border-subtle px-5 py-3 sm:flex-row"
      >
        <p class="text-xs text-content-muted">
          Página
          <span class="font-medium text-content">{{ pagination().page + 1 }}</span>
          de
          <span class="font-medium text-content">{{ Math.max(pagination().totalPages, 1) }}</span>
          · {{ pagination().totalElements }} invitaciones
        </p>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-outline btn-sm"
            [disabled]="!canPrev() || loading()"
            (click)="prev()"
          >
            <app-icon name="chevron-left" [size]="16" />
            <span class="hidden sm:inline">Anterior</span>
          </button>
          <button
            type="button"
            class="btn btn-outline btn-sm"
            [disabled]="!canNext() || loading()"
            (click)="next()"
          >
            <span class="hidden sm:inline">Siguiente</span>
            <app-icon name="chevron-right" [size]="16" />
          </button>
        </div>
      </footer>
    }
  `
})
export class InvitationsTableComponent implements OnInit {
  protected readonly store = inject(InvitationsStore);

  protected readonly Math = Math;

  protected readonly items = this.store.items;
  protected readonly hasItems = this.store.hasItems;
  protected readonly isEmpty = this.store.isEmpty;
  protected readonly loading = this.store.loading;
  protected readonly pagination = this.store.pagination;
  protected readonly errorMessage = this.store.error;

  protected readonly canPrev = computed(() => this.pagination().page > 0);
  protected readonly canNext = computed(() => {
    const { page, totalPages } = this.pagination();
    return page + 1 < totalPages;
  });

  /**
   * Tracks the row whose cancel button is currently in flight so we can
   * show a per-row spinner instead of disabling the whole table.
   */
  protected readonly pendingCancelId = signal<string | null>(null);

  ngOnInit(): void {
    /* Lazy fetch: only hit the API the first time the tab is shown. */
    if (this.store.items().length === 0) {
      void this.store.loadList();
    }
  }

  protected canCancel(inv: Invitation): boolean {
    return inv.status === InvitationStatus.Pending;
  }

  protected async onCancel(inv: Invitation): Promise<void> {
    if (!this.canCancel(inv)) return;
    if (!confirm(`¿Cancelar la invitación a ${inv.email}?`)) return;
    this.pendingCancelId.set(inv.publicUuid);
    try {
      await this.store.cancel(inv.publicUuid);
    } finally {
      this.pendingCancelId.set(null);
    }
  }

  protected prev(): void {
    void this.store.goToPage(this.pagination().page - 1);
  }

  protected next(): void {
    void this.store.goToPage(this.pagination().page + 1);
  }

  protected retry(): void {
    this.store.clearError();
    void this.store.loadList();
  }

  protected formatDate(date: Date | undefined): string {
    if (!date) return '—';
    return date.toLocaleString('es', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

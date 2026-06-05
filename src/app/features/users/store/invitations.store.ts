import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UsersApiService } from '../services';
import { CreateInvitationRequest, Invitation, UserListPagination } from '../models';

interface PaginationState {
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Reactive façade for {@code /v1/users/invitations} (admin paths only).
 *
 * <p>Kept separate from {@link UsersStore} on purpose:
 * <ul>
 *   <li>Independent loading flags — the invitations tab spinner must
 *       not flicker while the users list refetches.</li>
 *   <li>Independent pagination — the two tabs hold different cursors,
 *       and switching tabs should not reset the other one's page.</li>
 *   <li>Independent error surface — a failed cancel on the
 *       invitations tab should not paint the users table red.</li>
 * </ul>
 *
 * <p>The just-created invitation is held in {@link #lastCreated} so
 * the modal can keep showing the freshly minted token (and the
 * "copy link" button) on the success step without an extra refetch.
 */
@Injectable({ providedIn: 'root' })
export class InvitationsStore {
  private readonly api = inject(UsersApiService);

  private readonly _items = signal<Invitation[]>([]);
  private readonly _pagination = signal<PaginationState>({
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0
  });
  private readonly _loading = signal(false);
  private readonly _saving = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _lastCreated = signal<Invitation | null>(null);

  readonly items = this._items.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly error = this._error.asReadonly();
  readonly lastCreated = this._lastCreated.asReadonly();

  readonly hasItems = computed(() => this._items().length > 0);
  readonly isEmpty = computed(() => !this._loading() && this._items().length === 0);

  // ===========================================================================
  // Reads
  // ===========================================================================

  async loadList(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    const { page, size } = this._pagination();
    const pagination: UserListPagination = { page, size };

    try {
      const result = await firstValueFrom(this.api.listInvitations(pagination));
      this._items.set(result.content);
      this._pagination.set({
        page: result.number,
        size: result.size,
        totalElements: result.totalElements,
        totalPages: result.totalPages
      });
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._items.set([]);
    }
    finally {
      this._loading.set(false);
    }
  }

  async goToPage(page: number): Promise<void> {
    const totalPages = this._pagination().totalPages;
    const clamped = Math.max(0, totalPages > 0 ? Math.min(page, totalPages - 1) : 0);
    this._pagination.update((p) => ({ ...p, page: clamped }));
    await this.loadList();
  }

  // ===========================================================================
  // Writes
  // ===========================================================================

  async create(request: CreateInvitationRequest): Promise<Invitation | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const created = await firstValueFrom(this.api.createInvitation(request));
      /* Pin to the modal's success step. Cleared by {@link clearLastCreated}. */
      this._lastCreated.set(created);
      /* Optimistic insert into the visible list — the new invitation
       * is PENDING and the default sort puts it near the top. We
       * deliberately don't refetch: that would clobber any in-flight
       * pagination state the admin had set. */
      this._items.update((rows) => [created, ...rows]);
      this._pagination.update((p) => ({
        ...p,
        totalElements: p.totalElements + 1,
        totalPages: Math.max(p.totalPages, Math.ceil((p.totalElements + 1) / p.size))
      }));
      return created;
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    }
    finally {
      this._saving.set(false);
    }
  }

  async cancel(publicUuid: string): Promise<Invitation | null> {
    this._saving.set(true);
    this._error.set(null);
    try {
      const cancelled = await firstValueFrom(this.api.cancelInvitation(publicUuid));
      /* Replace the row in place — the backend transitions PENDING →
       * CANCELLED but the row still belongs in the admin tab so the
       * audit trail is visible. (List endpoint also surfaces non-pending
       * invitations as the backend ships every status it knows.) */
      this._items.update((rows) => {
        const idx = rows.findIndex((r) => r.publicUuid === cancelled.publicUuid);
        if (idx < 0) return rows;
        const next = rows.slice();
        next[idx] = cancelled;
        return next;
      });
      return cancelled;
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    }
    finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Misc
  // ===========================================================================

  clearLastCreated(): void {
    this._lastCreated.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  reset(): void {
    this._items.set([]);
    this._pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this._loading.set(false);
    this._saving.set(false);
    this._error.set(null);
    this._lastCreated.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as { message?: unknown; error?: { message?: unknown } };
      if (typeof anyErr.error?.message === 'string') return anyErr.error.message;
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'Ocurrió un error inesperado.';
  }
}

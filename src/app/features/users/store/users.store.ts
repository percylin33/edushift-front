import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UsersApiService } from '../services';
import {
  AssignRolesRequest,
  UpdateUserRequest,
  UserDetail,
  UserListFilters,
  UserListPagination,
  UserRow
} from '../models';

/** Internal pagination state — zero-based to match Spring's contract. */
interface PaginationState {
  /** Zero-based page index. */
  page: number;
  /** Configured page size. */
  size: number;
  /** Total rows across all pages (returned by the backend). */
  totalElements: number;
  /** Total page count (returned by the backend, derived server-side). */
  totalPages: number;
}

/**
 * Reactive façade over {@link UsersApiService} for the
 * {@code features/users} pages. Owns three orthogonal slices of state:
 *
 * <ol>
 *   <li><b>List</b> — items + filters + pagination. Driven by
 *       {@link #loadList} which the list page calls on init and on
 *       every filter / page change.</li>
 *   <li><b>Detail</b> — one selected user fetched by
 *       {@link #loadDetail}. Mutated in place by the write methods so
 *       the detail page can re-render off the same signal without an
 *       explicit refetch.</li>
 *   <li><b>UI flags</b> — {@code loading} / {@code saving} /
 *       {@code error} that pages bind to disable buttons and surface
 *       inline status. Kept separate so a save in the detail page does
 *       not flicker the list spinner.</li>
 * </ol>
 *
 * <p>Pages should never call {@link UsersApiService} directly: routing
 * a write through the store guarantees the list row stays in sync with
 * the detail snapshot and surfaces optimistic updates in one place.
 */
@Injectable({ providedIn: 'root' })
export class UsersStore {
  private readonly api = inject(UsersApiService);

  // -------- list slice --------
  private readonly _items = signal<UserRow[]>([]);
  private readonly _filters = signal<UserListFilters>({});
  private readonly _pagination = signal<PaginationState>({
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0
  });
  private readonly _loading = signal(false);

  // -------- detail slice --------
  private readonly _selected = signal<UserDetail | null>(null);
  private readonly _loadingDetail = signal(false);
  private readonly _saving = signal(false);

  // -------- shared --------
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly error = this._error.asReadonly();

  readonly hasItems = computed(() => this._items().length > 0);
  readonly isEmpty = computed(() => !this._loading() && this._items().length === 0);

  // ===========================================================================
  // List ops
  // ===========================================================================

  /**
   * Apply a new filter set. Resets to page 0 (filtering past page 0
   * almost always shows the wrong slice) and triggers a fetch.
   */
  async applyFilters(filters: UserListFilters): Promise<void> {
    this._filters.set({ ...filters });
    this._pagination.update((p) => ({ ...p, page: 0 }));
    await this.loadList();
  }

  /** Jump to a specific page (zero-based). Clamped client-side at the bounds. */
  async goToPage(page: number): Promise<void> {
    const totalPages = this._pagination().totalPages;
    const clamped = Math.max(0, totalPages > 0 ? Math.min(page, totalPages - 1) : 0);
    this._pagination.update((p) => ({ ...p, page: clamped }));
    await this.loadList();
  }

  /** Change the page size. Resets to page 0. */
  async setPageSize(size: number): Promise<void> {
    this._pagination.update((p) => ({ ...p, size, page: 0 }));
    await this.loadList();
  }

  /**
   * Re-fetch using the current filters + pagination signals. Idempotent
   * to call multiple times in quick succession (the loading flag
   * gates the UI; the latest response wins).
   */
  async loadList(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    const { page, size } = this._pagination();
    const pagination: UserListPagination = { page, size };

    try {
      const result = await firstValueFrom(this.api.list(this._filters(), pagination));
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

  // ===========================================================================
  // Detail ops
  // ===========================================================================

  async loadDetail(publicUuid: string): Promise<UserDetail | null> {
    this._loadingDetail.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(this.api.get(publicUuid));
      this._selected.set(detail);
      return detail;
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._selected.set(null);
      return null;
    }
    finally {
      this._loadingDetail.set(false);
    }
  }

  async update(publicUuid: string, patch: UpdateUserRequest): Promise<UserDetail | null> {
    return this.runMutation(() => this.api.update(publicUuid, patch));
  }

  async assignRoles(publicUuid: string, request: AssignRolesRequest): Promise<UserDetail | null> {
    return this.runMutation(() => this.api.assignRoles(publicUuid, request));
  }

  async disable(publicUuid: string): Promise<UserDetail | null> {
    return this.runMutation(() => this.api.disable(publicUuid));
  }

  async enable(publicUuid: string): Promise<UserDetail | null> {
    return this.runMutation(() => this.api.enable(publicUuid));
  }

  async resetPassword(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.api.resetPassword(publicUuid));
      return true;
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    }
    finally {
      this._saving.set(false);
    }
  }

  /** Clear inline errors without altering data. Useful from "Try again" CTAs. */
  clearError(): void {
    this._error.set(null);
  }

  /** Clear the entire store. Called from feature-level resets (e.g. logout). */
  reset(): void {
    this._items.set([]);
    this._filters.set({});
    this._pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this._loading.set(false);
    this._selected.set(null);
    this._loadingDetail.set(false);
    this._saving.set(false);
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Centralized write pipeline: gate the {@code saving} signal, refresh
   * the selected detail and the list row in place on success, and
   * surface the error message on failure (caller still receives
   * {@code null} so it can branch on the result without try/catch).
   */
  private async runMutation(
    op: () => ReturnType<UsersApiService['update']>
  ): Promise<UserDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(op());
      this._selected.set(updated);
      this.upsertRow(updated);
      return updated;
    }
    catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    }
    finally {
      this._saving.set(false);
    }
  }

  /**
   * Mirror a fresh detail back into the list slice when the user is
   * present, so the table cell repaints without a list refetch. Skips
   * the update if the row hasn't been loaded — list pagination should
   * not show entries that aren't on the current page.
   */
  private upsertRow(detail: UserDetail): void {
    this._items.update((rows) => {
      const idx = rows.findIndex((r) => r.publicUuid === detail.publicUuid);
      if (idx < 0) return rows;
      const next = rows.slice();
      next[idx] = {
        publicUuid: detail.publicUuid,
        email: detail.email,
        firstName: detail.firstName,
        lastName: detail.lastName,
        fullName: detail.fullName,
        status: detail.status,
        roles: detail.roles,
        lastLoginAt: detail.lastLoginAt,
        createdAt: detail.createdAt
      };
      return next;
    });
  }

  /**
   * Best-effort error → string adapter. The error interceptor maps HTTP
   * errors to a structured shape upstream; here we just pull a human
   * message out of either that shape or a plain {@code Error}.
   */
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

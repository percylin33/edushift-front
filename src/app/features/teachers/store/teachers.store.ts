import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TeachersApiService } from '../services';
import {
  CreateTeacherRequest,
  LinkTeacherUserRequest,
  TeacherDetail,
  TeacherInvitationResult,
  TeacherListFilters,
  TeacherListPagination,
  TeacherRow,
  UpdateTeacherRequest,
  computeTeacherFullName,
} from '../models';

interface PaginationState {
  /** Zero-based page index (Spring contract). */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/**
 * Reactive façade sobre {@link TeachersApiService} para
 * {@code features/teachers}.
 *
 * <h3>Slices de estado</h3>
 * <ol>
 *   <li><b>List</b> — items + filtros + pagination, refrescados via
 *       {@link #loadList} en cambios de filtro / página.</li>
 *   <li><b>Detail</b> — un docente seleccionado por
 *       {@link #loadDetail}; mutations (update, delete, linkUser)
 *       mantienen la fila de la lista en sync.</li>
 *   <li><b>Invitation</b> — guarda la última {@code TeacherInvitationResult}
 *       creada para que el modal "Invitación enviada" muestre el
 *       link copiable. {@link #clearLastInvitation} la blanquea.</li>
 * </ol>
 *
 * <p>Las páginas no llaman al API service directo: pasar todo por
 * el store concentra optimistic updates + error mapping y evita
 * que la list quede stale tras edits.</p>
 */
@Injectable({ providedIn: 'root' })
export class TeachersStore {
  private readonly api = inject(TeachersApiService);

  // -------- list slice --------
  private readonly _items = signal<TeacherRow[]>([]);
  private readonly _filters = signal<TeacherListFilters>({});
  private readonly _pagination = signal<PaginationState>({
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  private readonly _loading = signal(false);

  // -------- detail slice --------
  private readonly _selected = signal<TeacherDetail | null>(null);
  private readonly _loadingDetail = signal(false);
  private readonly _saving = signal(false);

  // -------- invite slice --------
  private readonly _lastInvitation = signal<TeacherInvitationResult | null>(null);
  private readonly _inviting = signal(false);

  // -------- shared --------
  private readonly _error = signal<string | null>(null);

  readonly items = this._items.asReadonly();
  readonly filters = this._filters.asReadonly();
  readonly pagination = this._pagination.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly selected = this._selected.asReadonly();
  readonly loadingDetail = this._loadingDetail.asReadonly();
  readonly saving = this._saving.asReadonly();

  readonly lastInvitation = this._lastInvitation.asReadonly();
  readonly inviting = this._inviting.asReadonly();

  readonly error = this._error.asReadonly();

  readonly hasItems = computed(() => this._items().length > 0);
  readonly isEmpty = computed(() => !this._loading() && this._items().length === 0);

  // ===========================================================================
  // List ops
  // ===========================================================================

  async applyFilters(filters: TeacherListFilters): Promise<void> {
    this._filters.set({ ...filters });
    this._pagination.update((p) => ({ ...p, page: 0 }));
    await this.loadList();
  }

  async goToPage(page: number): Promise<void> {
    const totalPages = this._pagination().totalPages;
    const clamped = Math.max(0, totalPages > 0 ? Math.min(page, totalPages - 1) : 0);
    this._pagination.update((p) => ({ ...p, page: clamped }));
    await this.loadList();
  }

  async setPageSize(size: number): Promise<void> {
    this._pagination.update((p) => ({ ...p, size, page: 0 }));
    await this.loadList();
  }

  async loadList(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    const { page, size } = this._pagination();
    const pagination: TeacherListPagination = { page, size };

    try {
      const result = await firstValueFrom(this.api.list(this._filters(), pagination));
      this._items.set(result.content);
      this._pagination.set({
        page: result.number,
        size: result.size,
        totalElements: result.totalElements,
        totalPages: result.totalPages,
      });
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._items.set([]);
    } finally {
      this._loading.set(false);
    }
  }

  // ===========================================================================
  // Detail ops
  // ===========================================================================

  async loadDetail(publicUuid: string): Promise<TeacherDetail | null> {
    this._loadingDetail.set(true);
    this._error.set(null);

    try {
      const detail = await firstValueFrom(this.api.get(publicUuid));
      this._selected.set(detail);
      return detail;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._selected.set(null);
      return null;
    } finally {
      this._loadingDetail.set(false);
    }
  }

  async create(request: CreateTeacherRequest): Promise<TeacherDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const created = await firstValueFrom(this.api.create(request));
      this._selected.set(created);
      this._items.update((rows) => [this.toRow(created), ...rows]);
      return created;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async update(publicUuid: string, patch: UpdateTeacherRequest): Promise<TeacherDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.update(publicUuid, patch));
      this._selected.set(updated);
      this.upsertRow(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  async delete(publicUuid: string): Promise<boolean> {
    this._saving.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(this.api.delete(publicUuid));
      this._items.update((rows) => rows.filter((r) => r.publicUuid !== publicUuid));
      if (this._selected()?.publicUuid === publicUuid) {
        this._selected.set(null);
      }
      return true;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  // ===========================================================================
  // Link-user / invite
  // ===========================================================================

  /**
   * Vincula al docente actualmente seleccionado a un User existente.
   * Refresca el detail y la fila de la lista para que el badge
   * "Sin cuenta" → "Vinculado" se refleje sin recargar la página.
   */
  async linkUser(
    publicUuid: string,
    request: LinkTeacherUserRequest,
  ): Promise<TeacherDetail | null> {
    this._saving.set(true);
    this._error.set(null);

    try {
      const updated = await firstValueFrom(this.api.linkUser(publicUuid, request));
      this._selected.set(updated);
      this.upsertRow(updated);
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Crea una invitación para el docente. Persiste el resultado en
   * {@link #lastInvitation} para que el modal "Invitación enviada"
   * muestre el link copiable. NO actualiza
   * {@code hasUserAccount} aún — eso recién pasa cuando el
   * destinatario acepta la invitación (Sprint 9 hará el side-channel
   * para que la UI lo aprenda automáticamente; por ahora el admin
   * refresca para verlo vinculado).
   */
  async invite(publicUuid: string): Promise<TeacherInvitationResult | null> {
    this._inviting.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(this.api.invite(publicUuid));
      this._lastInvitation.set(result);
      return result;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._inviting.set(false);
    }
  }

  clearLastInvitation(): void {
    this._lastInvitation.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  reset(): void {
    this._items.set([]);
    this._filters.set({});
    this._pagination.set({ page: 0, size: 20, totalElements: 0, totalPages: 0 });
    this._loading.set(false);
    this._selected.set(null);
    this._loadingDetail.set(false);
    this._saving.set(false);
    this._lastInvitation.set(null);
    this._inviting.set(false);
    this._error.set(null);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private upsertRow(detail: TeacherDetail): void {
    this._items.update((rows) => {
      const idx = rows.findIndex((r) => r.publicUuid === detail.publicUuid);
      const next = rows.slice();
      const row = this.toRow(detail);
      if (idx < 0) {
        next.unshift(row);
      } else {
        next[idx] = row;
      }
      return next;
    });
  }

  private toRow(detail: TeacherDetail): TeacherRow {
    return {
      publicUuid: detail.publicUuid,
      documentType: detail.documentType,
      documentNumber: detail.documentNumber,
      firstName: detail.firstName,
      lastName: detail.lastName,
      secondLastName: detail.secondLastName,
      fullName: computeTeacherFullName(detail.firstName, detail.lastName, detail.secondLastName),
      email: detail.email,
      title: detail.title,
      specializations: detail.specializations,
      employmentStatus: detail.employmentStatus,
      hasUserAccount: detail.hasUserAccount,
    };
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const anyErr = err as {
        message?: unknown;
        error?: { message?: unknown };
      };
      if (typeof anyErr.error?.message === 'string') return anyErr.error.message;
      if (typeof anyErr.message === 'string') return anyErr.message;
    }
    return 'Ocurrió un error inesperado.';
  }
}

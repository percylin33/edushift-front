import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AttendanceApiService } from '../services';
import {
  AttendanceRecord,
  AttendanceRecordStatus,
  AttendanceSession,
  AttendanceSessionListItem,
  AttendanceSessionSlot,
  AttendanceSessionStatus,
  CreateSessionRequest,
  ManualCheckInRequest,
  UpdateRecordRequest,
} from '../models';

/**
 * Filter shape for the sessions list (FE-6.2). URL-synced via
 * `?date=YYYY-MM-DD&sectionPublicUuid=…&slot=…&status=…` so a
 * docente can share a filtered link with a peer.
 */
export interface AttendanceSessionListFilters {
  date?: string;
  sectionPublicUuid?: string;
  slot?: AttendanceSessionSlot;
  status?: AttendanceSessionStatus;
}

/**
 * Outcome of a single {@link AttendanceStore.scan} call.
 *
 * <p>Drives the scanner page's feedback chip. We keep it as a
 * discriminated union so the template can switch on `kind` without
 * nullable juggling.
 */
export type ScanOutcome =
  | { kind: 'idle' }
  | { kind: 'ok'; record: AttendanceRecord; idempotent: boolean }
  | { kind: 'invalid'; reason: string }
  | { kind: 'expired'; reason: string }
  | { kind: 'tenant-mismatch' }
  | { kind: 'not-enrolled'; reason: string }
  | { kind: 'no-active-enrollment'; reason: string }
  | { kind: 'session-closed' }
  | { kind: 'network' }
  | { kind: 'unknown'; reason: string };

/**
 * Reactive façade over {@link AttendanceApiService} for the
 * {@code features/attendance} pages.
 *
 * <h3>State slices (FE-6.1)</h3>
 * <ol>
 *   <li><b>Current session</b> — the active {@link AttendanceSession}
 *       the docente is scanning against, set by {@link #openSession} or
 *       {@link #resumeActiveSession}.</li>
 *   <li><b>Records</b> — the roster + scanned records of the current
 *       session, refreshed by {@link #loadRecords}.</li>
 *   <li><b>Scanner</b> — {@link scanning} flag (debounce gate) and
 *       {@link lastScan} outcome for the feedback chip.</li>
 *   <li><b>Errors</b> — last non-scan error (e.g. list failed).</li>
 * </ol>
 *
 * <h3>Debounce / cooldown</h3>
 * The store does NOT own the cooldown; the scanner page reads
 * {@link environment.attendance.scanCooldownMs} and gates the camera
 * callback. The store is a transport façade; rate limiting is a
 * presentation concern (and depends on which scanner engine is in use).
 */
@Injectable({ providedIn: 'root' })
export class AttendanceStore {
  private readonly api = inject(AttendanceApiService);

  // -------- current session slice --------
  private readonly _currentSession = signal<AttendanceSession | null>(null);
  private readonly _loadingSession = signal(false);

  // -------- records slice --------
  private readonly _records = signal<AttendanceRecord[]>([]);
  private readonly _loadingRecords = signal(false);

  // -------- scanner slice --------
  private readonly _scanning = signal(false);
  private readonly _lastScan = signal<ScanOutcome>({ kind: 'idle' });
  /**
   * Daily aggregate of successful scans (camera + manual picker) across
   * every session the auxiliary touched today. Drives the "Escaneados
   * hoy" counter on the scanner page when there is no active session
   * in the store (the typical "auxiliary at the school entrance" flow,
   * where scans land in many sessions auto-resolved by the backend).
   * Keyed by YYYY-MM-DD so the counter rolls over at midnight without
   * needing a reload.
   */
  private readonly _dailyScans = signal<{ date: string; count: number }>({
    date: this.todayKey(),
    count: 0,
  });

  // -------- error slice --------
  private readonly _error = signal<string | null>(null);

  // -------- list slice (FE-6.2 / BE-6.7) --------
  private readonly _listItems = signal<AttendanceSessionListItem[]>([]);
  private readonly _listFilters = signal<AttendanceSessionListFilters>({});
  private readonly _loadingList = signal(false);
  private readonly _listTotalElements = signal(0);
  private readonly _listTotalPages = signal(0);

  // -------- public readonly signals --------
  readonly currentSession = this._currentSession.asReadonly();
  readonly loadingSession = this._loadingSession.asReadonly();
  readonly records = this._records.asReadonly();
  readonly loadingRecords = this._loadingRecords.asReadonly();
  readonly scanning = this._scanning.asReadonly();
  readonly lastScan = this._lastScan.asReadonly();
  readonly error = this._error.asReadonly();
  readonly listItems = this._listItems.asReadonly();
  readonly listFilters = this._listFilters.asReadonly();
  readonly loadingList = this._loadingList.asReadonly();
  readonly listTotalElements = this._listTotalElements.asReadonly();
  readonly listTotalPages = this._listTotalPages.asReadonly();

  readonly hasActiveSession = computed(() => this._currentSession()?.status === 'ACTIVE');
  readonly presentCount = computed(
    () => this._records().filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length,
  );
  readonly absentCount = computed(
    () => this._records().filter((r) => r.status === 'ABSENT').length,
  );
  readonly totalCount = computed(() => this._records().length);
  readonly hasListItems = computed(() => this._listItems().length > 0);
  readonly dailyScanCount = computed(() => this._dailyScans().count);

  // ===========================================================================
  // Sessions
  // ===========================================================================

  /**
   * Open a session (or recover the already-active one — backend is
   * idempotent, returns 200 either way).
   */
  async openSession(request: CreateSessionRequest): Promise<AttendanceSession | null> {
    this._loadingSession.set(true);
    this._error.set(null);
    try {
      const session = await firstValueFrom(this.api.openSession(request));
      this._currentSession.set(session);
      return session;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._loadingSession.set(false);
    }
  }

  async closeCurrentSession(): Promise<AttendanceSession | null> {
    const current = this._currentSession();
    if (!current) return null;
    this._loadingSession.set(true);
    this._error.set(null);
    try {
      const session = await firstValueFrom(this.api.closeSession(current.publicUuid));
      this._currentSession.set(session);
      return session;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    } finally {
      this._loadingSession.set(false);
    }
  }

  reset(): void {
    this._currentSession.set(null);
    this._records.set([]);
    this._lastScan.set({ kind: 'idle' });
    this._error.set(null);
  }

  // ===========================================================================
  // Sessions list (FE-6.2)
  // ===========================================================================

  /**
   * Apply filters to the sessions list. Skips the network call
   * while the underlying list endpoint is missing in the backend
   * (see {@link #acknowledgeListEndpointPending}); the page renders
   * a "BE pendiente" empty state instead.
   */
  async applyListFilters(filters: AttendanceSessionListFilters): Promise<void> {
    this._listFilters.set(filters);
    this._loadingList.set(true);
    this._error.set(null);
    try {
      // Translate the URL-friendly filter shape into the API's
      // snake-case form. `date` is sugar for `from=date&to=date`.
      const from = filters.date;
      const to = filters.date;
      const result = await firstValueFrom(
        this.api.listSessions(
          {
            sectionPublicUuid: filters.sectionPublicUuid,
            from,
            to,
            slot: filters.slot,
            status: filters.status,
          },
          { page: 0, size: 20, sort: 'occurredOn,DESC' },
        ),
      );
      this._listItems.set(result.items);
      this._listTotalElements.set(result.totalElements);
      this._listTotalPages.set(result.totalPages);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      this._listItems.set([]);
    } finally {
      this._loadingList.set(false);
    }
  }

  // ===========================================================================
  // Records
  // ===========================================================================

  async loadRecords(sessionPublicUuid: string): Promise<void> {
    this._loadingRecords.set(true);
    this._error.set(null);
    try {
      const rows = await firstValueFrom(this.api.listRecords(sessionPublicUuid));
      this._records.set(rows);
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
    } finally {
      this._loadingRecords.set(false);
    }
  }

  /**
   * Manual edit (TENANT_ADMIN only server-side). The page that calls
   * this must be wrapped in `roleGuard([TENANT_ADMIN])`.
   */
  async updateRecord(
    recordPublicUuid: string,
    patch: UpdateRecordRequest,
  ): Promise<AttendanceRecord | null> {
    try {
      const updated = await firstValueFrom(this.api.updateRecord(recordPublicUuid, patch));
      this._records.update((rows) =>
        rows.map((r) => (r.publicUuid === updated.publicUuid ? updated : r)),
      );
      return updated;
    } catch (err) {
      this._error.set(this.toErrorMessage(err));
      return null;
    }
  }

  // ===========================================================================
  // Scan flow
  // ===========================================================================

  /**
   * Scan a JWT extracted from a QR code. Caller is responsible for
   * the debounce window (1.5s by default) — see
   * {@link environment.attendance.scanCooldownMs}.
   *
   * <p>Backend error codes (BE-6.4) are mapped to a discriminated
   * union so the feedback chip doesn't have to inspect raw
   * {@code ApiError.code} values. Unknown codes fall through to
   * {@link ScanOutcome.kind: 'unknown'}.
   *
   * <p><b>BE-6.8.b</b> — the QR scan no longer requires a
   * pre-opened session: the backend auto-resolves it from the
   * student's current ACTIVE enrollment (same flow as
   * {@link #manualCheckIn}). This unlocks the "auxiliary at the
   * school entrance" use case where N sections are attended at once.</p>
   */
  async scan(qrToken: string): Promise<ScanOutcome> {
    if (this._scanning()) {
      // Cooldown: another scan is in flight. Return idle so the chip
      // doesn't flicker.
      return { kind: 'idle' };
    }

    this._scanning.set(true);
    try {
      const { record, wasIdempotent } = await firstValueFrom(this.api.scanCheckIn(qrToken));
      // Only update the in-memory roster when the resolved record
      // belongs to the session the scanner page is currently viewing
      // (mirrors the manualCheckIn behaviour for consistency).
      const currentUuid = this._currentSession()?.publicUuid;
      if (currentUuid && record.sessionPublicUuid === currentUuid) {
        this._records.update((rows) => {
          const idx = rows.findIndex((r) => r.publicUuid === record.publicUuid);
          if (idx === -1) return [...rows, record];
          const next = [...rows];
          next[idx] = record;
          return next;
        });
      }
      if (!wasIdempotent) {
        this.incrementDailyScans();
      }
      const outcome: ScanOutcome = { kind: 'ok', record, idempotent: wasIdempotent };
      this._lastScan.set(outcome);
      return outcome;
    } catch (err) {
      const outcome = this.toScanOutcome(err);
      this._lastScan.set(outcome);
      return outcome;
    } finally {
      this._scanning.set(false);
    }
  }

  /**
   * Manual check-in via the search picker fallback (Sprint 6 /
   * FE-6.8). Same {@link ScanOutcome} shape as {@link #scan} so the
   * feedback chip is a single rendering surface for both flows.
   *
   * <p>Differences with {@link #scan}:</p>
   * <ul>
   *   <li>No `qrToken`; the request carries only `studentPublicUuid`
   *       (and optional admin overrides).</li>
   *   <li>No `sessionPublicUuid`; the backend auto-resolves it from
   *       the student's current ACTIVE enrollment.</li>
   *   <li>If the resolved session does not match the one we're
   *       currently viewing, the in-memory roster is not touched —
   *       the record exists in another section's session.</li>
   * </ul>
   */
  async manualCheckIn(studentPublicUuid: string): Promise<ScanOutcome> {
    if (this._scanning()) {
      return { kind: 'idle' };
    }
    this._scanning.set(true);
    const payload: ManualCheckInRequest = { studentPublicUuid };
    try {
      const { record, wasIdempotent } = await firstValueFrom(this.api.manualCheckIn(payload));
      // Only update the in-memory roster when the resolved record
      // belongs to the session the scanner page is currently viewing.
      const currentUuid = this._currentSession()?.publicUuid;
      if (currentUuid && record.sessionPublicUuid === currentUuid) {
        this._records.update((rows) => {
          const idx = rows.findIndex((r) => r.publicUuid === record.publicUuid);
          if (idx === -1) return [...rows, record];
          const next = [...rows];
          next[idx] = record;
          return next;
        });
      }
      if (!wasIdempotent) {
        this.incrementDailyScans();
      }
      const outcome: ScanOutcome = { kind: 'ok', record, idempotent: wasIdempotent };
      this._lastScan.set(outcome);
      return outcome;
    } catch (err) {
      const outcome = this.toScanOutcome(err);
      this._lastScan.set(outcome);
      return outcome;
    } finally {
      this._scanning.set(false);
    }
  }

  /**
   * Reset the feedback chip to {@link ScanOutcome.kind: 'idle'}. The
   * scanner page calls this after the 3-second auto-dismiss timer.
   */
  clearLastScan(): void {
    this._lastScan.set({ kind: 'idle' });
  }

  /**
   * Counts for the dashboard, derived from the in-memory roster.
   * Kept here so a future real-time subscription can push updates
   * without invalidating callers.
   */
  countByStatus(): Record<AttendanceRecordStatus, number> {
    const acc: Record<AttendanceRecordStatus, number> = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      EXCUSED: 0,
    };
    for (const r of this._records()) {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
    }
    return acc;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private toScanOutcome(err: unknown): ScanOutcome {
    const code = (err as { code?: string })?.code;
    const message = (err as { message?: string })?.message ?? '';
    switch (code) {
      case 'QR_INVALID':
        return { kind: 'invalid', reason: message || 'QR inválido' };
      case 'QR_EXPIRED':
        return { kind: 'expired', reason: message || 'Credencial revocada' };
      case 'QR_TENANT_MISMATCH':
        return { kind: 'tenant-mismatch' };
      case 'STUDENT_NOT_ENROLLED':
        return { kind: 'not-enrolled', reason: message || 'Alumno no matriculado' };
      case 'STUDENT_NO_ACTIVE_ENROLLMENT':
        return {
          kind: 'no-active-enrollment',
          reason: message || 'El alumno no tiene matrícula activa',
        };
      case 'SESSION_CLOSED':
      case 'SESSION_ALREADY_CLOSED':
        return { kind: 'session-closed' };
      case 'NETWORK_ERROR':
        return { kind: 'network' };
      default:
        return { kind: 'unknown', reason: message || 'Error desconocido' };
    }
  }

  private toErrorMessage(err: unknown): string {
    if (typeof err === 'string') return err;
    const message = (err as { message?: string })?.message;
    return message ?? 'Error inesperado';
  }

  /**
   * Increment the daily aggregate counter. Rolls over to a fresh
   * bucket when crossing midnight so an auxiliary who left the
   * scanner open overnight sees a clean count next morning.
   */
  private incrementDailyScans(): void {
    const today = this.todayKey();
    this._dailyScans.update((prev) =>
      prev.date === today ? { date: today, count: prev.count + 1 } : { date: today, count: 1 },
    );
  }

  private todayKey(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}

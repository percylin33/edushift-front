import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BarcodeFormat } from '@zxing/library';
import { ZXingScannerModule, ZXingScannerComponent } from '@zxing/ngx-scanner';
import { environment } from '@env/environment';
import { IconName } from '@shared/components/icon/icons.registry';
import { IconComponent, PageContainerComponent, PageHeaderComponent } from '@shared/components';
import { StudentSearchPickerComponent } from '../../components/student-search-picker.component';
import { AttendanceStudentLookupItem } from '../../models';
import { AttendanceStore } from '../../store';
import { ScanOutcome } from '../../store/attendance.store';

const STORE_KEY_CAMERA_DEVICE_ID = 'edushift_scanner_deviceId';

/**
 * Camera state machine (FE-6.1).
 *
 * <h3>Why a discriminated union</h3>
 * The scanner goes through four states, each with its own render:
 * {@code unknown} (we haven't asked yet) → {@code probing}
 * (we're calling {@code navigator.permissions.query}) → either
 * {@code granted} or {@code denied}. Template wires the right CTA
 * per state.
 */
type CameraState =
  | { kind: 'unknown' }
  | { kind: 'probing' }
  | { kind: 'unsupported' }
  | { kind: 'denied' }
  | { kind: 'granted' };

/**
 * Scanner surface for the docente (FE-6.1).
 *
 * <h3>Scope of this PR</h3>
 * This component covers everything <em>around</em> the camera:
 * <ul>
 *   <li>Permission guard via {@code navigator.permissions.query}.</li>
 *   <li>Offline banner (driven by {@code navigator.onLine}).</li>
 *   <li>Manual student picker fallback (FE-6.8) for the "auxiliary
 *       at the entrance without QR card" flow — replaces the legacy
 *       "paste JWT" input. Drives
 *       {@link AttendanceStore#manualCheckIn} which auto-resolves
 *       the target session from the student's ACTIVE enrollment.</li>
 *   <li>1.5s debounce between successful scans (shared with the
 *       manual picker — one mark every 1.5s, regardless of source).</li>
 *   <li>Feedback chip wired to {@link ScanOutcome} (3s auto-dismiss).</li>
 *   <li>Live counters (present / total) for the docente's
 *       situational awareness.</li>
 * </ul>
 *
 * <h3>Camera engine — TODO(FE-6.1+)</h3>
 * The actual camera binding is intentionally not wired here yet. The
 * sprint plan calls for {@code @zxing/ngx-scanner} (default) or
 * {@code html5-qrcode} (fallback) selected via
 * {@code environment.attendance.scannerEngine}. Adding either
 * dependency is a package.json change that we want to land in a
 * dedicated PR (FE-6.1.I in the kanban) so the bundle impact is
 * isolated. The component is structured so the engine hook is a
 * single method override:
 * <pre>
 *   protected onCameraToken(token: string) { this.handleScan(token); }
 * </pre>
 * Whichever engine we pick will call that method on a successful
 * decode.
 *
 * <h3>UX rationale</h3>
 * The scanner page is intentionally a single-screen experience
 * optimized for one-handed phone use: camera viewport full-bleed
 * on mobile, sticky counters at the bottom, the feedback chip
 * floats above the viewport so the docente can keep scanning without
 * looking away from the room.
 */
@Component({
  selector: 'app-attendance-scanner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ZXingScannerModule,
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent,
    StudentSearchPickerComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Escanear asistencia"
        subtitle="Apunta la cámara al QR del alumno para registrar su asistencia."
      >
        <a routerLink="/attendance" class="btn btn-ghost btn-sm">
          <app-icon name="arrow-left" [size]="16" />
          <span class="hidden sm:inline">Volver</span>
        </a>
      </app-page-header>

      <!-- Offline banner -->
      @if (isOffline()) {
        <div
          class="alert alert-warning mb-4 flex items-center gap-2"
          role="status"
          aria-live="polite"
        >
          <app-icon name="alert-circle" [size]="20" />
          <span>{{ offlineCopy }}</span>
        </div>
      }

      <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
        <!-- Camera viewport / permission CTA / manual fallback -->
        <div class="card">
          <div class="card-body">
            @switch (cameraState().kind) {
              @case ('granted') {
                <div
                  class="aspect-video w-full overflow-hidden rounded-lg bg-slate-900"
                  data-testid="scanner-viewport"
                >
                  <zxing-scanner
                    #scanner
                    class="block h-full w-full"
                    [enable]="!isOffline()"
                    [autostart]="true"
                    [formats]="qrFormats"
                    [tryHarder]="false"
                    [videoConstraints]="effectiveVideoConstraints"
                    (camerasFound)="onCamerasFound($event)"
                    (scanSuccess)="handleScan($event)"
                    (scanError)="onCameraError($event)"
                    (permissionResponse)="onPermissionResponse($event)"
                  />
                </div>
                <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p class="text-xs text-slate-500">
                    Apunta la cámara al QR del alumno. Si no trae credencial, búscalo por nombre
                    debajo.
                  </p>
                  <div class="flex items-center gap-2">
                    @if (devices().length > 1) {
                      <select
                        class="select select-xs max-w-[160px]"
                        [ngModel]="selectedDeviceId()"
                        (ngModelChange)="onDeviceChange($event)"
                        aria-label="Cámara"
                      >
                        @for (d of devices(); track d.deviceId) {
                          <option [value]="d.deviceId">{{ d.label || 'Cámara ' + $index }}</option>
                        }
                      </select>
                    }
                    @if (torchSupported()) {
                      <button
                        type="button"
                        class="btn btn-ghost btn-icon btn-xs"
                        [class.text-yellow-500]="torchEnabled()"
                        aria-label="Linterna"
                        (click)="toggleTorch()"
                      >
                        <app-icon name="sun" [size]="16" />
                      </button>
                    }
                  </div>
                </div>
              }
              @case ('denied') {
                <div class="flex flex-col items-center px-4 py-8 text-center">
                  <app-icon name="eye-off" [size]="48" class="text-error" />
                  <h3 class="mt-3 font-semibold">Cámara bloqueada</h3>
                  <p class="mt-1 max-w-md text-sm text-slate-600">
                    El navegador no nos dio permiso para usar la cámara. Podés seguir marcando
                    asistencia <strong>buscando al alumno por nombre debajo</strong>, o reactivar la
                    cámara siguiendo los pasos según tu navegador.
                  </p>

                  <div class="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      (click)="retryCameraPermission()"
                    >
                      <app-icon name="rotate-cw" [size]="14" />
                      Reintentar permiso
                    </button>
                  </div>

                  <details class="mt-4 w-full max-w-md text-left text-sm">
                    <summary class="cursor-pointer font-medium text-slate-700">
                      ¿Cómo habilito la cámara?
                    </summary>
                    <div class="mt-2 space-y-3 text-slate-600">
                      <div>
                        <p class="font-medium">En Edge / Chrome móvil:</p>
                        <ol class="mt-1 list-decimal space-y-0.5 pl-5">
                          <li>Tocá el candado o los tres puntos junto a la URL.</li>
                          <li>Entrá a <em>Configuración del sitio</em> (o <em>Permisos</em>).</li>
                          <li>Activá <em>Cámara</em>.</li>
                          <li>Volvé acá y tocá <em>Reintentar permiso</em>.</li>
                        </ol>
                      </div>
                      <div>
                        <p class="font-medium">En Chrome / Edge escritorio:</p>
                        <ol class="mt-1 list-decimal space-y-0.5 pl-5">
                          <li>Hacé clic en el candado de la URL.</li>
                          <li>Cambiá <em>Cámara</em> a <em>Permitir</em>.</li>
                          <li>Volvé acá y tocá <em>Reintentar permiso</em>.</li>
                        </ol>
                      </div>
                    </div>
                  </details>
                </div>
              }
              @case ('unsupported') {
                <div class="flex flex-col items-center py-8 text-center">
                  <app-icon name="alert-circle" [size]="48" class="text-warning" />
                  <h3 class="mt-3 font-semibold">Tu navegador no soporta scanner</h3>
                  <p class="mt-1 max-w-md text-sm text-slate-600">
                    Usa el buscador manual debajo para registrar la asistencia.
                  </p>
                </div>
              }
              @case ('probing') {
                <div class="flex items-center justify-center gap-2 py-8 text-slate-500">
                  <span class="loading loading-spinner loading-sm"></span>
                  <span>Verificando permisos de cámara…</span>
                </div>
              }
              @default {
                <div class="flex flex-col items-center py-8 text-center">
                  <app-icon name="target" [size]="48" class="text-slate-400" />
                  <button type="button" class="btn btn-primary btn-sm mt-4" (click)="probeCamera()">
                    Permitir cámara
                  </button>
                </div>
              }
            }

            <!-- Manual fallback: global student picker (FE-6.8) -->
            <section
              class="mt-4 border-t pt-4"
              aria-label="Búsqueda manual de alumno"
              data-testid="manual-fallback"
            >
              <div class="mb-2 flex items-center gap-2">
                <app-icon name="search" [size]="16" class="text-slate-500" />
                <h3 class="text-sm font-semibold">Sin agenda QR — buscar alumno por nombre</h3>
              </div>
              <p class="mb-3 text-xs text-slate-500">
                Útil cuando el alumno no trae su credencial. El sistema asigna el check-in a su
                sección actual automáticamente.
              </p>
              <app-student-search-picker (selected)="onStudentSelected($event)" />
              @if (isOffline()) {
                <p class="mt-2 text-xs text-warning">
                  Sin conexión: el buscador no puede consultar el servidor.
                </p>
              }
            </section>
          </div>
        </div>

        <!-- Right column: counters + active session -->
        <aside class="flex flex-col gap-4">
          <div class="card">
            <div class="card-body">
              <h3 class="card-title text-base">Sesión actual</h3>
              @if (store.currentSession(); as session) {
                <dl class="space-y-1 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-slate-500">Sección</dt>
                    <dd class="font-medium">
                      {{ session.sectionName ?? '—' }}
                    </dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-slate-500">Slot</dt>
                    <dd class="font-medium">{{ session.slot }}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-slate-500">Estado</dt>
                    <dd>
                      <span
                        class="badge"
                        [class.badge-success]="session.status === 'ACTIVE'"
                        [class.badge-neutral]="session.status === 'CLOSED'"
                      >
                        {{ session.status }}
                      </span>
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm mt-3 w-full"
                  [disabled]="session.status === 'CLOSED' || store.loadingSession()"
                  (click)="onCloseSession()"
                >
                  Cerrar sesión
                </button>
              } @else {
                <p class="text-sm text-slate-500">
                  No hay sesión activa. El backend la abrirá en el próximo check-in (idempotente).
                </p>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              @if (store.hasActiveSession()) {
                <h3 class="card-title text-base">Progreso</h3>
                <div class="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p class="text-2xl font-semibold text-success">
                      {{ store.presentCount() }}
                    </p>
                    <p class="text-xs text-slate-500">Presentes</p>
                  </div>
                  <div>
                    <p class="text-error text-2xl font-semibold">
                      {{ store.absentCount() }}
                    </p>
                    <p class="text-xs text-slate-500">Ausentes</p>
                  </div>
                  <div>
                    <p class="text-2xl font-semibold">{{ store.totalCount() }}</p>
                    <p class="text-xs text-slate-500">Total</p>
                  </div>
                </div>
              } @else {
                <h3 class="card-title text-base">Escaneados hoy</h3>
                <div class="text-center">
                  <p class="text-4xl font-bold text-primary">
                    {{ store.dailyScanCount() }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">
                    Alumnos registrados (entrada / múltiples secciones)
                  </p>
                </div>
              }
            </div>
          </div>
        </aside>
      </div>

      <!-- Feedback chip - bottom-anchored toast that does NOT cover
        the camera viewport. Critical for the auxiliary at the school
        entrance who needs to scan back-to-back: a full-screen overlay
        would force them to wait several seconds before pointing at the
        next QR. Auto-dismisses after feedbackDismissMs (default 1.2s)
        so the next scan can start immediately when the response arrives. -->
      @if (feedback(); as fb) {
        <div
          class="scan-feedback-chip pointer-events-none fixed inset-x-0 bottom-4 z-[9999] flex justify-center px-4 sm:bottom-6"
          role="status"
          aria-live="assertive"
          data-testid="scan-feedback"
        >
          <div
            class="alert pointer-events-auto w-full max-w-md cursor-pointer shadow-lg"
            [class.alert-success]="fb.tone === 'ok'"
            [class.alert-info]="fb.tone === 'info'"
            [class.alert-warning]="fb.tone === 'warn'"
            [class.alert-error]="fb.tone === 'error'"
            (click)="dismissFeedback()"
          >
            <app-icon [name]="fb.icon" [size]="32" />
            <div class="flex flex-col">
              <span class="text-lg font-bold uppercase leading-tight">{{ fb.title }}</span>
              @if (fb.subtitle) {
                <span class="text-sm opacity-90">{{ fb.subtitle }}</span>
              }
            </div>
          </div>
        </div>
      }
    </app-page-container>
  `,
  styles: [
    '.scan-feedback-chip { animation: scanFeedbackSlide 180ms ease-out; }',
    '@keyframes scanFeedbackSlide { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }',
  ],
})
export class AttendanceScannerPageComponent implements OnInit, OnDestroy {
  protected readonly store = inject(AttendanceStore);
  protected readonly environment = environment;
  private readonly elementRef = inject(ElementRef);

  /** Reference to the zxing-scanner for device enumeration. */
  private readonly scannerRef = viewChild<ZXingScannerComponent>('scanner');

  /** Current camera state (drives the viewport + CTA). */
  protected readonly cameraState = signal<CameraState>({ kind: 'unknown' });
  /** Online state. */
  protected readonly isOffline = signal(!navigator.onLine);
  /** Current feedback chip payload (or null). */
  protected readonly feedback = signal<FeedbackChip | null>(null);
  /** Available video input devices. */
  protected readonly devices = signal<MediaDeviceInfo[]>([]);
  /** Whether torch is currently enabled. */
  protected readonly torchEnabled = signal(false);
  /** Whether torch is supported on the active camera. */
  protected readonly torchSupported = signal(false);

  protected readonly offlineCopy = environment.attendance.offlineBannerCopy;

  /**
   * Decodable formats for the camera engine. We restrict to QR_CODE on
   * purpose: the docente's classroom may have stickers, ID barcodes,
   * etc. that ZXing would otherwise try to decode and waste CPU on.
   */
  protected readonly qrFormats = [BarcodeFormat.QR_CODE];

  /**
   * Camera constraints applied to {@code getUserMedia} via zxing-scanner.
   * Forcing {@code facingMode: environment} avoids opening the front
   * camera on phones where the back is preferred; the 1280x720 hint
   * gives ZXing enough resolution to decode small QRs without paying
   * for 4K frames that would just waste CPU on each decode attempt.
   */
  protected readonly videoConstraints: MediaTrackConstraints = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };

  /** Cooldown timer for manual scans. */
  private lastScanAt = 0;
  /**
   * Last camera-error toast at this timestamp. Used to throttle the
   * feedback chip so a steady stream of "no QR in frame" frames from
   * ZXing doesn't spam the docente.
   */
  private lastCameraErrorAt = 0;
  /** Auto-dismiss timer for the feedback chip. */
  private dismissHandle: ReturnType<typeof setTimeout> | null = null;
  /**
   * Lazy-initialised AudioContext shared across every beep so we
   * don't pay for context allocation + audio graph wiring on every
   * scan (50-200ms on iOS Safari and a quota cap of ~6 contexts
   * per page).
   */
  private audioCtx: AudioContext | null = null;
  /** Listeners we install on bootstrap (cleaned up in ngOnDestroy). */
  private readonly onlineListener = (): void => this.isOffline.set(false);
  private readonly offlineListener = (): void => this.isOffline.set(true);

  ngOnInit(): void {
    window.addEventListener('online', this.onlineListener);
    window.addEventListener('offline', this.offlineListener);
    this.probeCamera();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineListener);
    window.removeEventListener('offline', this.offlineListener);
    if (this.dismissHandle) {
      clearTimeout(this.dismissHandle);
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => undefined);
      this.audioCtx = null;
    }
  }

  /**
   * Resolve the camera permission state and react to it. Uses the
   * modern Permissions API when available and gracefully falls back
   * to "ask on demand" on browsers that don't expose it.
   */
  protected probeCamera(): void {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      this.cameraState.set({ kind: 'unsupported' });
      return;
    }
    if (typeof navigator.permissions?.query === 'function') {
      this.cameraState.set({ kind: 'probing' });
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((status) => {
          this.cameraState.set(
            status.state === 'granted' || status.state === 'prompt'
              ? { kind: 'granted' }
              : { kind: 'denied' },
          );
        })
        .catch(() => this.cameraState.set({ kind: 'granted' }));
    } else {
      this.cameraState.set({ kind: 'granted' });
    }
  }

  /**
   * Retry path for the "Cámara bloqueada" CTA.
   *
   * <p>Mobile browsers don't expose a JS API to re-trigger the native
   * permission prompt once the site has been hard-denied — the user
   * must flip the toggle inside Site settings. This method covers
   * both cases:</p>
   *
   * <ul>
   *   <li><b>Soft-denied / first visit:</b> {@code getUserMedia} surfaces
   *       the native prompt; we transition to {@code granted} on success
   *       and close the test track immediately so {@code zxing-scanner}
   *       can take ownership of the camera afterwards.</li>
   *   <li><b>Hard-denied:</b> {@code getUserMedia} rejects with
   *       {@code NotAllowedError}; we stay on {@code denied} and surface
   *       a toast pointing at the instructions panel.</li>
   * </ul>
   *
   * <p>Always falls back to {@link #probeCamera} when {@code getUserMedia}
   * isn't available (very old browsers or insecure context).</p>
   */
  protected async retryCameraPermission(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.probeCamera();
      return;
    }
    this.cameraState.set({ kind: 'probing' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      stream.getTracks().forEach((track) => track.stop());
      this.cameraState.set({ kind: 'granted' });
    } catch (err) {
      this.cameraState.set({ kind: 'denied' });
      const name = (err as { name?: string } | null)?.name ?? '';
      const stillBlocked = name === 'NotAllowedError' || name === 'SecurityError';
      this.feedback.set({
        tone: 'warn',
        icon: 'alert-circle',
        title: stillBlocked ? 'Permiso aún bloqueado' : 'No pudimos acceder a la cámara',
        subtitle: stillBlocked
          ? 'Habilítalo en la configuración del navegador y vuelve a reintentar.'
          : 'Verificá que ninguna otra app esté usando la cámara.',
      });
      if (this.dismissHandle) clearTimeout(this.dismissHandle);
      this.dismissHandle = setTimeout(
        () => this.feedback.set(null),
        this.environment.attendance.feedbackDismissMs,
      );
    }
  }

  protected onCloseSession(): void {
    void this.store.closeCurrentSession();
  }

  /**
   * Manual fallback hook (FE-6.8). Fires when the auxiliary picks a
   * student from {@link StudentSearchPickerComponent}. Shares the
   * same 1.5s cooldown as the camera path so consecutive
   * "tap-and-confirm" presses don't double-mark the same kid.
   */
  protected async onStudentSelected(item: AttendanceStudentLookupItem): Promise<void> {
    const now = Date.now();
    if (now - this.lastScanAt < this.environment.attendance.scanCooldownMs) {
      return;
    }
    this.lastScanAt = now;
    if (this.isOffline()) {
      this.feedback.set({
        tone: 'warn',
        icon: 'alert-circle',
        title: 'Sin conexión',
        subtitle: 'Reintenta cuando vuelvas a tener internet.',
      });
      return;
    }
    const outcome = await this.store.manualCheckIn(item.studentPublicUuid);
    this.showFeedback(outcome, item);
  }

  /**
   * Single entry-point for the camera engine. Enforces cooldown,
   * dispatches to the store, and surfaces a feedback chip. Routed
   * through the same {@link #showFeedback} pipeline as the manual
   * fallback so the UX is uniform.
   */
  protected async handleScan(token: string): Promise<void> {
    const now = Date.now();
    if (now - this.lastScanAt < this.environment.attendance.scanCooldownMs) {
      return;
    }
    this.lastScanAt = now;
    const outcome = await this.store.scan(token);
    this.showFeedback(outcome);
  }

  /**
   * Camera engine error sink. ZXing emits {@code NotFoundException} on
   * every frame without a decodable QR, which is most frames; we
   * silently swallow those. Real failures (camera disconnect,
   * permission revoked mid-session) get a throttled chip so the
   * docente knows to retry without a flood of toasts.
   */
  protected onCameraError(err: unknown): void {
    if (this.isBenignDecodeMiss(err)) return;
    const now = Date.now();
    if (now - this.lastCameraErrorAt < CAMERA_ERROR_THROTTLE_MS) return;
    this.lastCameraErrorAt = now;
    this.feedback.set({
      tone: 'warn',
      icon: 'alert-circle',
      title: 'Cámara con problemas',
      subtitle: 'Reintenta apuntando al QR o usa el campo manual.',
    });
    if (this.dismissHandle) clearTimeout(this.dismissHandle);
    this.dismissHandle = setTimeout(
      () => this.feedback.set(null),
      this.environment.attendance.feedbackDismissMs,
    );
  }

  /**
   * Hook for {@code <zxing-scanner>}'s {@code permissionResponse}.
   * If the user blocks the permission inside the live prompt (state
   * went from {@code prompt} to {@code denied} while we already showed
   * the granted UI), reflect it in the state machine so the template
   * swaps to the "Cámara bloqueada" CTA.
   */
  protected onPermissionResponse(granted: boolean): void {
    if (!granted) {
      this.cameraState.set({ kind: 'denied' });
    }
  }

  /**
   * ZXing wraps decode misses as {@code NotFoundException} (or its
   * library-specific subclasses); we don't have a direct enum, so we
   * detect the well-known shapes by name. Anything else bubbles up as
   * a real error.
   */
  private isBenignDecodeMiss(err: unknown): boolean {
    if (!err || typeof err !== 'object') return true;
    const name = (err as { name?: string }).name ?? '';
    return (
      name === 'NotFoundException' ||
      name === 'NotFoundException2' ||
      name === 'ChecksumException' ||
      name === 'FormatException'
    );
  }

  private showFeedback(outcome: ScanOutcome, pickedStudent?: AttendanceStudentLookupItem): void {
    const chip = this.toChip(outcome, pickedStudent);
    if (!chip) return;
    this.feedback.set(chip);
    this.cueScannerFeedback(chip.tone);
    if (this.dismissHandle) clearTimeout(this.dismissHandle);
    // Respect the environment value directly: the chip lives at the
    // bottom of the viewport and does not block the camera, so a
    // short window (1.2s by default) is enough to register the
    // outcome without forcing the auxiliary to wait between scans.
    this.dismissHandle = setTimeout(() => {
      this.feedback.set(null);
      this.store.clearLastScan();
    }, this.environment.attendance.feedbackDismissMs);
  }

  /** Manual early dismiss for the full-screen feedback overlay. */
  protected dismissFeedback(): void {
    if (this.dismissHandle) {
      clearTimeout(this.dismissHandle);
      this.dismissHandle = null;
    }
    this.feedback.set(null);
    this.store.clearLastScan();
  }

  /**
   * Multi-sense confirmation cue: short haptic vibration + Web Audio
   * "beep". Helps the auxiliary know the scan landed without looking
   * at the screen — they can keep their eyes on the next student.
   * Both sub-cues are best-effort: Safari/iOS still ignore vibrate()
   * and AudioContext may be blocked until the first user gesture.
   */
  private cueScannerFeedback(tone: FeedbackChip['tone']): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(tone === 'ok' ? 80 : [60, 40, 60]);
      }
    } catch {
      // Safari throws on vibrate(); ignore.
    }
    try {
      const frequency = tone === 'ok' ? 880 : tone === 'error' ? 220 : 440;
      this.playBeep(frequency, 140);
    } catch {
      // AudioContext disabled (e.g. user hasn't tapped yet); ignore.
    }
  }

  /**
   * Play a short beep through a single, lazily-instantiated
   * AudioContext. We create the context on the first call (which is
   * always inside a user gesture: the scanner reads the QR after the
   * user pointed the camera) and reuse it for every subsequent beep.
   * Each beep allocates only a fresh oscillator+gain pair, which is
   * cheap, instead of a brand-new context (50-200ms in iOS Safari).
   */
  private playBeep(frequency: number, durationMs: number): void {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(now + durationMs / 1000);
    oscillator.onended = (): void => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  private ensureAudioContext(): AudioContext | null {
    if (this.audioCtx) return this.audioCtx;
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.audioCtx = new Ctor();
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  /**
   * Map a {@link ScanOutcome} to a visual feedback chip. Keeping the
   * mapping in the component (vs. the store) lets the store stay
   * UI-agnostic and lets us evolve the copy without touching the
   * transport layer.
   *
   * <p>When the outcome originates from the manual picker (FE-6.8),
   * {@code pickedStudent} carries the row the auxiliary tapped — we
   * use it to enrich the chip subtitle even when the backend reply
   * lacks a {@code studentFullName} (idempotent path).</p>
   */
  private toChip(
    outcome: ScanOutcome,
    pickedStudent?: AttendanceStudentLookupItem,
  ): FeedbackChip | null {
    const subtitleName =
      pickedStudent?.fullName ??
      (outcome.kind === 'ok' ? outcome.record.studentFullName : undefined);
    switch (outcome.kind) {
      case 'idle':
        return null;
      case 'ok':
        return outcome.idempotent
          ? {
              tone: 'info',
              icon: 'info',
              title: 'Ya marcado',
              subtitle: subtitleName
                ? `${subtitleName} • ${formatTime(outcome.record.occurredAt)}`
                : `Marcado a las ${formatTime(outcome.record.occurredAt)}`,
            }
          : {
              tone: 'ok',
              icon: 'check',
              title: 'PRESENTE',
              subtitle: subtitleName ?? 'Alumno registrado correctamente',
            };
      case 'invalid':
        return {
          tone: 'error',
          icon: 'alert-circle',
          title: 'QR inválido',
          subtitle: outcome.reason,
        };
      case 'expired':
        return {
          tone: 'error',
          icon: 'lock',
          title: 'Credencial revocada',
          subtitle: outcome.reason,
        };
      case 'tenant-mismatch':
        return {
          tone: 'error',
          icon: 'lock',
          title: 'QR de otro colegio',
          subtitle: 'Pídele al alumno su credencial actual.',
        };
      case 'not-enrolled':
        return {
          tone: 'warn',
          icon: 'users',
          title: 'No matriculado',
          subtitle: outcome.reason,
        };
      case 'no-active-enrollment':
        return {
          tone: 'warn',
          icon: 'users',
          title: 'Sin matrícula activa',
          subtitle: pickedStudent
            ? `${pickedStudent.fullName} no tiene sección asignada hoy.`
            : outcome.reason,
        };
      case 'session-closed':
        return {
          tone: 'warn',
          icon: 'lock',
          title: 'Sesión cerrada',
          subtitle: 'Abre una nueva sesión para seguir escaneando.',
        };
      case 'network':
        return {
          tone: 'error',
          icon: 'alert-circle',
          title: 'Sin conexión',
          subtitle: 'Reintenta cuando vuelvas a tener internet.',
        };
      case 'unknown':
        return { tone: 'error', icon: 'alert-circle', title: 'Error', subtitle: outcome.reason };
    }
  }

  /* ───── DEBT-ATT-PERF-6: Torch + deviceId persistence ───── */

  /** Persisted deviceId from localStorage, or null. */
  private readonly savedDeviceId = signal<string | null>(
    (() => {
      try {
        return localStorage.getItem(STORE_KEY_CAMERA_DEVICE_ID);
      } catch {
        return null;
      }
    })(),
  );

  /** Active deviceId used in video constraints. */
  protected readonly selectedDeviceId = signal<string | null>(this.savedDeviceId());

  /** Full video constraints including persisted deviceId. */
  protected get effectiveVideoConstraints(): MediaTrackConstraints {
    const devId = this.selectedDeviceId();
    return devId ? { ...this.videoConstraints, deviceId: { exact: devId } } : this.videoConstraints;
  }

  protected async onCamerasFound(devices: MediaDeviceInfo[]): Promise<void> {
    this.devices.set(devices);
    const saved = this.savedDeviceId();
    if (saved && devices.some((d) => d.deviceId === saved)) {
      this.selectedDeviceId.set(saved);
    }
    await this.checkTorchSupport();
  }

  protected async onDeviceChange(deviceId: string): Promise<void> {
    this.selectedDeviceId.set(deviceId);
    this.torchEnabled.set(false);
    try {
      localStorage.setItem(STORE_KEY_CAMERA_DEVICE_ID, deviceId);
    } catch {
      /* localStorage not available — ignore */
    }
    await this.checkTorchSupport();
  }

  protected async toggleTorch(): Promise<void> {
    const next = !this.torchEnabled();
    try {
      const video = this.elementRef.nativeElement.querySelector('video');
      if (!video || !video.srcObject) {
        this.torchEnabled.set(false);
        return;
      }
      const track = (video.srcObject as MediaStream).getVideoTracks()[0];
      if (!track || !track.applyConstraints) {
        this.torchEnabled.set(false);
        return;
      }
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      this.torchEnabled.set(next);
    } catch {
      this.torchEnabled.set(false);
      this.torchSupported.set(false);
    }
  }

  private async checkTorchSupport(): Promise<void> {
    try {
      const video = this.elementRef.nativeElement.querySelector('video');
      if (!video || !video.srcObject) {
        this.torchSupported.set(false);
        return;
      }
      const track = (video.srcObject as MediaStream).getVideoTracks()[0];
      if (!track || !track.applyConstraints) {
        this.torchSupported.set(false);
        return;
      }
      const capabilities = track.getCapabilities?.();
      const supported = capabilities ? (capabilities as Record<string, unknown>)['torch'] === true : false;
      this.torchSupported.set(supported);
    } catch {
      this.torchSupported.set(false);
    }
  }
}

interface FeedbackChip {
  tone: 'ok' | 'info' | 'warn' | 'error';
  icon: IconName;
  title: string;
  subtitle?: string;
}

/**
 * Min interval between camera-error toasts. ZXing reports NotFound
 * on every miss frame; without throttling we'd render a chip storm.
 */
const CAMERA_ERROR_THROTTLE_MS = 5000;

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '@env/environment';
import { IconName } from '@shared/components/icon/icons.registry';
import {
  IconComponent,
  PageContainerComponent,
  PageHeaderComponent
} from '@shared/components';
import { AttendanceStore } from '../../store';
import { ScanOutcome } from '../../store/attendance.store';

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
 *   <li>Manual JWT fallback for browsers without
 *       {@code navigator.mediaDevices} (paste-and-Enter).</li>
 *   <li>1.5s debounce between successful scans.</li>
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
    PageContainerComponent,
    PageHeaderComponent,
    IconComponent
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
                <!--
                  Real engine hooks here. Until then, the manual
                  fallback below is the source of truth.
                -->
                <div
                  class="aspect-video w-full rounded-lg bg-slate-900 text-slate-100 flex flex-col items-center justify-center text-center px-4"
                  data-testid="scanner-viewport"
                >
                  <app-icon name="target" [size]="48" />
                  <p class="mt-2 text-sm opacity-80">
                    Cámara activa (motor pendiente de wiring — usa el
                    fallback manual debajo).
                  </p>
                </div>
                <p class="mt-3 text-xs text-slate-500">
                  Tip: pega el JWT del QR en el cuadro de abajo mientras
                  conectamos el motor de cámara.
                </p>
              }
              @case ('denied') {
                <div class="flex flex-col items-center text-center py-8">
                  <app-icon name="eye-off" [size]="48" class="text-error" />
                  <h3 class="mt-3 font-semibold">Cámara bloqueada</h3>
                  <p class="mt-1 text-sm text-slate-600 max-w-md">
                    Habilita los permisos de cámara en la configuración de tu
                    navegador y recarga la página.
                  </p>
                  <a
                    class="btn btn-primary btn-sm mt-4"
                    href="chrome://settings/content/camera"
                    target="_blank"
                    rel="noopener"
                  >
                    Abrir configuración
                  </a>
                </div>
              }
              @case ('unsupported') {
                <div class="flex flex-col items-center text-center py-8">
                  <app-icon name="alert-circle" [size]="48" class="text-warning" />
                  <h3 class="mt-3 font-semibold">Tu navegador no soporta scanner</h3>
                  <p class="mt-1 text-sm text-slate-600 max-w-md">
                    Pega el JWT debajo para registrar la asistencia manualmente.
                  </p>
                </div>
              }
              @case ('probing') {
                <div class="flex items-center gap-2 text-slate-500 py-8 justify-center">
                  <span class="loading loading-spinner loading-sm"></span>
                  <span>Verificando permisos de cámara…</span>
                </div>
              }
              @default {
                <div class="flex flex-col items-center text-center py-8">
                  <app-icon name="target" [size]="48" class="text-slate-400" />
                  <button
                    type="button"
                    class="btn btn-primary btn-sm mt-4"
                    (click)="probeCamera()"
                  >
                    Permitir cámara
                  </button>
                </div>
              }
            }

            <!-- Manual fallback (always available) -->
            <form
              class="mt-4 flex flex-col gap-2 sm:flex-row"
              (ngSubmit)="submitManual()"
              data-testid="manual-fallback"
            >
              <input
                type="text"
                class="input input-bordered flex-1 text-xs"
                placeholder="Pega aquí el JWT del QR (eyJhbGciOi…)"
                [(ngModel)]="manualToken"
                name="manualToken"
                autocomplete="off"
                [disabled]="isOffline()"
              />
              <button
                type="submit"
                class="btn btn-primary"
                [disabled]="!manualToken.trim() || isOffline()"
              >
                Registrar
              </button>
            </form>
          </div>
        </div>

        <!-- Right column: counters + active session -->
        <aside class="flex flex-col gap-4">
          <div class="card">
            <div class="card-body">
              <h3 class="card-title text-base">Sesión actual</h3>
              @if (store.currentSession(); as session) {
                <dl class="text-sm space-y-1">
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
                  No hay sesión activa. El backend la abrirá en el
                  próximo check-in (idempotente).
                </p>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <h3 class="card-title text-base">Progreso</h3>
              <div class="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p class="text-2xl font-semibold text-success">
                    {{ store.presentCount() }}
                  </p>
                  <p class="text-xs text-slate-500">Presentes</p>
                </div>
                <div>
                  <p class="text-2xl font-semibold text-error">
                    {{ store.absentCount() }}
                  </p>
                  <p class="text-xs text-slate-500">Ausentes</p>
                </div>
                <div>
                  <p class="text-2xl font-semibold">{{ store.totalCount() }}</p>
                  <p class="text-xs text-slate-500">Total</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <!-- Feedback chip (floats above content, 3s auto-dismiss) -->
      @if (feedback(); as fb) {
        <div
          class="toast toast-top toast-end z-50"
          role="status"
          aria-live="polite"
        >
          <div
            class="alert shadow-lg"
            [class.alert-success]="fb.tone === 'ok'"
            [class.alert-info]="fb.tone === 'info'"
            [class.alert-warning]="fb.tone === 'warn'"
            [class.alert-error]="fb.tone === 'error'"
          >
            <app-icon [name]="fb.icon" [size]="20" />
            <div>
              <p class="font-semibold">{{ fb.title }}</p>
              @if (fb.subtitle) {
                <p class="text-xs opacity-90">{{ fb.subtitle }}</p>
              }
            </div>
          </div>
        </div>
      }
    </app-page-container>
  `
})
export class AttendanceScannerPageComponent implements OnInit, OnDestroy {
  protected readonly store = inject(AttendanceStore);
  protected readonly environment = environment;

  /** Manual JWT input bound via ngModel. */
  protected manualToken = '';

  /** Current camera state (drives the viewport + CTA). */
  protected readonly cameraState = signal<CameraState>({ kind: 'unknown' });
  /** Online state. */
  protected readonly isOffline = signal(!navigator.onLine);
  /** Current feedback chip payload (or null). */
  protected readonly feedback = signal<FeedbackChip | null>(null);

  protected readonly offlineCopy = environment.attendance.offlineBannerCopy;

  /** Cooldown timer for manual scans. */
  private lastScanAt = 0;
  /** Auto-dismiss timer for the feedback chip. */
  private dismissHandle: ReturnType<typeof setTimeout> | null = null;
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
              : { kind: 'denied' }
          );
        })
        .catch(() => this.cameraState.set({ kind: 'granted' }));
    } else {
      this.cameraState.set({ kind: 'granted' });
    }
  }

  protected onCloseSession(): void {
    void this.store.closeCurrentSession();
  }

  /**
   * Manual fallback submission. Routed through the same debounce
   * gate the camera engine will use, so the timing behaviour stays
   * uniform.
   */
  protected submitManual(): void {
    const token = this.manualToken.trim();
    if (!token) return;
    this.manualToken = '';
    void this.handleScan(token);
  }

  /**
   * Single entry-point for the camera engine (TODO FE-6.1.I) and the
   * manual fallback alike. Enforces cooldown, dispatches to the
   * store, and surfaces a feedback chip.
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

  private showFeedback(outcome: ScanOutcome): void {
    const chip = this.toChip(outcome);
    if (!chip) return;
    this.feedback.set(chip);
    if (this.dismissHandle) clearTimeout(this.dismissHandle);
    this.dismissHandle = setTimeout(() => {
      this.feedback.set(null);
      this.store.clearLastScan();
    }, this.environment.attendance.feedbackDismissMs);
  }

  /**
   * Map a {@link ScanOutcome} to a visual feedback chip. Keeping the
   * mapping in the component (vs. the store) lets the store stay
   * UI-agnostic and lets us evolve the copy without touching the
   * transport layer.
   */
  private toChip(outcome: ScanOutcome): FeedbackChip | null {
    switch (outcome.kind) {
      case 'idle':
        return null;
      case 'ok':
        return outcome.idempotent
          ? {
              tone: 'info',
              icon: 'info',
              title: 'Ya marcado',
              subtitle: outcome.record.studentFullName
                ? `${outcome.record.studentFullName} • ${formatTime(outcome.record.occurredAt)}`
                : `Marcado a las ${formatTime(outcome.record.occurredAt)}`
            }
          : {
              tone: 'ok',
              icon: 'check',
              title: 'PRESENTE',
              subtitle:
                outcome.record.studentFullName ?? 'Alumno registrado correctamente'
            };
      case 'invalid':
        return { tone: 'error', icon: 'alert-circle', title: 'QR inválido', subtitle: outcome.reason };
      case 'expired':
        return { tone: 'error', icon: 'lock', title: 'Credencial revocada', subtitle: outcome.reason };
      case 'tenant-mismatch':
        return {
          tone: 'error',
          icon: 'lock',
          title: 'QR de otro colegio',
          subtitle: 'Pídele al alumno su credencial actual.'
        };
      case 'not-enrolled':
        return {
          tone: 'warn',
          icon: 'users',
          title: 'No matriculado',
          subtitle: outcome.reason
        };
      case 'session-closed':
        return {
          tone: 'warn',
          icon: 'lock',
          title: 'Sesión cerrada',
          subtitle: 'Abre una nueva sesión para seguir escaneando.'
        };
      case 'network':
        return {
          tone: 'error',
          icon: 'alert-circle',
          title: 'Sin conexión',
          subtitle: 'Reintenta cuando vuelvas a tener internet.'
        };
      case 'unknown':
        return { tone: 'error', icon: 'alert-circle', title: 'Error', subtitle: outcome.reason };
    }
  }
}

interface FeedbackChip {
  tone: 'ok' | 'info' | 'warn' | 'error';
  icon: IconName;
  title: string;
  subtitle?: string;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

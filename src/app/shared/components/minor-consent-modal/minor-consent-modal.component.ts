import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '@core/constants';
import { AlertComponent, SpinnerComponent } from '@shared/components';

@Component({
  selector: 'app-minor-consent-modal',
  standalone: true,
  imports: [CommonModule, RouterLink, AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="relative w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl text-slate-100 p-6 sm:p-8 space-y-6"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium border border-amber-500/20">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Protección de datos personales
              </div>
              <h2 class="text-xl font-bold text-white tracking-tight">
                Autorización específica para datos de estudiante
              </h2>
            </div>
            <button
              (click)="onClose()"
              type="button"
              class="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Description -->
          <div class="space-y-3 text-xs text-slate-300 leading-relaxed bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
            <p>
              Como padre, madre o apoderado autorizado de <strong class="text-white">{{ studentName || 'el/la estudiante' }}</strong>, revise el aviso concreto que el colegio configuró para esta finalidad:
            </p>
            @if (consentNotice.trim()) {
              <p class="whitespace-pre-line text-white">{{ consentNotice }}</p>
            } @else {
              <p class="text-amber-300">El colegio aún no configuró el aviso específico; esta autorización no se puede registrar.</p>
            }
            <p class="text-slate-400">Esta decisión se limita a la finalidad descrita en el aviso. No representa una autorización general para todos los tratamientos ni sustituye la política de privacidad del colegio. Si no otorga esta autorización, el colegio debe determinar la base jurídica aplicable a los demás tratamientos.</p>
          </div>

          @if (error(); as err) {
            <app-alert variant="error" [message]="err" />
          }

          <!-- Checks -->
          <div class="space-y-3 pt-1">
            <label class="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                [checked]="acceptedTerms()"
                (change)="acceptedTerms.set(!acceptedTerms())"
                class="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span class="text-xs text-slate-300 group-hover:text-white transition-colors">
                Declaro ser representante autorizado y otorgo mi consentimiento para el tratamiento específico descrito en el aviso mostrado arriba.
              </span>
            </label>

            <div class="text-[11px] text-slate-400 pl-7">
              Consulte nuestra
              <a
                routerLink="/politica-privacidad"
                target="_blank"
                class="text-blue-400 hover:underline"
              >
                Política de Privacidad
              </a>
              para conocer el procedimiento del ejercicio de Derechos ARCO.
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              (click)="onClose()"
              class="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              [disabled]="!canRecordNotice() || loading()"
              (click)="onDecline()"
              class="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              No otorgar
            </button>
            <button
              type="button"
              [disabled]="!canConfirm() || loading()"
              (click)="onConfirm()"
              class="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg transition-all"
            >
              @if (loading()) {
                <app-spinner [size]="16" />
                <span>Guardando...</span>
              } @else {
                <span>Autorizar y Continuar</span>
              }
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class MinorConsentModalComponent {
  private readonly http = inject(HttpClient);

  @Input() open = false;
  @Input() studentId = '';
  @Input() studentName = '';
  @Input() consentPurposeCode = '';
  @Input() consentPolicyVersion = '';
  @Input() consentNotice = '';

  @Output() consentGranted = new EventEmitter<boolean>();
  @Output() closed = new EventEmitter<void>();

  readonly acceptedTerms = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  canConfirm(): boolean {
    return this.acceptedTerms() && this.canRecordNotice();
  }

  canRecordNotice(): boolean {
    return !!this.consentPurposeCode.trim()
      && !!this.consentPolicyVersion.trim()
      && !!this.consentNotice.trim();
  }

  onClose(): void {
    this.closed.emit();
  }

  onConfirm(): void {
    if (!this.canConfirm() || !this.studentId) return;
    this.submitDecision(true);
  }

  onDecline(): void {
    if (!this.canRecordNotice() || !this.studentId) return;
    this.submitDecision(false);
  }

  private submitDecision(consentGranted: boolean): void {
    this.loading.set(true);
    this.error.set(null);

    const payload = {
      studentPublicUuid: this.studentId,
      consentGranted,
      policyVersion: this.consentPolicyVersion.trim(),
      purposeCode: this.consentPurposeCode.trim(),
      noticeSnapshot: this.consentNotice.trim(),
    };

    this.http.post(`${API_BASE_URL}/privacy/consents`, payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.consentGranted.emit(consentGranted);
        this.closed.emit();
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo registrar la autorización. Por favor reintente.');
      },
    });
  }
}

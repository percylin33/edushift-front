import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Permission } from '@core/enums';
import { AuthService } from '@core/services';
import { FileMetadata } from '@core/services/file-upload.service';
import { FileUploadComponent } from '@shared/components/file-upload/file-upload.component';
import {
  MeAttendanceRecord,
  MeAttendanceStatus,
} from '../../models/me-attendance.model';
import { MeApiService } from '../../services/me-api.service';

@Component({
  selector: 'app-me-attendance',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FileUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a
        routerLink="/me/profile"
        class="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <span aria-hidden="true">←</span>
        <span>Volver a Mi perfil</span>
      </a>
      <header class="mt-6">
        <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Mi espacio</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Mi asistencia</h1>
        <p class="mt-2 text-slate-600 dark:text-slate-400">
          Historial de presentes, tardanzas y faltas. Puedes justificar una falta o tardanza
          con un motivo y, si quieres, un adjunto.
        </p>
      </header>

      @if (loading()) {
        <div class="mt-8 space-y-3" aria-label="Cargando asistencia">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">
            Reintentar
          </button>
        </div>
      } @else if (records().length === 0) {
        <div
          class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700"
        >
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Sin registros
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Cuando el colegio tome asistencia, verás el historial aquí.
          </p>
        </div>
      } @else {
        <div
          class="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        >
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead class="bg-slate-50 dark:bg-slate-950/40">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Fecha
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Estado
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Justificación
                </th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (record of records(); track record.publicUuid) {
                <tr>
                  <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                    {{ record.occurredAt | date: 'dd/MM/yyyy HH:mm' }}
                  </td>
                  <td class="px-4 py-3">
                    <span
                      class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                      [class]="statusClass(record.status)"
                    >
                      {{ statusLabel(record.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-600">
                    {{ record.justificationStatus || 'Sin solicitud' }}
                  </td>
                  <td class="px-4 py-3">
                    @if (canJustify(record)) {
                      <button
                        type="button"
                        class="text-sm font-semibold text-indigo-600"
                        (click)="openJustify(record)"
                      >
                        Justificar
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (justifying()) {
        <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 class="text-lg font-semibold">Justificar inasistencia</h2>
            <p class="mt-2 text-sm text-slate-500">Describe el motivo y, si quieres, adjunta un documento o foto.</p>
            <textarea
              class="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              rows="4"
              maxlength="2000"
              [value]="justifyText()"
              (input)="onJustifyInput($event)"
            ></textarea>
            <div class="mt-3">
              <app-file-upload
                module="attendance"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                [maxSizeMb]="10"
                (uploaded)="onJustifyFile($event)"
              />
            </div>
            @if (justifyError()) {
              <p class="mt-2 text-sm text-rose-600">{{ justifyError() }}</p>
            }
            <div class="mt-4 flex justify-end gap-3">
              <button type="button" class="text-sm font-semibold text-slate-600" (click)="closeJustify()">Cancelar</button>
              <button
                type="button"
                class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                [disabled]="submitting()"
                (click)="submitJustify()"
              >
                {{ submitting() ? 'Enviando…' : 'Enviar' }}
              </button>
            </div>
          </div>
        </div>
      }
    </section>
  `,
})
export class MeAttendancePageComponent implements OnInit {
  private readonly api = inject(MeApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  readonly records = signal<MeAttendanceRecord[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly justifying = signal<MeAttendanceRecord | null>(null);
  readonly justifyText = signal('');
  readonly justifyAttachment = signal<string | null>(null);
  readonly justifyError = signal<string | null>(null);
  readonly submitting = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api
      .listAttendance()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.records.set(response.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar tu asistencia.');
          this.loading.set(false);
        },
      });
  }

  canJustify(record: MeAttendanceRecord): boolean {
    if (!this.auth.hasPermission(Permission.MeAttendanceJustify)) {
      return false;
    }
    const open = record.status === 'ABSENT' || record.status === 'LATE';
    const blocked =
      record.justificationStatus === 'PENDING' || record.justificationStatus === 'APPROVED';
    return open && !blocked;
  }

  openJustify(record: MeAttendanceRecord): void {
    this.justifying.set(record);
    this.justifyText.set('');
    this.justifyAttachment.set(null);
    this.justifyError.set(null);
  }

  closeJustify(): void {
    this.justifying.set(null);
    this.justifyText.set('');
    this.justifyAttachment.set(null);
    this.justifyError.set(null);
  }

  onJustifyInput(event: Event): void {
    this.justifyText.set((event.target as HTMLTextAreaElement).value);
  }

  onJustifyFile(file: FileMetadata | { publicUuid: string }): void {
    this.justifyAttachment.set(file.publicUuid);
  }

  submitJustify(): void {
    const record = this.justifying();
    const text = this.justifyText().trim();
    if (!record || !text) {
      this.justifyError.set('Escribe un motivo.');
      return;
    }
    this.submitting.set(true);
    this.api.justifyAttendance(record.publicUuid, text, this.justifyAttachment()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.closeJustify();
        this.load();
      },
      error: () => {
        this.submitting.set(false);
        this.justifyError.set('No se pudo enviar la justificación.');
      },
    });
  }

  statusLabel(status: MeAttendanceStatus): string {
    switch (status) {
      case 'PRESENT':
        return 'Presente';
      case 'LATE':
        return 'Tardanza';
      case 'ABSENT':
        return 'Falta';
      case 'EXCUSED':
        return 'Justificada';
    }
  }

  statusClass(status: MeAttendanceStatus): string {
    switch (status) {
      case 'PRESENT':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
      case 'LATE':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
      case 'ABSENT':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300';
      case 'EXCUSED':
        return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300';
    }
  }
}

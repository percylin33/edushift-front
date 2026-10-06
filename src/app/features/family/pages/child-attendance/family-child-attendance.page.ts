import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Permission } from '@core/enums';
import { SpringPage } from '@core/models/api-response.model';
import { AuthService } from '@core/services';
import { AttendanceExportActionsComponent } from '@features/attendance/components';
import { monthRange } from '@features/attendance/models/attendance-report-params.model';
import { AttendancePrintService } from '@features/attendance/services/attendance-print.service';
import { AttendanceReportService } from '@features/attendance/services/attendance-report.service';
import { simpleRowsToPrintRows } from '@features/attendance/utils/attendance-print.helpers';
import { ReportFormat } from '@features/reports/models/report.model';
import { FamilyAttendanceRecord } from '../../models/family-attendance.model';
import { FamilyApiService } from '../../services/family-api.service';
import { FileUploadComponent } from '@shared/components/file-upload/file-upload.component';
import { FileMetadata } from '@core/services/file-upload.service';

@Component({
  selector: 'app-family-child-attendance-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, FileUploadComponent, AttendanceExportActionsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl px-4 py-8 sm:py-10">
      <a [routerLink]="['/family/children', studentPublicUuid()]" class="text-sm font-semibold text-indigo-600">
        ← Volver al resumen
      </a>

      <header class="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-indigo-600">Familia</p>
          <h1 class="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-100">Asistencia del estudiante</h1>
          <p class="mt-2 text-slate-600 dark:text-slate-400">Consulta faltas, tardanzas y el estado de sus justificaciones.</p>
        </div>
        @if (!loading() && page() && page()!.content.length) {
          <app-attendance-export-actions
            [busy]="exportBusy()"
            (printClick)="onPrint()"
            (downloadClick)="onDownload($event)"
          />
        }
      </header>

      @if (!loading() && page() && page()!.content.length) {
        <div class="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label class="text-xs font-medium text-slate-500" for="fam-month">Mes</label>
            <select id="fam-month" class="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" [(ngModel)]="month" name="month" (ngModelChange)="onPeriodChange()">
              <option [ngValue]="null">Todos los meses</option>
              @for (m of months; track m.value) {
                <option [ngValue]="m.value">{{ m.label }}</option>
              }
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-slate-500" for="fam-year">Año</label>
            <input id="fam-year" type="number" class="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950" [(ngModel)]="year" name="year" (ngModelChange)="onPeriodChange()" />
          </div>
        </div>
      }

      @if (loading()) {
        <div class="mt-8 space-y-3" aria-label="Cargando asistencia">
          @for (item of [1, 2, 3, 4]; track item) {
            <div class="h-16 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800"></div>
          }
        </div>
      } @else if (error()) {
        <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-700" role="alert">
          <p>{{ error() }}</p>
          <button type="button" class="mt-3 font-semibold underline" (click)="load()">Reintentar</button>
        </div>
      } @else if (!page() || page()!.content.length === 0) {
        <div class="mt-8 rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center dark:border-slate-700">
          <h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100">Sin registros de asistencia</h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">Cuando el colegio registre asistencia, aparecerá aquí.</p>
        </div>
      } @else {
        <div class="mt-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead class="bg-slate-50 dark:bg-slate-950/40">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fecha</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Justificación</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</th>
                  <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Acción</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (record of page()!.content; track record.publicUuid) {
                  <tr>
                    <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {{ record.occurredAt | date:'dd/MM/yyyy HH:mm' }}
                    </td>
                    <td class="px-4 py-3">
                      <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold" [class]="statusClass(record.status)">
                        {{ statusLabel(record.status) }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {{ justificationLabel(record) }}
                    </td>
                    <td class="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                      {{ record.notes || record.justificationText || '—' }}
                    </td>
                    <td class="px-4 py-3">
                      @if (canJustify(record)) {
                        <button
                          type="button"
                          class="text-sm font-semibold text-indigo-600"
                          (click)="openJustify(record)"
                          [attr.aria-label]="'Justificar inasistencia del ' + (record.occurredAt | date:'dd/MM/yyyy')"
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
        </div>
      }

      @if (justifying()) {
        <div class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="justify-title">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 id="justify-title" class="text-lg font-semibold text-slate-900 dark:text-slate-100">Justificar inasistencia</h2>
            <p class="mt-2 text-sm text-slate-500">Describe el motivo y, si quieres, adjunta un documento o foto.</p>
            <textarea
              class="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              rows="4"
              maxlength="2000"
              [value]="justifyText()"
              (input)="onJustifyInput($event)"
              aria-label="Motivo de la justificación"
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
export class FamilyChildAttendancePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(FamilyApiService);
  private readonly printService = inject(AttendancePrintService);
  private readonly reportService = inject(AttendanceReportService);
  protected readonly auth = inject(AuthService);

  readonly studentPublicUuid = signal(this.route.snapshot.paramMap.get('studentPublicUuid') ?? '');
  readonly page = signal<SpringPage<FamilyAttendanceRecord> | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly exportBusy = signal(false);
  readonly justifying = signal<FamilyAttendanceRecord | null>(null);
  readonly justifyText = signal('');
  readonly justifyAttachment = signal<string | null>(null);
  readonly justifyError = signal<string | null>(null);
  readonly submitting = signal(false);

  month: number | null = null;
  year = new Date().getFullYear();
  readonly months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const studentPublicUuid = this.studentPublicUuid();
    if (!studentPublicUuid) {
      this.error.set('No se encontró el estudiante solicitado.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    const range = this.activeRange();
    this.api.getChildAttendance(studentPublicUuid, {
      page: 0,
      size: 200,
      ...(range ? { from: range.from, to: range.to } : {}),
    }).subscribe({
      next: (response) => {
        this.page.set(this.api.adaptAttendancePage(response));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la asistencia del estudiante.');
        this.loading.set(false);
      },
    });
  }

  canJustify(record: FamilyAttendanceRecord): boolean {
    if (!this.auth.hasPermission(Permission.LmsAttendanceJustify)) {
      return false;
    }
    const open = record.status === 'ABSENT' || record.status === 'LATE';
    const blocked =
      record.justificationStatus === 'PENDING' || record.justificationStatus === 'APPROVED';
    return open && !blocked;
  }

  openJustify(record: FamilyAttendanceRecord): void {
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

  onJustifyFile(file: FileMetadata | { publicUuid: string }): void {
    this.justifyAttachment.set(file.publicUuid);
  }

  onJustifyInput(event: Event): void {
    this.justifyText.set((event.target as HTMLTextAreaElement).value);
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

  statusLabel(status: FamilyAttendanceRecord['status']): string {
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

  statusClass(status: FamilyAttendanceRecord['status']): string {
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

  justificationLabel(record: FamilyAttendanceRecord): string {
    if (!record.justificationStatus) return 'Sin solicitud';
    switch (record.justificationStatus) {
      case 'PENDING':
        return 'Pendiente';
      case 'APPROVED':
        return 'Aprobada';
      case 'REJECTED':
        return 'Rechazada';
    }
  }

  onPeriodChange(): void {
    this.load();
  }

  private activeRange(): { from: string; to: string } | null {
    if (this.month == null) return null;
    return monthRange(this.year, this.month);
  }

  private periodSubtitle(): string {
    if (this.month == null) return 'Todos los meses';
    return `Mes ${this.month}/${this.year}`;
  }

  onPrint(): void {
    const content = this.page()?.content ?? [];
    this.printService.print({
      mode: 'studentHistory',
      meta: {
        title: 'Asistencia del estudiante',
        subtitle: this.periodSubtitle(),
        generatedAt: new Date(),
      },
      rows: simpleRowsToPrintRows(
        content.map((r) => ({
          occurredAt: r.occurredAt,
          status: r.status,
          notes: r.notes ?? r.justificationText,
        })),
      ),
    });
  }

  async onDownload(format: ReportFormat): Promise<void> {
    const range = this.activeRange();
    this.exportBusy.set(true);
    try {
      await this.reportService.downloadScopedAttendance(
        'family',
        this.studentPublicUuid(),
        range?.from,
        range?.to,
        format,
      );
    } finally {
      this.exportBusy.set(false);
    }
  }
}

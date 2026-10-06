import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ROUTES } from '@core/constants';
import { AcademicApiService } from '@features/academic/services';
import { AcademicYearStatus, SectionRow } from '@features/academic/models';
import {
  PageContainerComponent,
  PageHeaderComponent,
  SpinnerComponent,
} from '@shared/components';
import {
  AttendanceExportActionsComponent,
  StudentSearchPickerComponent,
} from '../../components';
import { AttendanceStudentLookupItem } from '../../models';
import { AttendancePrintService } from '../../services/attendance-print.service';
import { AttendanceReportService } from '../../services/attendance-report.service';
import { AttendanceApiService } from '../../services';
import { simpleRowsToPrintRows, statusLabel } from '../../utils/attendance-print.helpers';
import { monthRange } from '../../models/attendance-report-params.model';
import { ReportFormat } from '@features/reports/models/report.model';

interface StudentAttendanceRow {
  publicUuid: string;
  occurredAt: Date;
  status: string;
  notes?: string;
}

@Component({
  selector: 'app-attendance-reports-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageContainerComponent,
    PageHeaderComponent,
    SpinnerComponent,
    AttendanceExportActionsComponent,
    StudentSearchPickerComponent,
  ],
  template: `
    <app-page-container>
      <app-page-header
        title="Reporte de asistencia por alumno"
        subtitle="Imprime o descarga el historial de un estudiante por día o mes."
      >
        <a [routerLink]="sessionsRoute" class="btn btn-ghost btn-sm">Sesiones</a>
        @if (selectedStudent() && rows().length) {
          <app-attendance-export-actions
            [busy]="exportBusy()"
            (printClick)="onPrint()"
            (downloadClick)="onDownload($event)"
          />
        }
      </app-page-header>

      <section class="card mb-4">
        <div class="card-body grid gap-4">
          <div>
            <p class="label mb-2">Alumno</p>
            @if (selectedStudent(); as st) {
              <div class="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <span class="font-medium">{{ st.fullName }}</span>
                <button type="button" class="text-sm text-indigo-600" (click)="clearStudent()">Cambiar</button>
              </div>
            } @else {
              <app-student-search-picker (selected)="onStudentSelected($event)" />
            }
          </div>

          @if (selectedStudent()) {
            <div class="grid gap-3 sm:grid-cols-12">
              <div class="sm:col-span-3">
                <label class="label" for="rep-mode">Periodo</label>
                <select id="rep-mode" class="select" [(ngModel)]="filterMode" name="filterMode" (change)="loadRows()">
                  <option value="month">Por mes</option>
                  <option value="range">Rango de fechas</option>
                </select>
              </div>
              @if (filterMode === 'month') {
                <div class="sm:col-span-3">
                  <label class="label" for="rep-month">Mes</label>
                  <select id="rep-month" class="select" [(ngModel)]="month" name="month" (change)="loadRows()">
                    @for (m of months; track m.value) {
                      <option [ngValue]="m.value">{{ m.label }}</option>
                    }
                  </select>
                </div>
                <div class="sm:col-span-2">
                  <label class="label" for="rep-year">Año</label>
                  <input id="rep-year" type="number" class="input" [(ngModel)]="year" name="year" (change)="loadRows()" />
                </div>
              } @else {
                <div class="sm:col-span-3">
                  <label class="label" for="rep-from">Desde</label>
                  <input id="rep-from" type="date" class="input" [(ngModel)]="from" name="from" (change)="loadRows()" />
                </div>
                <div class="sm:col-span-3">
                  <label class="label" for="rep-to">Hasta</label>
                  <input id="rep-to" type="date" class="input" [(ngModel)]="to" name="to" (change)="loadRows()" />
                </div>
              }
            </div>
          }
        </div>
      </section>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <app-spinner [size]="24" label="Cargando historial…" />
        </div>
      } @else if (selectedStudent() && rows().length) {
        <section class="card overflow-hidden">
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                @for (row of rows(); track row.publicUuid) {
                  <tr>
                    <td>{{ row.occurredAt | date: 'dd/MM/yyyy HH:mm' }}</td>
                    <td>{{ statusLabel(row.status) }}</td>
                    <td>{{ row.notes || '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      } @else if (selectedStudent()) {
        <p class="text-center text-sm text-content-muted py-8">Sin registros en el periodo seleccionado.</p>
      }
    </app-page-container>
  `,
})
export class AttendanceReportsPageComponent implements OnInit {
  private readonly api = inject(AttendanceApiService);
  private readonly academicApi = inject(AcademicApiService);
  private readonly printService = inject(AttendancePrintService);
  private readonly reportService = inject(AttendanceReportService);

  protected readonly sessionsRoute = ROUTES.ATTENDANCE.SESSIONS;
  protected readonly selectedStudent = signal<AttendanceStudentLookupItem | null>(null);
  protected readonly rows = signal<StudentAttendanceRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly exportBusy = signal(false);

  protected filterMode: 'month' | 'range' = 'month';
  protected month = new Date().getMonth() + 1;
  protected year = new Date().getFullYear();
  protected from = '';
  protected to = '';
  protected readonly months = [
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

  protected readonly statusLabel = statusLabel;

  async ngOnInit(): Promise<void> {
    const range = monthRange(this.year, this.month);
    this.from = range.from;
    this.to = range.to;
    await firstValueFrom(this.academicApi.listYears()).catch(() => undefined);
  }

  protected onStudentSelected(student: AttendanceStudentLookupItem): void {
    this.selectedStudent.set(student);
    void this.loadRows();
  }

  protected clearStudent(): void {
    this.selectedStudent.set(null);
    this.rows.set([]);
  }

  protected async loadRows(): Promise<void> {
    const student = this.selectedStudent();
    if (!student) return;
    let fromDate = this.from;
    let toDate = this.to;
    if (this.filterMode === 'month') {
      const range = monthRange(this.year, this.month);
      fromDate = range.from;
      toDate = range.to;
    }
    this.loading.set(true);
    try {
      const result = await firstValueFrom(
        this.api.listStudentAttendance(student.studentPublicUuid, fromDate, toDate),
      );
      this.rows.set(result);
    } catch {
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected onPrint(): void {
    const student = this.selectedStudent();
    if (!student) return;
    this.printService.print({
      mode: 'studentHistory',
      meta: {
        title: `Asistencia — ${student.fullName}`,
        subtitle: this.filterMode === 'month' ? `Mes ${this.month}/${this.year}` : `${this.from} — ${this.to}`,
        generatedAt: new Date(),
      },
      rows: simpleRowsToPrintRows(this.rows()),
    });
  }

  protected async onDownload(format: ReportFormat): Promise<void> {
    const student = this.selectedStudent();
    if (!student) return;
    let fromDate = this.from;
    let toDate = this.to;
    if (this.filterMode === 'month') {
      const range = monthRange(this.year, this.month);
      fromDate = range.from;
      toDate = range.to;
    }
    this.exportBusy.set(true);
    try {
      const result = await this.reportService.requestInstitutionalExport(
        {
          scope: 'STUDENT',
          studentPublicUuid: student.studentPublicUuid,
          from: fromDate,
          to: toDate,
          month: this.filterMode === 'month' ? this.month : undefined,
          year: this.filterMode === 'month' ? this.year : undefined,
        },
        format,
      );
      this.reportService.downloadJob(
        result.job.publicUuid,
        `asistencia-${student.studentPublicUuid.slice(0, 8)}.${format.toLowerCase()}`,
      );
    } finally {
      this.exportBusy.set(false);
    }
  }
}

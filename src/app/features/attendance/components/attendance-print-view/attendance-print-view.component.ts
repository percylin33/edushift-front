import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { AttendancePrintPayload } from '../../models/attendance-report-params.model';

@Component({
  selector: 'app-attendance-print-view',
  standalone: true,
  imports: [CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        font-family: system-ui, sans-serif;
        color: #111;
        background: #fff;
        padding: 1.5rem;
      }
      h1 {
        font-size: 1.25rem;
        margin: 0 0 0.25rem;
      }
      .meta {
        font-size: 0.75rem;
        color: #555;
        margin-bottom: 1rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
      }
      th,
      td {
        border: 1px solid #ccc;
        padding: 0.35rem 0.5rem;
        text-align: left;
      }
      th {
        background: #f3f4f6;
      }
      @media print {
        :host {
          padding: 0;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
        }
      }
    `,
  ],
  template: `
    @if (payload(); as p) {
      <h1>{{ p.meta.title }}</h1>
      @if (p.meta.subtitle) {
        <p class="meta">{{ p.meta.subtitle }}</p>
      }
      <p class="meta">Generado: {{ p.meta.generatedAt | date: 'medium' }}</p>
      <table>
        <thead>
          <tr>
            @for (col of columns(); track col) {
              <th>{{ col }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of p.rows; track $index) {
            <tr>
              @for (col of columnKeys(); track col) {
                <td>{{ cellValue(row, col) }}</td>
              }
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class AttendancePrintViewComponent {
  readonly payload = input.required<AttendancePrintPayload>();

  columns(): string[] {
    const p = this.payload();
    if (p.columns?.length) return p.columns;
    return this.columnKeys().map((k) => COLUMN_LABELS[k] ?? k);
  }

  columnKeys(): (keyof import('../../models/attendance-report-params.model').AttendancePrintRow)[] {
    const mode = this.payload().mode;
    switch (mode) {
      case 'studentHistory':
        return ['date', 'status', 'time', 'notes'];
      case 'sessionsList':
        return ['date', 'sectionName', 'slot', 'status'];
      case 'sectionMonthly':
        return ['studentName', 'date', 'status', 'sectionName'];
      default:
        return ['studentName', 'documentNumber', 'status', 'time'];
    }
  }

  cellValue(row: import('../../models/attendance-report-params.model').AttendancePrintRow, key: string): string {
    const map: Record<string, string | undefined> = {
      date: row.date,
      studentName: row.studentName,
      documentNumber: row.documentNumber,
      sectionName: row.sectionName,
      slot: row.slot,
      status: row.status,
      time: row.time,
      notes: row.notes,
    };
    return map[key] ?? '—';
  }
}

const COLUMN_LABELS: Record<string, string> = {
  date: 'Fecha',
  studentName: 'Alumno',
  documentNumber: 'Documento',
  sectionName: 'Sección',
  slot: 'Turno',
  status: 'Estado',
  time: 'Hora',
  notes: 'Notas',
};

import { ReportFormat } from '@features/reports/models/report.model';

/** Scope sent to backend `POST /v1/reports` params JSON. */
export type AttendanceReportScope =
  | 'SECTION_DAILY'
  | 'SECTION_MONTHLY'
  | 'SECTION_RANGE'
  | 'STUDENT';

export interface AttendanceReportParams {
  scope: AttendanceReportScope;
  sectionPublicUuid?: string;
  sectionPublicUuids?: string[];
  studentPublicUuid?: string;
  from?: string;
  to?: string;
  month?: number;
  year?: number;
  sessionPublicUuid?: string;
}

export interface AttendancePrintRow {
  date: string;
  studentName?: string;
  documentNumber?: string;
  sectionName?: string;
  slot?: string;
  status: string;
  time?: string;
  notes?: string;
}

export interface AttendancePrintMeta {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  tenantLabel?: string;
}

export type AttendancePrintMode = 'sectionDaily' | 'sectionMonthly' | 'studentHistory' | 'sessionsList';

export interface AttendancePrintPayload {
  mode: AttendancePrintMode;
  meta: AttendancePrintMeta;
  rows: AttendancePrintRow[];
  columns?: string[];
}

export function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function buildReportParams(input: Partial<AttendanceReportParams>): AttendanceReportParams {
  if (input.scope === 'SECTION_MONTHLY' && input.month && input.year && !input.from) {
    const range = monthRange(input.year, input.month);
    return { ...input, scope: 'SECTION_MONTHLY', from: range.from, to: range.to };
  }
  return input as AttendanceReportParams;
}

export function serializeReportParams(params: AttendanceReportParams): string {
  return JSON.stringify(buildReportParams(params));
}

export const ATTENDANCE_EXPORT_FORMATS: ReportFormat[] = ['PDF', 'XLSX', 'CSV'];

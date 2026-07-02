export type ReportType =
  'GRADE_BOOK' | 'ATTENDANCE_SUMMARY' | 'PERIOD_CLOSE' | 'STUDENT_TRANSCRIPT';
export type ReportFormat = 'PDF' | 'XLSX' | 'CSV';
export type ReportStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED';

export interface ReportJob {
  publicUuid: string;
  reportType: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  progressPct: number;
  errorCode?: string;
  errorMessage?: string;
  requestedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface CreateReportPayload {
  reportType: ReportType;
  format: ReportFormat;
  params?: string;
  idemKey?: string;
}

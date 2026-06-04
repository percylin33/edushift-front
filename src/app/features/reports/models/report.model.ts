import { BaseEntity } from '@core/models';

export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'json';
export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed';

export interface Report extends BaseEntity {
  name: string;
  description?: string;
  category: 'academic' | 'financial' | 'attendance' | 'custom';
  status: ReportStatus;
  format: ReportFormat;
  downloadUrl?: string;
  generatedAt?: string;
}

export interface ReportRequest {
  category: Report['category'];
  format: ReportFormat;
  filters?: Record<string, unknown>;
  dateFrom?: string;
  dateTo?: string;
}

export interface TenantMetric {
  tenantName: string;
  tenantUuid: string;
  value: number;
}

export interface MetricsQuery {
  tenantUuid?: string;
  page?: number;
  size?: number;
}

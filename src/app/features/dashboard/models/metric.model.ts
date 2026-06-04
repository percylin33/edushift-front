export interface Metric {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  deltaPct?: number;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'list' | 'custom';
  title: string;
  payload: unknown;
}

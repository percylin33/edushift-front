export interface DashboardKpis {
  mrr: number;
  activeTenants: number;
  activeStudents: number;
  totalReceivable: number;
}

export interface RevenueTrendPoint {
  month: string;
  revenue: number;
}

export interface ActiveTenantsPoint {
  month: string;
  count: number;
}

export interface PlanDistributionItem {
  planName: string;
  count: number;
  color?: string;
}

export interface TopTenant {
  tenantName: string;
  revenue: number;
}

export interface CollectionVsOverdueItem {
  month: string;
  collected: number;
  overdue: number;
}

export interface StudentsByPlanItem {
  planName: string;
  count: number;
}

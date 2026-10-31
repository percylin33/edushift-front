export interface SchoolOperationsDashboardSummary {
  academicYear: string | null;
  annualDisclosurePackageExists: boolean;
  disclosuresPendingPublication: number;
  disclosuresPublished: number;
  admissionsInProcess: number;
  admissionsWaitlisted: number;
  admissionsAdmitted: number;
  admissionsEnrolled: number;
  evaluationsTotal: number;
  evaluationsDraft: number;
  evaluationsPublished: number;
  evaluationsClosed: number;
  generatedAt: string;
}

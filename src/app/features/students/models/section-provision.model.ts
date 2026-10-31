/**
 * CRED-7 — mass provision of portal accounts for a section.
 */

export type ProvisionEmailSource = 'REAL' | 'SYNTHETIC';

export interface ProvisionCredentialRow {
  role: string;
  fullName: string;
  documentType: string | null;
  documentNumber: string | null;
  email: string;
  temporaryPassword: string | null;
  emailSource: ProvisionEmailSource | null;
  status: string;
  studentPublicUuid: string | null;
  guardianPublicUuid: string | null;
}

export interface ProvisionSectionAccountsRequest {
  includeGuardians: boolean;
  overwriteMissingEmailWithSynthetic: boolean;
}

export interface ProvisionSectionAccountsResponse {
  jobPublicUuid: string;
  sectionPublicUuid: string;
  sectionName: string;
  studentsProvisioned: number;
  guardiansProvisioned: number;
  skippedAlreadyLinked: number;
  syntheticEmails: number;
  realEmails: number;
  credentials: ProvisionCredentialRow[];
}

export type DisclosureStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED';
export type DisclosureFieldState = 'COMPLETED' | 'NOT_APPLICABLE' | 'PENDING';
export type DisclosureAttachmentCategory =
  | 'INTERNAL_REGULATIONS'
  | 'SCHOOL_AUTHORIZATION'
  | 'ADMISSION_INFORMATION'
  | 'ECONOMIC_INFORMATION'
  | 'CURRICULUM_PLAN'
  | 'SCHOOL_CALENDAR'
  | 'SERVICE_INFORMATION'
  | 'OTHER';

export interface DisclosureFieldDefinition {
  key: string;
  section: string;
  label: string;
  guidance: string;
}

export interface DisclosureField {
  state: DisclosureFieldState;
  value: string | null;
  note: string | null;
  sources: DisclosureFieldSource[];
  documentOnly: boolean;
  systemManaged: boolean;
  systemSource: string | null;
}

export interface DisclosureFieldSource {
  filePublicUuid: string;
  pageReference: string | null;
}

export interface DisclosureAttachment {
  category: DisclosureAttachmentCategory;
  label: string;
  filePublicUuid: string;
  versionLabel: string | null;
  documentDate: string | null;
  validUntil: string | null;
  visibleToFamilies: boolean;
}

export interface DisclosureContent {
  fields: Record<string, DisclosureField>;
  attachments: DisclosureAttachment[];
  enrollmentDisclosureDeadline: string | null;
  yearCloseDisclosureDeadline: string | null;
  additionalInformation: string | null;
}

export interface DisclosureCompleteness {
  completed: number;
  total: number;
  pending: DisclosureFieldDefinition[];
}

export interface DisclosurePackage {
  publicUuid: string | null;
  academicYearPublicUuid: string;
  academicYearName: string;
  status: DisclosureStatus;
  revisionNumber: number;
  latestPublishedVersion: number | null;
  content: DisclosureContent;
  completeness: DisclosureCompleteness;
  reviewNote: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
}

export interface DisclosurePublication {
  publicUuid: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  versionNumber: number;
  content: DisclosureContent;
  contentSha256: string;
  approvedAt: string;
  publishedAt: string;
}

export interface DisclosureVersionSummary {
  publicUuid: string;
  versionNumber: number;
  contentSha256: string;
  publishedAt: string;
}

export interface ApiEnvelope<T> {
  success?: boolean;
  message?: string;
  data: T;
}

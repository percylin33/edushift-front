export type AdmissionStatus =
  'RECEIVED' | 'UNDER_REVIEW' | 'ADMITTED' | 'WAITLISTED' | 'REJECTED' | 'WITHDRAWN' | 'ENROLLED';

export type AdmissionSource = 'IN_PERSON' | 'REFERRAL' | 'WEBSITE' | 'OTHER';
export type AdmissionInquiryStatus =
  'RECEIVED' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'CLOSED';
export type AdmissionInquirySource = 'WEBSITE' | 'PRESENTIAL';
export type AdmissionInquiryChannel = 'WEBSITE' | 'PRESENTIAL' | 'PHONE' | 'WHATSAPP' | 'OTHER';
export type AdmissionContactType = 'EMAIL' | 'PHONE';
export type AdmissionOfferStatus =
  'NOT_REQUIRED' | 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'AT_RISK' | 'RELEASED';
export type AdmissionReservationStatus = 'TEMPORARY' | 'COMMITTED' | 'CONSUMED' | 'EXPIRED' | 'RELEASED';

export interface AdmissionApplication {
  publicUuid: string;
  studentPublicUuid: string | null;
  studentFullName: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  gradePublicUuid: string;
  gradeName: string;
  status: AdmissionStatus;
  source: AdmissionSource;
  submittedAt: string;
  lastStatusNote: string | null;
  enrollmentPublicUuid: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  offerStatus: AdmissionOfferStatus;
  offerSentAt: string | null;
  offerReminderDueAt: string | null;
  offerResponseAt: string | null;
}

export interface GradeVacancy {
  gradePublicUuid: string;
  gradeName: string;
  sectionCount: number;
  configuredCapacity: number;
  activeEnrollments: number;
  admittedApplications: number;
  temporaryReservations: number;
  availableSeats: number;
  capacityConfigured: boolean;
}

export interface AdmissionStatusEvent {
  fromStatus: AdmissionStatus | null;
  toStatus: AdmissionStatus;
  note: string | null;
  actorUserId: string;
  createdAt: string;
}

export interface CreateAdmissionApplication {
  studentPublicUuid: string;
  gradePublicUuid: string;
  source: AdmissionSource;
  note?: string;
}

export interface AdmissionInquiry {
  source?: AdmissionInquirySource;
  initialChannel?: AdmissionInquiryChannel;
  privacyNoticeGivenAt?: string | null;
  responsibleName?: string | null;
  nextAttentionDate?: string | null;
  nextAction?: string | null;
  publicUuid: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  gradePublicUuid: string;
  gradeName: string;
  contactName: string;
  contactType: AdmissionContactType;
  contactValue: string;
  status: AdmissionInquiryStatus;
  note: string | null;
  convertedApplicationPublicUuid: string | null;
  convertedApplicationStatus?: AdmissionStatus | null;
  convertedAcademicYearPublicUuid?: string | null;
  createdAt: string;
}

export interface CreatePresentialInquiry {
  gradePublicUuid: string;
  contactName: string;
  contactType: AdmissionContactType;
  contactValue: string;
  initialChannel: AdmissionInquiryChannel;
  note?: string;
  responsibleName?: string;
  nextAttentionDate?: string | null;
  nextAction?: string;
  privacyNoticeGiven: boolean;
}

export interface AdmissionInquiryEvent {
  fromStatus: AdmissionInquiryStatus | null;
  toStatus: AdmissionInquiryStatus;
  note: string | null;
  actorUserId: string | null;
  actorType: 'SYSTEM' | 'STAFF';
  createdAt: string;
}

export interface PublicAdmissionCatalog {
  tenantName: string;
  years: { publicUuid: string; name: string }[];
  grades: { publicUuid: string; name: string; levelName: string }[];
}

export interface PublicAdmissionInquiry {
  academicYearPublicUuid: string;
  gradePublicUuid: string;
  contactName: string;
  contactType: AdmissionContactType;
  contactValue: string;
  privacyAccepted: boolean;
  website: string;
}

export interface PublicInquiryReceipt {
  reference: string;
  status: string;
}

export interface CreateAdmissionFromInquiry {
  academicYearPublicUuid?: string;
  gradePublicUuid?: string;
  source: AdmissionSource;
  studentDocumentType: 'DNI' | 'CE' | 'PASSPORT' | 'OTHER';
  studentDocumentNumber: string;
  studentFirstName: string;
  studentLastName: string;
  studentSecondLastName?: string;
  studentBirthDate: string;
  studentGender: 'MALE' | 'FEMALE' | 'OTHER' | 'NOT_SPECIFIED';
  guardianDocumentType: 'DNI' | 'CE' | 'PASSPORT' | 'OTHER';
  guardianDocumentNumber: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianEmail: string;
  guardianPhone: string;
  guardianRelationship: 'FATHER' | 'MOTHER' | 'GRANDPARENT' | 'GUARDIAN' | 'OTHER';
  note?: string;
}

export interface PublicAdmissionOffer {
  tenantName: string;
  studentName: string;
  gradeName: string;
  academicYearName: string;
  status: AdmissionOfferStatus;
  reminderDueAt: string | null;
  expiresAt?: string | null;
}

export interface AdmissionOfferLink {
  confirmationUrl: string;
  status: AdmissionOfferStatus;
  reminderDueAt: string;
  expiresAt?: string;
}

export interface AdmissionApplicationDetail {
  editableApplicant?: CreateAdmissionFromInquiry | null;
  application: AdmissionApplication;
  student: {
    fullName: string | null;
    documentType: string | null;
    documentNumber: string | null;
    birthDate: string | null;
    gender: string | null;
  };
  guardians: {
    fullName: string;
    documentType: string | null;
    documentNumber: string | null;
    email: string | null;
    phone: string | null;
    relationship: string | null;
  }[];
  inquiry: {
    publicUuid: string;
    contactName: string;
    contactValue: string;
    academicYearName: string;
    gradeName: string;
    createdAt: string | null;
    note: string | null;
    history: AdmissionInquiryEvent[];
  } | null;
  history: AdmissionStatusEvent[];
}
export interface AdmissionDetailDecision {
  application: AdmissionApplication;
  status: AdmissionStatus;
}

export interface AdmissionSectionVacancy {
  publicUuid: string;
  sectionName: string;
  capacity: number | null;
  activeEnrollments: number;
  availableSeats: number | null;
}

export interface AdmissionReservation {
  publicUuid: string;
  applicationPublicUuid: string;
  studentPublicUuid: string | null;
  studentFullName: string;
  academicYearPublicUuid: string;
  academicYearName: string;
  gradePublicUuid: string;
  gradeName: string;
  status: AdmissionReservationStatus;
  expiresAt: string | null;
  reason: string | null;
  advanceReceivedCents: number;
  advanceAvailableCents: number;
}

export interface AdmissionReservationAdvance {
  publicUuid: string;
  reservationPublicUuid: string;
  amountCents: number;
  appliedCents: number;
  availableCents: number;
  currency: string;
  method: 'CASH' | 'TRANSFER' | 'POS' | 'OTHER';
  status: 'AVAILABLE' | 'PARTIALLY_APPLIED' | 'APPLIED' | 'REFUNDED';
  reference: string | null;
  notes: string | null;
  receivedAt: string;
}

export interface AdmissionReservationAdvanceEvent {
  advancePublicUuid: string;
  action: 'RECEIVED' | 'APPLIED' | 'REFUNDED';
  amountCents: number;
  invoicePublicUuid: string | null;
  note: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface AdmissionEnrollmentCompletion {
  application: AdmissionApplication;
  billingStatus: 'NOT_CONFIGURED' | 'PENDING' | 'PAID' | 'ISSUE_FAILED';
  enrollmentInvoice: {
    publicUuid: string;
    totalCents: number;
    advanceAppliedCents?: number;
    balanceCents?: number;
    status: 'PENDING' | 'PENDING_REVIEW' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
    periodLabel: string;
  } | null;
  portalAccessStatus: 'LINKED' | 'INVITATION_SENT' | 'PENDING' | 'REVIEW_REQUIRED';
}

import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse } from '@core/models';
import { ApiService } from '@core/services';
import { API } from '@core/constants';
import {
  AdmissionApplication,
  AdmissionSectionVacancy,
  AdmissionApplicationDetail,
  AdmissionStatusEvent,
  CreateAdmissionApplication,
  GradeVacancy,
  AdmissionInquiry,
  AdmissionInquiryEvent,
  CreateAdmissionFromInquiry,
  AdmissionOfferLink,
  PublicAdmissionCatalog,
  PublicAdmissionInquiry,
  PublicAdmissionOffer,
  PublicInquiryReceipt,
  CreatePresentialInquiry,
  AdmissionEnrollmentCompletion,
  AdmissionReservation,
  AdmissionReservationAdvance,
  AdmissionReservationAdvanceEvent,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AdmissionsApiService {
  private readonly api = inject(ApiService);

  publicCatalog(tenantSlug: string): Observable<ApiResponse<PublicAdmissionCatalog>> {
    return this.api.get<ApiResponse<PublicAdmissionCatalog>>(
      API.ADMISSIONS.PUBLIC_CATALOG(tenantSlug),
    );
  }

  submitPublicInquiry(
    tenantSlug: string,
    request: PublicAdmissionInquiry,
  ): Observable<ApiResponse<PublicInquiryReceipt>> {
    return this.api.post<ApiResponse<PublicInquiryReceipt>, PublicAdmissionInquiry>(
      API.ADMISSIONS.PUBLIC_INQUIRY(tenantSlug),
      request,
    );
  }

  publicOffer(tenantSlug: string, token: string): Observable<ApiResponse<PublicAdmissionOffer>> {
    return this.api.get<ApiResponse<PublicAdmissionOffer>>(
      API.ADMISSIONS.PUBLIC_OFFER(tenantSlug, token),
    );
  }

  respondToPublicOffer(
    tenantSlug: string,
    token: string,
    accepted: boolean,
  ): Observable<ApiResponse<PublicAdmissionOffer>> {
    return this.api.post<ApiResponse<PublicAdmissionOffer>, { accepted: boolean }>(
      API.ADMISSIONS.PUBLIC_OFFER_RESPONSE(tenantSlug, token),
      { accepted },
    );
  }

  listInquiries(yearPublicUuid: string): Observable<AdmissionInquiry[]> {
    return this.api.get<AdmissionInquiry[]>(API.ADMISSIONS.INQUIRIES(yearPublicUuid));
  }

  createPresentialInquiry(
    yearPublicUuid: string,
    request: CreatePresentialInquiry,
  ): Observable<ApiResponse<AdmissionInquiry>> {
    return this.api.post<ApiResponse<AdmissionInquiry>, CreatePresentialInquiry>(
      API.ADMISSIONS.INQUIRIES(yearPublicUuid),
      request,
    );
  }

  inquiryHistory(inquiryPublicUuid: string): Observable<AdmissionInquiryEvent[]> {
    return this.api.get<AdmissionInquiryEvent[]>(API.ADMISSIONS.INQUIRY_HISTORY(inquiryPublicUuid));
  }

  updateInquiry(
    inquiryPublicUuid: string,
    status: string,
    note?: string,
    followUp?: { responsibleName: string; nextAttentionDate: string | null; nextAction: string },
  ): Observable<ApiResponse<AdmissionInquiry>> {
    const request = { status, note, ...followUp, updateFollowUp: !!followUp };
    return this.api.patch<ApiResponse<AdmissionInquiry>, typeof request>(
      API.ADMISSIONS.INQUIRY(inquiryPublicUuid),
      request,
    );
  }

  convertInquiry(
    inquiryPublicUuid: string,
    request: CreateAdmissionFromInquiry,
  ): Observable<ApiResponse<AdmissionApplication>> {
    return this.api.post<ApiResponse<AdmissionApplication>, CreateAdmissionFromInquiry>(
      API.ADMISSIONS.CONVERT_INQUIRY(inquiryPublicUuid),
      request,
    );
  }

  createPresential(
    yearPublicUuid: string,
    gradePublicUuid: string,
    applicant: CreateAdmissionFromInquiry,
  ): Observable<ApiResponse<AdmissionApplication>> {
    return this.api.post<
      ApiResponse<AdmissionApplication>,
      { gradePublicUuid: string; applicant: CreateAdmissionFromInquiry }
    >(
      `${API.ADMISSIONS.APPLICATIONS(yearPublicUuid).replace(/applications$/, 'presential-applications')}`,
      { gradePublicUuid, applicant },
    );
  }

  issueOfferLink(applicationPublicUuid: string): Observable<ApiResponse<AdmissionOfferLink>> {
    return this.api.post<ApiResponse<AdmissionOfferLink>>(
      API.ADMISSIONS.OFFER_LINK(applicationPublicUuid),
    );
  }

  completeEnrollment(
    applicationPublicUuid: string,
    request: { sectionPublicUuid: string; enrolledAt: string; notes?: string },
  ): Observable<ApiResponse<AdmissionEnrollmentCompletion>> {
    return this.api.post<ApiResponse<AdmissionEnrollmentCompletion>, typeof request>(
      API.ADMISSIONS.COMPLETE_ENROLLMENT(applicationPublicUuid),
      request,
    );
  }

  retryEnrollmentSetup(applicationPublicUuid: string): Observable<ApiResponse<AdmissionEnrollmentCompletion>> {
    return this.api.post<ApiResponse<AdmissionEnrollmentCompletion>>(
      API.ADMISSIONS.RETRY_ENROLLMENT_SETUP(applicationPublicUuid),
    );
  }

  detail(applicationPublicUuid: string): Observable<ApiResponse<AdmissionApplicationDetail>> {
    return this.api.get<ApiResponse<AdmissionApplicationDetail>>(
      API.ADMISSIONS.APPLICATION(applicationPublicUuid),
    );
  }

  updateApplicant(
    applicationPublicUuid: string,
    applicant: CreateAdmissionFromInquiry,
    reason: string,
  ): Observable<ApiResponse<AdmissionApplication>> {
    return this.api.patch<
      ApiResponse<AdmissionApplication>,
      { applicant: CreateAdmissionFromInquiry; reason: string }
    >(`${API.ADMISSIONS.APPLICATION(applicationPublicUuid)}/applicant`, { applicant, reason });
  }

  sectionVacancies(
    yearPublicUuid: string,
    gradePublicUuid: string,
  ): Observable<AdmissionSectionVacancy[]> {
    const url = API.ADMISSIONS.APPLICATIONS(yearPublicUuid).replace(
      /applications$/,
      `grades/${encodeURIComponent(gradePublicUuid)}/sections`,
    );
    return this.api
      .get<ApiResponse<AdmissionSectionVacancy[]>>(url)
      .pipe(map((response) => response.data));
  }

  list(yearPublicUuid: string): Observable<AdmissionApplication[]> {
    return this.api.get<AdmissionApplication[]>(API.ADMISSIONS.APPLICATIONS(yearPublicUuid));
  }

  vacancies(yearPublicUuid: string): Observable<GradeVacancy[]> {
    return this.api.get<GradeVacancy[]>(API.ADMISSIONS.VACANCIES(yearPublicUuid));
  }

  reservations(yearPublicUuid: string): Observable<AdmissionReservation[]> {
    return this.api.get<AdmissionReservation[]>(API.ADMISSIONS.RESERVATIONS(yearPublicUuid));
  }

  reserve(applicationPublicUuid: string, expiresAt: string, reason?: string): Observable<ApiResponse<AdmissionReservation>> {
    return this.api.post<ApiResponse<AdmissionReservation>, { expiresAt: string; reason?: string }>(
      API.ADMISSIONS.APPLICATION_RESERVATION(applicationPublicUuid),
      { expiresAt, reason },
    );
  }

  releaseReservation(reservationPublicUuid: string, reason?: string): Observable<ApiResponse<AdmissionReservation>> {
    return this.api.patch<ApiResponse<AdmissionReservation>, { status: 'RELEASED'; reason?: string }>(
      API.ADMISSIONS.RESERVATION(reservationPublicUuid),
      { status: 'RELEASED', reason },
    );
  }

  reservationAdvances(reservationPublicUuid: string): Observable<AdmissionReservationAdvance[]> {
    return this.api.get<AdmissionReservationAdvance[]>(
      API.ADMISSIONS.RESERVATION_ADVANCES(reservationPublicUuid),
    );
  }

  reservationAdvanceEvents(reservationPublicUuid: string): Observable<AdmissionReservationAdvanceEvent[]> {
    return this.api.get<AdmissionReservationAdvanceEvent[]>(
      API.ADMISSIONS.RESERVATION_ADVANCE_EVENTS(reservationPublicUuid),
    );
  }

  recordReservationAdvance(
    reservationPublicUuid: string,
    request: { amountCents: number; method: AdmissionReservationAdvance['method']; reference?: string; notes?: string },
  ): Observable<ApiResponse<AdmissionReservationAdvance>> {
    return this.api.post<ApiResponse<AdmissionReservationAdvance>, typeof request>(
      API.ADMISSIONS.RESERVATION_ADVANCES(reservationPublicUuid),
      request,
    );
  }

  refundReservationAdvance(
    reservationPublicUuid: string,
    advancePublicUuid: string,
    request: { reference: string; notes?: string },
  ): Observable<ApiResponse<AdmissionReservationAdvance>> {
    return this.api.post<ApiResponse<AdmissionReservationAdvance>, typeof request>(
      API.ADMISSIONS.RESERVATION_ADVANCE_REFUND(reservationPublicUuid, advancePublicUuid),
      request,
    );
  }

  create(
    yearPublicUuid: string,
    request: CreateAdmissionApplication,
  ): Observable<ApiResponse<AdmissionApplication>> {
    return this.api.post<ApiResponse<AdmissionApplication>, CreateAdmissionApplication>(
      API.ADMISSIONS.APPLICATIONS(yearPublicUuid),
      request,
    );
  }

  transition(
    applicationPublicUuid: string,
    status: string,
    note?: string,
  ): Observable<ApiResponse<AdmissionApplication>> {
    return this.api.patch<ApiResponse<AdmissionApplication>, { status: string; note?: string }>(
      API.ADMISSIONS.STATUS(applicationPublicUuid),
      { status, note },
    );
  }

  linkEnrollment(
    applicationPublicUuid: string,
    enrollmentPublicUuid: string,
  ): Observable<ApiResponse<AdmissionApplication>> {
    return this.api.post<ApiResponse<AdmissionApplication>, { enrollmentPublicUuid: string }>(
      API.ADMISSIONS.ENROLLMENT(applicationPublicUuid),
      { enrollmentPublicUuid },
    );
  }

  history(applicationPublicUuid: string): Observable<AdmissionStatusEvent[]> {
    return this.api.get<AdmissionStatusEvent[]>(API.ADMISSIONS.HISTORY(applicationPublicUuid));
  }
}

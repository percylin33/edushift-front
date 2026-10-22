import { AdmissionApplicationDetail } from '../models';

export const detailFixture: AdmissionApplicationDetail = {
  application: {
    publicUuid: 'application',
    studentPublicUuid: null,
    studentFullName: 'Alumno QA',
    academicYearPublicUuid: 'year',
    academicYearName: '2026',
    gradePublicUuid: 'grade',
    gradeName: 'Primero',
    status: 'RECEIVED',
    source: 'IN_PERSON',
    submittedAt: '2026-10-21T12:00:00Z',
    lastStatusNote: null,
    enrollmentPublicUuid: null,
    createdAt: null,
    updatedAt: null,
    offerStatus: 'NOT_REQUIRED',
    offerSentAt: null,
    offerReminderDueAt: null,
    offerResponseAt: null,
  },
  student: {
    fullName: 'Alumno QA',
    documentType: 'DNI',
    documentNumber: '90000101',
    birthDate: '2020-01-01',
    gender: 'MALE',
  },
  guardians: [
    {
      fullName: 'Madre QA',
      documentType: 'DNI',
      documentNumber: '90000201',
      phone: '987654321',
      email: null,
      relationship: 'MOTHER',
    },
  ],
  inquiry: {
    publicUuid: 'inquiry',
    contactName: 'Familia QA',
    contactValue: '987654321',
    academicYearName: '2026',
    gradeName: 'Primero',
    createdAt: null,
    note: null,
    history: [
      {
        fromStatus: 'RECEIVED',
        toStatus: 'CONTACTED',
        note: 'Presencial: visita al colegio',
        actorUserId: null,
        actorType: 'STAFF',
        createdAt: '2026-10-21T12:00:00Z',
      },
    ],
  },
  history: [
    {
      fromStatus: null,
      toStatus: 'RECEIVED',
      note: 'Solicitud creada',
      actorUserId: 'staff',
      createdAt: '2026-10-21T12:00:00Z',
    },
  ],
};

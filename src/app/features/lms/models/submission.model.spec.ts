import {
  SubmissionResponseRaw,
  SubmissionSummaryRaw,
  SubmissionStatus,
  toSubmission,
  toSubmissionRow,
  toBucket,
  canResubmit,
  MAX_ATTACHMENT_SIZE_BYTES,
  ALLOWED_ATTACHMENT_MIME,
} from './submission.model';

describe('submission.model', () => {
  describe('toSubmission', () => {
    it('parsea ISO strings a Date y normaliza nulls', () => {
      const raw: SubmissionResponseRaw = {
        publicUuid: 'sub-1',
        assignmentPublicUuid: 'a-1',
        studentPublicUuid: 'st-1',
        submittedByUserPublicUuid: 'u-1',
        submittedForStudentPublicUuid: null,
        status: SubmissionStatus.Submitted,
        textContent: 'Mi respuesta',
        attachment: null,
        version: 1,
        grade: null,
        feedback: null,
        submittedAt: '2026-01-15T10:00:00.000Z',
        gradedAt: null,
        gradedByTeacherPublicUuid: null,
        returnedAt: null,
        returnedByTeacherPublicUuid: null,
      };
      const sub = toSubmission(raw);
      expect(sub.submittedAt).toBeInstanceOf(Date);
      expect(sub.status).toBe(SubmissionStatus.Submitted);
      expect(sub.grade).toBeNull();
      expect(sub.attachment).toBeNull();
    });

    it('mapea attachment correctamente', () => {
      const raw: SubmissionResponseRaw = {
        publicUuid: 'sub-1',
        assignmentPublicUuid: 'a-1',
        studentPublicUuid: 'st-1',
        submittedByUserPublicUuid: 'u-1',
        submittedForStudentPublicUuid: null,
        status: SubmissionStatus.Submitted,
        textContent: null,
        attachment: {
          publicUuid: 'att-1',
          filename: 'tarea.pdf',
          sizeBytes: 1024,
          contentType: 'application/pdf',
          downloadUrl: 'https://dl.example.com/file',
        },
        version: 1,
        grade: null,
        feedback: null,
        submittedAt: '2026-01-15T10:00:00.000Z',
        gradedAt: null,
        gradedByTeacherPublicUuid: null,
        returnedAt: null,
        returnedByTeacherPublicUuid: null,
      };
      const sub = toSubmission(raw);
      expect(sub.attachment?.filename).toBe('tarea.pdf');
      expect(sub.attachment?.downloadUrl).toBe('https://dl.example.com/file');
    });
  });

  describe('toSubmissionRow', () => {
    it('convierte SummaryRaw a row', () => {
      const raw: SubmissionSummaryRaw = {
        publicUuid: 'sub-1',
        studentPublicUuid: 'st-1',
        studentFullName: 'Juan Pérez',
        studentAvatarUrl: null,
        status: SubmissionStatus.Submitted,
        version: 2,
        submittedAt: '2026-01-15T10:00:00.000Z',
        grade: null,
        hasAttachment: true,
      };
      const row = toSubmissionRow(raw);
      expect(row.studentFullName).toBe('Juan Pérez');
      expect(row.submittedAt).toBeInstanceOf(Date);
      expect(row.hasAttachment).toBeTrue();
    });
  });

  describe('canResubmit', () => {
    it('permite re-entrega en Returned', () => {
      expect(canResubmit(SubmissionStatus.Returned, false)).toBeTrue();
    });

    it('permite re-entrega en Graded si allowResubmissions', () => {
      expect(canResubmit(SubmissionStatus.Graded, true)).toBeTrue();
    });

    it('no permite re-entrega en Graded sin allowResubmissions', () => {
      expect(canResubmit(SubmissionStatus.Graded, false)).toBeFalse();
    });

    it('permite re-entrega en Pending (nunca entregado)', () => {
      expect(canResubmit(SubmissionStatus.Pending, false)).toBeTrue();
    });
  });

  describe('toBucket', () => {
    it('mapea Graded a GRADED', () => {
      expect(toBucket(SubmissionStatus.Graded, false)).toBe('GRADED');
    });

    it('mapea Late a LATE', () => {
      expect(toBucket(SubmissionStatus.Late, false)).toBe('LATE');
      expect(toBucket(SubmissionStatus.Pending, true)).toBe('LATE');
    });

    it('mapea Submitted o Returned a SUBMITTED', () => {
      expect(toBucket(SubmissionStatus.Submitted, false)).toBe('SUBMITTED');
      expect(toBucket(SubmissionStatus.Returned, false)).toBe('SUBMITTED');
    });

    it('mapea Pending a PENDING', () => {
      expect(toBucket(SubmissionStatus.Pending, false)).toBe('PENDING');
    });
  });

  describe('constants', () => {
    it('MAX_ATTACHMENT_SIZE_BYTES es 25 MB', () => {
      expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(25 * 1024 * 1024);
    });

    it('ALLOWED_ATTACHMENT_MIME incluye PDF e imágenes', () => {
      expect(ALLOWED_ATTACHMENT_MIME).toContain('application/pdf');
      expect(ALLOWED_ATTACHMENT_MIME).toContain('image/png');
    });
  });
});

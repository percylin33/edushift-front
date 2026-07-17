/**
 * Barrel export for the test entity factories.
 *
 * <p>Pattern: every factory function returns a {@link CreatedEntity}
 * handle with a {@link CreatedEntity.cleanup} method that the spec
 * calls from `afterEach` (or `try { ... } finally { cleanup }`).
 * Uniqueness within a parallel run is guaranteed by
 * {@link seqId} — see {@link _shared.ts}.</p>
 *
 * <h3>Usage</h3>
 *
 * <pre>{@code
 * import { makeStudent, makeAcademicBundle, makeAttendanceSession } from '../../factories';
 *
 * test('TA creates a student', async () => {
 *   const api = await apiContextFor({ user: TENANT_ADMIN });
 *   const student = await makeStudent(api);
 *   try {
 *     // ... test body
 *   } finally {
 *     await student.cleanup();
 *     await api.dispose();
 *   }
 * });
 * }</pre>
 */

export { seqId } from './_shared';
export type { CreatedEntity } from './_shared';
export {
  makeStudent,
  makeGuardianLink,
  type StudentOverrides,
  type CreatedStudent,
} from './student.factory';
export {
  makeTeacher,
  makeTeacherUserLink,
  makeTeacherAssignment,
  type TeacherOverrides,
  type CreatedTeacher,
} from './teacher.factory';
export {
  makeAcademicYear,
  makeAcademicLevel,
  makeGrade,
  makeSection,
  makeCourse,
  makeUnit,
  makeAcademicPeriod,
  makeAcademicBundle,
  type AcademicBundle,
} from './section.factory';
export {
  makeLearningSession,
  makeEvaluation,
  makeGradeRecord,
} from './session.factory';
export {
  makeAttendanceSession,
  makeManualCheckIn,
  makeJustification,
  type AttendanceStatus,
} from './attendance.factory';
export {
  makeTask,
  makeSubmission,
  makeMaterial,
  makeQuiz,
  makeQuizQuestion,
  makeReadyQuiz,
} from './lms.factory';
export {
  makeAnnouncement,
} from './announcement.factory';
export {
  makeInvoice,
} from './payment.factory';
export {
  makeChatSession,
  callGeneration,
  type AiGeneration,
} from './ai.factory';

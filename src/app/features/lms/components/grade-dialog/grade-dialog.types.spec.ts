import { GradeMode, GradeSubmissionRequest } from './grade-dialog.types';

describe('grade-dialog.types', () => {
  it('GradeMode acepta Grade y Return', () => {
    const mode1: GradeMode = 'Grade';
    const mode2: GradeMode = 'Return';
    expect(mode1).toBe('Grade');
    expect(mode2).toBe('Return');
  });

  it('GradeSubmissionRequest tiene grade y feedback', () => {
    const req: GradeSubmissionRequest = { grade: 15, feedback: 'Bien' };
    expect(req.grade).toBe(15);
    expect(req.feedback).toBe('Bien');
  });
});

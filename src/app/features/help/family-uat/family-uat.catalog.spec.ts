import { FAMILY_UAT_SCRIPTS, familyUatScriptFor, familyUatStepCount } from './family-uat.catalog';
import type { RoleKey } from '../models/qa.model';

describe('FAMILY_UAT_SCRIPTS catalog', () => {
  const expectedRoles: RoleKey[] = [
    'super-admin',
    'tenant-admin',
    'teacher',
    'student',
    'parent',
    'staff',
  ];

  it('exposes exactly the six product roles', () => {
    expect(FAMILY_UAT_SCRIPTS.map((s) => s.roleKey)).toEqual(expectedRoles);
  });

  it('uses friendly titles (no raw enum codes as card title)', () => {
    expect(familyUatScriptFor('teacher')?.title).toBe('Docente');
    expect(familyUatScriptFor('student')?.title).toBe('Estudiante');
    expect(familyUatScriptFor('parent')?.title).toContain('Padre');
  });

  it('gives every role at least one step with an in-app route and routeLabel', () => {
    for (const script of FAMILY_UAT_SCRIPTS) {
      const withRoute = script.blocks.flatMap((b) => b.steps).filter((s) => !!s.route);
      expect(withRoute.length).withContext(script.roleKey).toBeGreaterThan(0);
      expect(withRoute.every((s) => !!s.routeLabel)).withContext(script.roleKey).toBe(true);
    }
  });

  it('covers smoke + happy + negative for every role', () => {
    for (const script of FAMILY_UAT_SCRIPTS) {
      const kinds = new Set(script.blocks.map((b) => b.kind));
      expect(kinds.has('smoke')).withContext(script.roleKey).toBe(true);
      expect(kinds.has('happy')).withContext(script.roleKey).toBe(true);
      expect(kinds.has('negative')).withContext(script.roleKey).toBe(true);
    }
  });

  it('resolves scripts by roleKey and counts steps', () => {
    expect(familyUatScriptFor('student')?.code).toBe('ST');
    const student = familyUatScriptFor('student')!;
    expect(familyUatStepCount(student)).toBeGreaterThan(10);
  });

  it('uses plain-language step fields (Qué hacer / Cómo saber)', () => {
    const parent = familyUatScriptFor('parent')!;
    const step = parent.blocks.flatMap((b) => b.steps)[0];
    expect(step.do.length).toBeGreaterThan(20);
    expect(step.verify.length).toBeGreaterThan(10);
    expect(step.do.toLowerCase()).not.toContain('jwt');
    expect(step.do.toLowerCase()).not.toContain('http');
  });
});

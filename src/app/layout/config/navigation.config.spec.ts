import { NAVIGATION_GROUPS } from './navigation.config';

describe('NAVIGATION_GROUPS', () => {
  it('es un array con grupos', () => {
    expect(Array.isArray(NAVIGATION_GROUPS)).toBeTrue();
    expect(NAVIGATION_GROUPS.length).toBeGreaterThan(0);
  });

  it('cada grupo tiene id único', () => {
    const ids = NAVIGATION_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada grupo tiene items', () => {
    for (const group of NAVIGATION_GROUPS) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it('cada item tiene id único por grupo', () => {
    for (const group of NAVIGATION_GROUPS) {
      const ids = group.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('los items con children tienen rutas', () => {
    for (const group of NAVIGATION_GROUPS) {
      for (const item of group.items) {
        if (item.children) {
          expect(item.route).toBeDefined();
        }
      }
    }
  });
});

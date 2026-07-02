import { NavigationItem, NavigationGroup } from './navigation.model';

describe('NavigationItem', () => {
  it('crea un item básico', () => {
    const item: NavigationItem = { id: 'test', label: 'Test', route: '/test' };
    expect(item.id).toBe('test');
    expect(item.label).toBe('Test');
  });

  it('permite children', () => {
    const item: NavigationItem = {
      id: 'parent',
      label: 'Parent',
      children: [{ id: 'child', label: 'Child', route: '/child' }],
    };
    expect(item.children?.length).toBe(1);
  });

  it('permite propiedades opcionales', () => {
    const item: NavigationItem = {
      id: 'test',
      label: 'Test',
      icon: 'home',
      route: '/test',
      badge: 'Nuevo',
      exactMatch: true,
      feature: 'dashboard' as any,
      roles: ['TENANT_ADMIN'] as any,
      permissions: ['users:read'] as any,
    };
    expect(item.icon).toBe('home');
    expect(item.badge).toBe('Nuevo');
  });
});

describe('NavigationGroup', () => {
  it('crea un grupo con items', () => {
    const group: NavigationGroup = {
      id: 'main',
      label: 'Principal',
      items: [{ id: 'test', label: 'Test', route: '/test' }],
    };
    expect(group.id).toBe('main');
    expect(group.items.length).toBe(1);
  });

  it('label es opcional', () => {
    const group: NavigationGroup = {
      id: 'main',
      items: [],
    };
    expect(group.label).toBeUndefined();
  });
});

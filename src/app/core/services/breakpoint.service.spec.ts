import { TestBed } from '@angular/core/testing';
import { BreakpointService } from './breakpoint.service';

describe('BreakpointService', () => {
  let service: BreakpointService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BreakpointService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  it('current es una cadena no vacía', () => {
    expect(typeof service.current()).toBe('string');
    expect(service.current().length).toBeGreaterThan(0);
  });

  it('isMobile, isTablet, isDesktop son booleanos', () => {
    expect(typeof service.isMobile()).toBe('boolean');
    expect(typeof service.isTablet()).toBe('boolean');
    expect(typeof service.isDesktop()).toBe('boolean');
  });

  it('atLeast retorna un computed signal', () => {
    const result = service.atLeast('md');
    expect(typeof result()).toBe('boolean');
  });

  it('below retorna un computed signal', () => {
    const result = service.below('lg');
    expect(typeof result()).toBe('boolean');
  });
});

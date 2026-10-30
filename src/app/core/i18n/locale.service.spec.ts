import { TestBed } from '@angular/core/testing';
import { LocaleService } from './locale.service';

describe('LocaleService', () => {
  let service: LocaleService;

  beforeEach(() => {
    spyOnProperty(window.navigator, 'language', 'get').and.returnValue('es-PE');
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocaleService);
  });

  it('defaults to es-PE', () => {
    expect(service.current()).toBe('es-PE');
  });

  it('exposes es-PE and en-US as available options', () => {
    const codes = service.available.map(opt => opt.code);
    expect(codes).toContain('es-PE');
    expect(codes).toContain('en-US');
  });

  it('set() updates the signal and persists to localStorage', () => {
    service.set('en-US');
    expect(service.current()).toBe('en-US');
    expect(localStorage.getItem('edushift.locale')).toBe('en-US');
  });

  it('set() is idempotent (no-op when same code)', () => {
    service.set('en-US');
    const first = service.current();
    service.set('en-US');
    expect(service.current()).toBe(first);
  });

  it('updates document.documentElement.lang on set()', () => {
    service.set('en-US');
    expect(document.documentElement.lang).toBe('en-US');
    expect(document.documentElement.getAttribute('data-locale')).toBe('en-US');
  });

  it('set() no-ops gracefully when localStorage is unavailable', () => {
    const original = localStorage;
    const failingStorage = {
      ...original,
      setItem: () => { throw new Error('quota'); },
    };
    spyOnProperty(window, 'localStorage', 'get').and.returnValue(failingStorage as Storage);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = TestBed.runInInjectionContext(() => new LocaleService());
    expect(() => service.set('en-US')).not.toThrow();
    expect(service.current()).toBe('en-US');
  });
});

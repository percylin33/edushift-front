import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [StorageService] });
    service = TestBed.inject(StorageService);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('set/get local storage', () => {
    service.set('key1', { foo: 'bar' });
    expect(service.get<{ foo: string }>('key1')).toEqual({ foo: 'bar' });
  });

  it('set/get session storage', () => {
    service.set('key1', 42, 'session');
    expect(service.get<number>('key1', 'session')).toBe(42);
  });

  it('get retorna null para key inexistente', () => {
    expect(service.get('nonexistent')).toBeNull();
  });

  it('get retorna null si el JSON es inválido', () => {
    localStorage.setItem('corrupt', '{bad');
    expect(service.get('corrupt')).toBeNull();
  });

  it('remove borra la key', () => {
    service.set('key1', 'val');
    service.remove('key1');
    expect(service.get('key1')).toBeNull();
  });

  it('remove en session storage', () => {
    service.set('key1', 'val', 'session');
    service.remove('key1', 'session');
    expect(service.get('key1', 'session')).toBeNull();
  });

  it('clear vacía todo', () => {
    service.set('a', 1);
    service.set('b', 2);
    service.clear();
    expect(service.get('a')).toBeNull();
    expect(service.get('b')).toBeNull();
  });

  it('clear session storage', () => {
    service.set('a', 1, 'session');
    service.clear('session');
    expect(service.get('a', 'session')).toBeNull();
  });

  it('get retorna null si localStorage.getItem lanza', () => {
    spyOn(localStorage, 'getItem').and.throwError('fail');
    expect(service.get('key')).toBeNull();
  });

  it('set traga errores de localStorage.setItem', () => {
    spyOn(localStorage, 'setItem').and.throwError('quota');
    expect(() => service.set('key', 'val')).not.toThrow();
  });
});

import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthStore } from './auth.store';

describe('AuthStore', () => {
  let store: AuthStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AuthStore] });
    store = TestBed.inject(AuthStore);
  });

  it('inicia con loading=false y error=null', () => {
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.hasError()).toBeFalse();
  });

  it('setLoading actualiza loading', () => {
    store.setLoading(true);
    expect(store.loading()).toBeTrue();

    store.setLoading(false);
    expect(store.loading()).toBeFalse();
  });

  it('setError actualiza error y hasError', () => {
    store.setError('Algo salió mal');
    expect(store.error()).toBe('Algo salió mal');
    expect(store.hasError()).toBeTrue();

    store.setError(null);
    expect(store.error()).toBeNull();
    expect(store.hasError()).toBeFalse();
  });

  it('reset vuelve al estado inicial', () => {
    store.setLoading(true);
    store.setError('error');
    store.reset();

    expect(store.loading()).toBeFalse();
    expect(store.error()).toBeNull();
    expect(store.hasError()).toBeFalse();
  });

  it('beginSubmit pone loading=true y limpia error', () => {
    store.setError('previo');
    store.beginSubmit();
    expect(store.loading()).toBeTrue();
    expect(store.error()).toBeNull();
  });

  it('failSubmit pone loading=false y mapea el error HTTP a mensaje', () => {
    store.beginSubmit();
    const err = new HttpErrorResponse({
      status: 401,
      error: { code: 'BAD_CREDENTIALS' },
    });
    store.failSubmit(err);
    expect(store.loading()).toBeFalse();
    expect(store.error()).toBe('Correo o contraseña incorrectos.');
  });

  it('failSubmit respeta opts.fallback', () => {
    store.beginSubmit();
    const err = new HttpErrorResponse({ status: 418 });
    store.failSubmit(err, { fallback: 'teapot' });
    expect(store.error()).toBe('teapot');
  });

  it('failSubmit mapea status 0 a mensaje de red', () => {
    store.beginSubmit();
    store.failSubmit(new HttpErrorResponse({ status: 0 }));
    expect(store.error()).toContain('conexión');
  });
});
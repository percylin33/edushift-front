import { TestBed } from '@angular/core/testing';
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
});

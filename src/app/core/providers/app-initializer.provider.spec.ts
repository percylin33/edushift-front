import { APP_INITIALIZER } from '@angular/core';
import { APP_INITIALIZER_PROVIDER } from './app-initializer.provider';

describe('APP_INITIALIZER_PROVIDER', () => {
  const provider = APP_INITIALIZER_PROVIDER as any;

  it('define un provider para APP_INITIALIZER', () => {
    expect(provider.provide).toBe(APP_INITIALIZER);
  });

  it('es multi provider', () => {
    expect(provider.multi).toBeTrue();
  });

  it('tiene una useFactory definida', () => {
    expect(typeof provider.useFactory).toBe('function');
  });
});

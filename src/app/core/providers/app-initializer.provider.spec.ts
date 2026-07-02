import { APP_INITIALIZER_PROVIDER } from './app-initializer.provider';

describe('APP_INITIALIZER_PROVIDER', () => {
  it('define un provider para APP_INITIALIZER', () => {
    expect(APP_INITIALIZER_PROVIDER.provide).toBe(APP_INITIALIZER);
  });

  it('es multi provider', () => {
    expect(APP_INITIALIZER_PROVIDER.multi).toBeTrue();
  });

  it('tiene una useFactory definida', () => {
    expect(typeof APP_INITIALIZER_PROVIDER.useFactory).toBe('function');
  });
});

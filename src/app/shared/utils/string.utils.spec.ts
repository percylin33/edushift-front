import { isEmpty, capitalize, slugify } from './string.utils';

describe('isEmpty', () => {
  it('retorna true para null', () => {
    expect(isEmpty(null)).toBeTrue();
  });

  it('retorna true para undefined', () => {
    expect(isEmpty(undefined)).toBeTrue();
  });

  it('retorna true para string vacío', () => {
    expect(isEmpty('')).toBeTrue();
  });

  it('retorna true para solo espacios', () => {
    expect(isEmpty('   ')).toBeTrue();
  });

  it('retorna false para string con contenido', () => {
    expect(isEmpty('hola')).toBeFalse();
  });
});

describe('capitalize', () => {
  it('capitaliza la primera letra', () => {
    expect(capitalize('hola')).toBe('Hola');
  });

  it('retorna string vacío para input vacío', () => {
    expect(capitalize('')).toBe('');
  });

  it('no modifica el resto del string', () => {
    expect(capitalize('hola mundo')).toBe('Hola mundo');
  });

  it('no cambia mayúscula existente', () => {
    expect(capitalize('Hola')).toBe('Hola');
  });
});

describe('slugify', () => {
  it('convierte texto a slug', () => {
    expect(slugify('Hola Mundo')).toBe('hola-mundo');
  });

  it('elimina acentos', () => {
    expect(slugify('José Martínez')).toBe('jose-martinez');
  });

  it('elimina caracteres especiales', () => {
    expect(slugify('¿Qué es?')).toBe('que-es');
  });

  it('maneja múltiples espacios y guiones', () => {
    expect(slugify('  Hola   Mundo  ')).toBe('hola-mundo');
  });
});

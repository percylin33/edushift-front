import { InitialsPipe } from './initials.pipe';

describe('InitialsPipe', () => {
  let pipe: InitialsPipe;

  beforeEach(() => {
    pipe = new InitialsPipe();
  });

  it('crea una instancia', () => {
    expect(pipe).toBeTruthy();
  });

  it('retorna string vacío para null', () => {
    expect(pipe.transform(null)).toBe('');
  });

  it('retorna string vacío para undefined', () => {
    expect(pipe.transform(undefined)).toBe('');
  });

  it('retorna string vacío para string vacío', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('extrae iniciales de nombre completo', () => {
    expect(pipe.transform('Juan Pérez')).toBe('JP');
  });

  it('extrae iniciales de nombre con múltiples apellidos', () => {
    expect(pipe.transform('María de los Ángeles García')).toBe('MA');
  });

  it('respeta el límite de max caracteres', () => {
    expect(pipe.transform('Juan Carlos Pérez', 3)).toBe('JCP');
    expect(pipe.transform('Juan Pérez', 1)).toBe('J');
  });

  it('convierte a mayúsculas', () => {
    expect(pipe.transform('ana lópez')).toBe('AL');
  });
});

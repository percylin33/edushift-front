import { isValidDate, toISO } from './date.utils';

describe('isValidDate', () => {
  it('retorna true para Date válido', () => {
    expect(isValidDate(new Date())).toBeTrue();
  });

  it('retorna true para Date con fecha específica', () => {
    expect(isValidDate(new Date('2024-01-01'))).toBeTrue();
  });

  it('retorna false para Date inválido', () => {
    expect(isValidDate(new Date('invalid'))).toBeFalse();
  });

  it('retorna false para null', () => {
    expect(isValidDate(null)).toBeFalse();
  });

  it('retorna false para string', () => {
    expect(isValidDate('2024-01-01')).toBeFalse();
  });

  it('retorna false para undefined', () => {
    expect(isValidDate(undefined)).toBeFalse();
  });
});

describe('toISO', () => {
  it('convierte Date a ISO string', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(toISO(date)).toBe('2024-01-15T10:30:00.000Z');
  });

  it('convierte string a ISO string', () => {
    expect(toISO('2024-01-15')).toBe('2024-01-15T00:00:00.000Z');
  });

  it('convierte timestamp numérico a ISO string', () => {
    expect(toISO(1705314600000)).toBeDefined();
  });
});

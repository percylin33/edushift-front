export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function toISO(value: Date | string | number): string {
  return new Date(value).toISOString();
}

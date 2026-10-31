import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome1',
  'admin123', 'root123', 'pass123', 'user123', 'test123',
]);

/** Mirrors the backend password policy so users see actionable feedback before submitting. */
export function passwordPolicyIssues(password: string): string[] {
  if (!password) return [];

  const issues: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push(`Usa al menos ${PASSWORD_MIN_LENGTH} caracteres`);
  if (password.length > PASSWORD_MAX_LENGTH) issues.push(`Reduce la contraseña a ${PASSWORD_MAX_LENGTH} caracteres como máximo`);
  if (!/[A-Z]/.test(password)) issues.push('Agrega una letra mayúscula');
  if (!/[a-z]/.test(password)) issues.push('Agrega una letra minúscula');
  if (!/[0-9]/.test(password)) issues.push('Agrega un número');
  if (isCommonOrSequential(password)) {
    issues.push('Evita contraseñas comunes o secuencias como abc o 123');
  }
  return issues;
}

export function passwordPolicyMessage(password: string): string {
  const issues = passwordPolicyIssues(password);
  return issues.length
    ? `Revisa tu contraseña: ${issues.join('; ')}.`
    : 'La contraseña debe incluir mayúscula, minúscula y número. Evita claves comunes o secuencias como abc o 123.';
}

export const passwordPolicyValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null =>
  passwordPolicyIssues(String(control.value ?? '')).length ? { passwordPolicy: true } : null;

function isCommonOrSequential(password: string): boolean {
  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) return true;

  for (let index = 0; index < normalized.length - 2; index += 1) {
    const first = normalized.charCodeAt(index);
    const second = normalized.charCodeAt(index + 1);
    const third = normalized.charCodeAt(index + 2);
    if ((second === first + 1 && third === second + 1)
      || (second === first - 1 && third === second - 1)) return true;
  }
  return false;
}

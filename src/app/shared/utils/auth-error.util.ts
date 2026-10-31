import { HttpErrorResponse } from '@angular/common/http';
import { ApiError, ApiResponse } from '@core/models';

/**
 * Catalogue of backend error codes that the auth flow needs to render
 * with specific Spanish copy. Each entry maps a stable code (see
 * `docs/modules/auth.md` §6.1) to the localized message displayed
 * to the end user.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  BAD_CREDENTIALS: 'Correo o contraseña incorrectos.',
  TENANT_REQUIRED: 'No se identificó la institución. Recarga la página e inténtalo de nuevo.',
  TENANT_INACTIVE: 'Tu institución está inactiva. Contacta al administrador.',
  TENANT_NOT_FOUND: 'No se encontró la institución solicitada.',
  USER_LOCKED: 'Tu cuenta está bloqueada. Contacta al administrador.',
  USER_TEMPORARILY_LOCKED:
    'Tu cuenta está bloqueada temporalmente por varios intentos fallidos. Espera unos minutos y vuelve a intentarlo.',
  USER_SUSPENDED: 'Tu cuenta está suspendida. Contacta al administrador.',
  USER_INACTIVE: 'Tu cuenta está deshabilitada. Contacta al administrador.',
  USER_NOT_AUTHENTICATABLE: 'No es posible autenticar tu cuenta en este momento.',
  EMAIL_NOT_VERIFIED: 'Verifica tu correo antes de iniciar sesión.',
  VALIDATION_ERROR: 'Revisa los datos ingresados.',
  GOOGLE_PROVIDER_DISABLED: 'El inicio de sesión con Google no está disponible en este momento.',
  INVALID_GOOGLE_TOKEN: 'La sesión con Google expiró o es inválida. Vuelve a intentarlo.',
  TENANT_SLUG_TAKEN: 'Este identificador ya está en uso. Elige otro.',
  CUSTOM_DOMAIN_TAKEN: 'El dominio personalizado ya está en uso.',
  EMAIL_TAKEN: 'Ya existe una cuenta con este correo.',
  USER_EMAIL_TAKEN: 'Ya existe una cuenta con este correo.',
  PASSWORD_CONFIRM_MISMATCH: 'Las contraseñas no coinciden.',
  INVITATION_ALREADY_PENDING: 'Ya existe una invitación pendiente para este correo.',
  INVITATION_ALREADY_ACCEPTED: 'Esta invitación ya fue aceptada. Inicia sesión con tu cuenta.',
  INVITATION_CANCELLED: 'Esta invitación fue cancelada. Pide al administrador que te envíe otra.',
  INVITATION_EXPIRED: 'El enlace de invitación venció. Pide al administrador que te envíe otro.',
  INVITATION_TENANT_MISMATCH: 'Este enlace pertenece a otra institución. Abre el enlace original que recibiste.',
  SCHOOL_INVITATION_ALREADY_ACCEPTED: 'Esta invitación ya fue aceptada. Inicia sesión con tu cuenta.',
  SCHOOL_INVITATION_CANCELLED: 'Esta invitación fue cancelada. Solicita un enlace nuevo.',
  SCHOOL_INVITATION_EXPIRED: 'El enlace de invitación venció. Solicita uno nuevo.',
  SCHOOL_INVITATION_ALREADY_PENDING: 'Ya existe una invitación pendiente para este correo.',
  WEAK_PASSWORD:
    'La contraseña necesita al menos 8 caracteres e incluir mayúscula, minúscula y número. Evita claves comunes o secuencias como abc o 123.',
  MFA_ALREADY_ENABLED: 'MFA ya está activado. Recarga la página.',
  MFA_TOKEN_MISSING: 'Tu sesión MFA ha expirado. Vuelve a iniciar sesión.',
  MFA_TOKEN_INVALID: 'Tu sesión MFA ha expirado. Vuelve a iniciar sesión.',
};

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Verifica tu conexión.';
export const SERVER_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';
export const FORBIDDEN_ERROR_MESSAGE =
  'No tienes permiso para realizar esta acción. Si la necesitas para tu trabajo, solicítala al director o al administrador del colegio.';

export interface HttpErrorOptions {
  /** Custom message for HTTP 429 (rate limit). */
  rateLimit?: string;
  /** Custom message for HTTP 5xx. */
  serverError?: string;
  /** Final fallback message when nothing else matched. */
  fallback?: string;
}

/**
 * Extracts the first {@link ApiError} from the backend's response envelope.
 * The backend can ship errors either as a wrapped `ApiResponse`
 * (newer style with `errors: [...]`) or as a flat `ApiError`
 * (older style). We accept both shapes so callers don't have to care
 * about the boundary.
 */
export function extractApiError(err: HttpErrorResponse): ApiError | null {
  const body = err.error as
    | (ApiResponse<unknown> & { errors?: ApiError[] })
    | ApiError
    | null
    | undefined;

  if (body && typeof body === 'object') {
    if ('errors' in body && Array.isArray(body.errors) && body.errors.length > 0) {
      return body.errors[0];
    }
    if ('code' in body || 'message' in body) {
      return body as ApiError;
    }
  }
  return null;
}

/**
 * Map a {@link HttpErrorResponse} to a user-facing Spanish message.
 *
 * <p>Resolution order:
 * <ol>
 *   <li>status === 0 → {@link NETWORK_ERROR_MESSAGE}</li>
 *   <li>BE-supplied {@link ApiError#code} → lookup in {@link AUTH_ERROR_MESSAGES}</li>
 *   <li>status-specific fallbacks (404, 401, 429, 5xx)</li>
 *   <li>BE `message` field → used verbatim</li>
 *   <li>`opts.fallback` → final fallback</li>
 * </ol>
 */
export function mapHttpError(err: HttpErrorResponse, opts: HttpErrorOptions = {}): string {
  if (err.status === 0) {
    return opts.fallback ?? NETWORK_ERROR_MESSAGE;
  }

  const apiError = extractApiError(err);
  const code = apiError?.code;
  const backendMessage = apiError?.message;

  if (code === 'VALIDATION_ERROR' && backendMessage && !isGenericBackendMessage(backendMessage)) {
    return backendMessage;
  }

  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  if (err.status === 429) {
    return opts.rateLimit ?? 'Has realizado demasiadas solicitudes. Espera unos minutos.';
  }
  if (err.status === 404) {
    return (backendMessage && !isGenericBackendMessage(backendMessage))
      ? backendMessage : opts.fallback ?? 'No encontramos lo que buscas. Revisa el enlace e inténtalo de nuevo.';
  }
  if (err.status === 401) {
    return (backendMessage && !isGenericBackendMessage(backendMessage))
      ? backendMessage : opts.fallback ?? 'No se pudo validar tu acceso. Revisa tus datos e inténtalo de nuevo.';
  }
  if (err.status === 403) {
    return (backendMessage && !isGenericBackendMessage(backendMessage))
      ? backendMessage
      : opts.fallback ?? FORBIDDEN_ERROR_MESSAGE;
  }
  if (err.status === 409 && (!backendMessage || isGenericBackendMessage(backendMessage))) {
    return opts.fallback ?? 'No se pudo completar porque la información ya existe o cambió. Actualiza e inténtalo de nuevo.';
  }
  if (err.status === 400 && (!backendMessage || isGenericBackendMessage(backendMessage))) {
    return opts.fallback ?? 'Revisa los datos ingresados y corrige los campos señalados.';
  }
  if (err.status >= 500) {
    return opts.serverError ?? SERVER_ERROR_MESSAGE;
  }

  return backendMessage ?? opts.fallback ?? 'Algo salió mal. Intenta nuevamente.';
}

function isGenericBackendMessage(message: string): boolean {
  return [
    'bad request',
    'validation failed',
    'validation error',
    'malformed request',
    'conflict',
    'unauthorized',
    'forbidden',
    'access is denied',
    'not found',
  ].includes(message.trim().toLowerCase());
}

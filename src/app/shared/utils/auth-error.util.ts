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
  MFA_ALREADY_ENABLED: 'MFA ya está activado. Recarga la página.',
  MFA_TOKEN_MISSING: 'Tu sesión MFA ha expirado. Vuelve a iniciar sesión.',
  MFA_TOKEN_INVALID: 'Tu sesión MFA ha expirado. Vuelve a iniciar sesión.',
};

export const NETWORK_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Verifica tu conexión.';
export const SERVER_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intenta nuevamente en unos minutos.';

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

  if (code && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  if (err.status === 429) {
    return opts.rateLimit ?? 'Has realizado demasiadas solicitudes. Espera unos minutos.';
  }
  if (err.status === 404) {
    return backendMessage ?? opts.fallback ?? 'Recurso no encontrado.';
  }
  if (err.status === 401) {
    return backendMessage ?? opts.fallback ?? 'No autorizado. Revisa tus credenciales.';
  }
  if (err.status === 403) {
    return backendMessage ?? opts.fallback ?? 'No tienes permiso para realizar esta acción.';
  }
  if (err.status >= 500) {
    return opts.serverError ?? SERVER_ERROR_MESSAGE;
  }

  return backendMessage ?? opts.fallback ?? 'Algo salió mal. Intenta nuevamente.';
}
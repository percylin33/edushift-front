import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from '@core/models';
import {
  AUTH_ERROR_MESSAGES,
  extractApiError,
  mapHttpError,
  NETWORK_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from './auth-error.util';

function httpError(opts: { status: number; body?: unknown }): HttpErrorResponse {
  return new HttpErrorResponse({ status: opts.status, error: opts.body });
}

describe('extractApiError', () => {
  it('retorna null si el body es null/undefined', () => {
    expect(extractApiError(httpError({ status: 400, body: null }))).toBeNull();
  });

  it('extrae el primer error de un envelope con errors[]', () => {
    const err = httpError({
      status: 400,
      body: {
        success: false,
        data: null,
        errors: [{ status: 400, code: 'BAD_CREDENTIALS', message: 'bad' }],
      },
    });
    expect(extractApiError(err)).toEqual({
      status: 400,
      code: 'BAD_CREDENTIALS',
      message: 'bad',
    });
  });

  it('acepta un ApiError plano', () => {
    const err = httpError({
      status: 401,
      body: { code: 'USER_LOCKED', message: 'locked' },
    });
    const result = extractApiError(err);
    expect(result?.code).toBe('USER_LOCKED');
    expect(result?.message).toBe('locked');
  });

  it('retorna null si el body no es objeto', () => {
    const err = httpError({ status: 500, body: 'server error' });
    expect(extractApiError(err)).toBeNull();
  });

  it('retorna null si errors[] está vacío', () => {
    const err = httpError({ status: 400, body: { errors: [] } });
    expect(extractApiError(err)).toBeNull();
  });
});

describe('mapHttpError', () => {
  it('retorna NETWORK_ERROR_MESSAGE para status 0', () => {
    expect(mapHttpError(httpError({ status: 0 }))).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('mapea BAD_CREDENTIALS al mensaje del catálogo', () => {
    const err = httpError({ status: 401, body: { code: 'BAD_CREDENTIALS' } });
    expect(mapHttpError(err)).toBe(AUTH_ERROR_MESSAGES['BAD_CREDENTIALS']);
  });

  it('mapea TENANT_SLUG_TAKEN', () => {
    const err = httpError({ status: 409, body: { code: 'TENANT_SLUG_TAKEN' } });
    expect(mapHttpError(err)).toContain('identificador');
  });

  it('mapea USER_LOCKED', () => {
    const err = httpError({ status: 403, body: { code: 'USER_LOCKED' } });
    expect(mapHttpError(err)).toContain('bloqueada');
  });

  it('mapea status 429 al mensaje por defecto', () => {
    expect(mapHttpError(httpError({ status: 429 }))).toContain('demasiadas solicitudes');
  });

  it('respeta opts.rateLimit para 429', () => {
    expect(mapHttpError(httpError({ status: 429 }), { rateLimit: 'calm down' })).toBe('calm down');
  });

  it('mapea status 5xx al mensaje por defecto', () => {
    expect(mapHttpError(httpError({ status: 500 }))).toBe(SERVER_ERROR_MESSAGE);
  });

  it('respeta opts.serverError para 5xx', () => {
    expect(mapHttpError(httpError({ status: 503 }), { serverError: 'db down' })).toBe('db down');
  });

  it('usa backend message si no hay code', () => {
    const err = httpError({ status: 400, body: { message: 'custom msg' } });
    expect(mapHttpError(err)).toBe('custom msg');
  });

  it('usa opts.fallback como último recurso', () => {
    expect(mapHttpError(httpError({ status: 418 }), { fallback: 'teapot' })).toBe('teapot');
  });

  it('retorna mensaje genérico si nada aplica', () => {
    expect(mapHttpError(httpError({ status: 418 }))).toContain('Algo salió mal');
  });

  it('prefiere message del backend sobre code genérico cuando code es VALIDATION_ERROR pero body tiene message útil', () => {
    const err = httpError({
      status: 400,
      body: { code: 'VALIDATION_ERROR', message: 'El campo X es requerido' },
    });
    expect(mapHttpError(err)).toBe('El campo X es requerido');
  });
});

describe('AUTH_ERROR_MESSAGES', () => {
  it('incluye códigos canónicos del módulo auth', () => {
    expect(AUTH_ERROR_MESSAGES['BAD_CREDENTIALS']).toBeTruthy();
    expect(AUTH_ERROR_MESSAGES['TENANT_REQUIRED']).toBeTruthy();
    expect(AUTH_ERROR_MESSAGES['USER_LOCKED']).toBeTruthy();
    expect(AUTH_ERROR_MESSAGES['USER_SUSPENDED']).toBeTruthy();
    expect(AUTH_ERROR_MESSAGES['EMAIL_NOT_VERIFIED']).toBeTruthy();
  });
});

// Suppress unused warning for ApiError (kept for type exports)
void (null as unknown as ApiError);
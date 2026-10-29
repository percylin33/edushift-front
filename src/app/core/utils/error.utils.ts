export interface ErrorDetails {
  code?: string;
  message?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function readErrorDetails(error: unknown): ErrorDetails {
  const root = asRecord(error);
  const body = asRecord(root?.['error']) ?? root;
  const code = body?.['code'];
  const responseMessage = body?.['message'];
  const message = typeof responseMessage === 'string'
    ? responseMessage
    : error instanceof Error
      ? error.message
      : undefined;

  return {
    ...(typeof code === 'string' ? { code } : {}),
    ...(message ? { message } : {}),
  };
}

export function readErrorMessage(error: unknown, fallback: string): string {
  return readErrorDetails(error).message ?? fallback;
}

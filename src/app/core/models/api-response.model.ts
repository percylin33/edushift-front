/**
 * Standard envelope returned by the backend for every endpoint.
 * Adjust the shape here when the API contract is finalized.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
  timestamp?: string;
  path?: string;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

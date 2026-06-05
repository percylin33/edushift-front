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

/**
 * Spring Data's {@code Page<T>} JSON contract. Used by listing
 * endpoints that prefer to ship Spring's native shape (so clients can
 * reuse {@code number/size/totalElements} verbatim) instead of the
 * project-internal {@link Paginated} envelope.
 *
 * <p>Currently consumed by {@code GET /v1/users} and
 * {@code GET /v1/students}; lifted to {@code @core/models} so feature
 * modules don't have to import each other to share the type.
 */
export interface SpringPage<T> {
  content: T[];
  /** Zero-based page index. */
  number: number;
  /** Configured page size (rows per page). */
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements: number;
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

type ParamValue = string | number | boolean | null | undefined;
type ParamRecord = Record<string, ParamValue | ParamValue[]>;

/**
 * Thin, tenant-aware HTTP wrapper. Interceptors (auth/tenant/error) take care
 * of cross-cutting concerns; this service centralizes URL composition and
 * query-string serialization so features stay declarative.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(url: string, params?: ParamRecord): Observable<T> {
    return this.http.get<T>(url, { params: this.toParams(params) });
  }

  post<T, B = unknown>(url: string, body?: B): Observable<T> {
    return this.http.post<T>(url, body ?? {});
  }

  put<T, B = unknown>(url: string, body?: B): Observable<T> {
    return this.http.put<T>(url, body ?? {});
  }

  patch<T, B = unknown>(url: string, body?: B): Observable<T> {
    return this.http.patch<T>(url, body ?? {});
  }

  delete<T>(url: string, params?: ParamRecord): Observable<T> {
    return this.http.delete<T>(url, { params: this.toParams(params) });
  }

  private toParams(params?: ParamRecord): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v === null || v === undefined) continue;
          httpParams = httpParams.append(key, String(v));
        }
      } else {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }
}

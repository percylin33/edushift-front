import { TestBed } from '@angular/core/testing';
import { HttpRequest } from '@angular/common/http';
import { environment } from '@env/environment';
import { apiUrlInterceptor } from './api-url.interceptor';

describe('apiUrlInterceptor', () => {
  it('no modifica URLs absolutas', () => {
    const req = new HttpRequest('GET', 'https://external.com/api/test');
    const next = jasmine.createSpy('next').and.callFake((r: HttpRequest<unknown>) => r);
    const result = apiUrlInterceptor(req, next);
    expect(result.url).toBe('https://external.com/api/test');
  });

  it('no modifica URLs que no empiezan con api/', () => {
    const req = new HttpRequest('GET', 'assets/config.json');
    const next = jasmine.createSpy('next').and.callFake((r: HttpRequest<unknown>) => r);
    const result = apiUrlInterceptor(req, next);
    expect(result.url).toBe('assets/config.json');
  });

  it('reescribe api/users a la URL completa', () => {
    const req = new HttpRequest('GET', 'api/users');
    const next = jasmine.createSpy('next').and.callFake((r: HttpRequest<unknown>) => r);
    const result = apiUrlInterceptor(req, next);
    expect(result.url).toBe(`${environment.apiUrl}/${environment.apiVersion}/users`);
  });

  it('elimina slash inicial de api/', () => {
    const req = new HttpRequest('GET', '/api/users');
    const next = jasmine.createSpy('next').and.callFake((r: HttpRequest<unknown>) => r);
    const result = apiUrlInterceptor(req, next);
    expect(result.url).toBe(`${environment.apiUrl}/${environment.apiVersion}/users`);
  });
});

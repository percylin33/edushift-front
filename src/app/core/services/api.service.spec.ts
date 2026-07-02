import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiService],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('get hace GET con params', () => {
    service.get<{ id: number }>('/api/test', { page: 0, size: 20 }).subscribe();
    const req = httpMock.expectOne('/api/test?page=0&size=20');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 1 });
  });

  it('get omite params null/undefined', () => {
    service.get('/api/test', { a: 'x', b: null, c: undefined }).subscribe();
    const req = httpMock.expectOne('/api/test?a=x');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('get serializa arrays como params repetidos', () => {
    service.get('/api/test', { ids: ['1', '2'] }).subscribe();
    const req = httpMock.expectOne('/api/test?ids=1&ids=2');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('post hace POST con body', () => {
    service.post('/api/test', { name: 'foo' }).subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'foo' });
    req.flush({});
  });

  it('post usa body vacío si no se provee', () => {
    service.post('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('put hace PUT con body', () => {
    service.put('/api/test/1', { name: 'updated' }).subscribe();
    const req = httpMock.expectOne('/api/test/1');
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('patch hace PATCH con body', () => {
    service.patch('/api/test/1', { name: 'patched' }).subscribe();
    const req = httpMock.expectOne('/api/test/1');
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('delete hace DELETE con params', () => {
    service.delete('/api/test/1').subscribe();
    const req = httpMock.expectOne('/api/test/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});

import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LoadingService } from '@core/services';
import { loadingInterceptor } from './loading.interceptor';

describe('loadingInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let loadingService: jasmine.SpyObj<LoadingService>;

  beforeEach(() => {
    loadingService = jasmine.createSpyObj<LoadingService>('LoadingService', ['start', 'stop']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
        { provide: LoadingService, useValue: loadingService },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('llama start antes de la request y stop despuA(C)s', () => {
    httpClient.get('/api/test').subscribe();

    const req = httpMock.expectOne('/api/test');
    expect(loadingService.start).toHaveBeenCalledTimes(1);

    req.flush({});
    expect(loadingService.stop).toHaveBeenCalledTimes(1);
  });

  it('llama stop incluso si la request falla', () => {
    httpClient.get('/api/test').subscribe({
      error: () => {},
    });

    const req = httpMock.expectOne('/api/test');
    req.flush('Error', { status: 500, statusText: 'Server Error' });

    expect(loadingService.stop).toHaveBeenCalledTimes(1);
  });
});

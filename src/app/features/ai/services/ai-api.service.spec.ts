import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AiApiService } from './ai-api.service';
import { ApiService } from '@core/services';

describe('AiApiService', () => {
  let service: AiApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [AiApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(AiApiService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('sendMessage', () => {
    it('envía mensaje y devuelve ChatMessage', (done) => {
      const mockMsg = { id: '1', role: 'assistant', content: 'Ok', createdAt: '' };
      apiSpy.post.and.returnValue(of(mockMsg));
      service.sendMessage('s1', 'Hola').subscribe((res) => {
        expect(res.content).toBe('Ok');
        expect(apiSpy.post).toHaveBeenCalledWith(jasmine.any(String), {
          sessionId: 's1',
          content: 'Hola',
        });
        done();
      });
    });

    it('envía mensaje sin sessionId', (done) => {
      const mockMsg = { id: '2', role: 'user', content: 'Test', createdAt: '' };
      apiSpy.post.and.returnValue(of(mockMsg));
      service.sendMessage(null, 'Test').subscribe((res) => {
        expect(res.content).toBe('Test');
        done();
      });
    });
  });

  describe('insights', () => {
    it('obtiene lista de insights', (done) => {
      const mockInsights = [
        { id: 'i1', category: 'trend', title: 'Tendencia', summary: 'Detalle', generatedAt: '' },
      ];
      apiSpy.get.and.returnValue(of(mockInsights));
      service.insights().subscribe((res) => {
        expect(res.length).toBe(1);
        expect(res[0].title).toBe('Tendencia');
        done();
      });
    });
  });
});

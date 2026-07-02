import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AiUsageService, UsageSummary } from './ai-usage.service';
import { ApiService } from '@core/services/api.service';

describe('AiUsageService', () => {
  let service: AiUsageService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get']);
    TestBed.configureTestingModule({
      providers: [AiUsageService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(AiUsageService);
  });

  it('se crea correctamente', () => {
    expect(service).toBeTruthy();
  });

  describe('summary', () => {
    it('devuelve resumen de uso', (done) => {
      const mockSummary: UsageSummary = {
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        dailyRequestQuota: 1000,
        monthlyTokenQuota: 100000,
        usedRequests: 50,
        usedTokens: 5000,
        successCount: 45,
        failedCount: 5,
        byFeature: [],
        daily: [],
        generatedAt: '',
      };
      apiSpy.get.and.returnValue(of({ success: true, data: mockSummary }));
      service.summary().subscribe((s) => {
        expect(s.usedRequests).toBe(50);
        expect(s.periodStart).toBe('2026-01-01');
        done();
      });
    });
  });

  describe('csvDownloadUrl', () => {
    it('retorna URL de descarga CSV', () => {
      const url = service.csvDownloadUrl();
      expect(typeof url).toBe('string');
      expect(url.length).toBeGreaterThan(0);
    });
  });
});

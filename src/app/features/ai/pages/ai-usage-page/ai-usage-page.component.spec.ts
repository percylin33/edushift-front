import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AiUsagePageComponent } from './ai-usage-page.component';
import { AiUsageService, UsageSummary } from '../../services/ai-usage.service';
import { of } from 'rxjs';

describe('AiUsagePageComponent', () => {
  let component: AiUsagePageComponent;
  let fixture: ComponentFixture<AiUsagePageComponent>;
  let serviceSpy: jasmine.SpyObj<AiUsageService>;

  const mockSummary: UsageSummary = {
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    dailyRequestQuota: 1000,
    monthlyTokenQuota: 100000,
    usedRequests: 100,
    usedTokens: 10000,
    successCount: 90,
    failedCount: 10,
    byFeature: [{ feature: 'Chat', requestCount: 80, tokensIn: 4000, tokensOut: 6000 }],
    daily: [
      {
        day: '2026-01-15',
        requestCount: 10,
        successCount: 9,
        failedCount: 1,
        tokensIn: 500,
        tokensOut: 500,
      },
    ],
    generatedAt: '2026-01-31T12:00:00Z',
  };

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj('AiUsageService', ['summary', 'csvDownloadUrl']);
    serviceSpy.summary.and.returnValue(of(mockSummary));
    serviceSpy.csvDownloadUrl.and.returnValue('/api/v1/ai/usage/export');
    await TestBed.configureTestingModule({
      imports: [AiUsagePageComponent],
      providers: [{ provide: AiUsageService, useValue: serviceSpy }],
    }).compileComponents();
    fixture = TestBed.createComponent(AiUsagePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('carga summary al iniciar', () => {
    expect(component.summary()).toBeTruthy();
    expect(component.summary()!.usedRequests).toBe(100);
    expect(component.loading()).toBeFalse();
  });

  describe('quotaPercent', () => {
    it('calcula porcentaje correctamente', () => {
      expect(component.quotaPercent(50, 100)).toBe(50);
    });

    it('retorna 0 si quota es nulo', () => {
      expect(component.quotaPercent(50, null)).toBe(0);
    });

    it('retorna 0 si quota es 0', () => {
      expect(component.quotaPercent(50, 0)).toBe(0);
    });

    it('no excede 100', () => {
      expect(component.quotaPercent(150, 100)).toBe(100);
    });
  });

  describe('featurePercent', () => {
    it('calcula porcentaje de feature', () => {
      expect(component.featurePercent(25, 100)).toBe(25);
    });

    it('retorna 0 si total es 0', () => {
      expect(component.featurePercent(25, 0)).toBe(0);
    });
  });

  describe('successRate', () => {
    it('calcula tasa de éxito', () => {
      expect(component.successRate(mockSummary)).toBe(90);
    });

    it('retorna 0 si no hay requests', () => {
      expect(component.successRate({ ...mockSummary, usedRequests: 0 })).toBe(0);
    });
  });
});

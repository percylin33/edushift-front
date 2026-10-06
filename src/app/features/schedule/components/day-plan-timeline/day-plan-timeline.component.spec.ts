import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayPlanTimelineComponent } from './day-plan-timeline.component';
import { DayPlanPreviewItem } from '../../utils/day-plan.util';

describe('DayPlanTimelineComponent', () => {
  let fixture: ComponentFixture<DayPlanTimelineComponent>;
  let component: DayPlanTimelineComponent;

  const mockPreview: DayPlanPreviewItem[] = [
    { kind: 'period', ordinal: 1, startTime: '08:00', endTime: '08:45', label: 'Periodo 1' },
    { kind: 'period', ordinal: 2, startTime: '08:45', endTime: '09:30', label: 'Periodo 2' },
    { kind: 'hard', startTime: '09:30', endTime: '10:00', label: 'Recreo' },
    { kind: 'period', ordinal: 3, startTime: '10:00', endTime: '10:45', label: 'Periodo 3' },
    { kind: 'period', ordinal: 4, startTime: '10:45', endTime: '11:30', label: 'Periodo 4' },
    { kind: 'hard', startTime: '11:30', endTime: '12:15', label: 'Almuerzo' },
    { kind: 'period', ordinal: 5, startTime: '12:15', endTime: '13:00', label: 'Periodo 5' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DayPlanTimelineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DayPlanTimelineComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('preview', mockPreview);
    fixture.componentRef.setInput('dayStart', '08:00');
    fixture.componentRef.setInput('dayEnd', '13:00');
    fixture.detectChanges();
  });

  it('renders timeline segments for a contiguous day preview', () => {
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Recreo');
    expect(text).toContain('08:00');
    expect(text).not.toContain('Libre');
    // Desktop short labels + mobile full labels coexist in DOM
    expect(text.includes('P1') || text.includes('Periodo 1')).toBeTrue();
  });

  it('shows empty state when preview is empty', () => {
    fixture.componentRef.setInput('preview', []);
    fixture.componentRef.setInput('dayStart', '');
    fixture.componentRef.setInput('dayEnd', '');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Ajustá entrada');
  });

  it('spans full day from entrada to salida', () => {
    const segs = component['segments']();
    expect(segs.every((s, i, arr) => i === 0 || s.startMin === arr[i - 1].endMin)).toBeTrue();
    expect(component['dayEndLabel']()).toBe('13:00');
    expect(segs[segs.length - 1].endTime).toBe('13:00');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiResponse } from '@core/models/api-response.model';
import { AuthService } from '@core/services';
import { AttendancePrintService } from '@features/attendance/services/attendance-print.service';
import { AttendanceReportService } from '@features/attendance/services/attendance-report.service';
import { MeAttendanceRecord } from '../../models/me-attendance.model';
import { MeApiService } from '../../services/me-api.service';
import { MeAttendancePageComponent } from './me-attendance.page';

function at(day: number, hour: number, minute: number): string {
  return new Date(2026, 7, day, hour, minute, 0).toISOString();
}

function record(
  partial: Partial<MeAttendanceRecord> &
    Pick<MeAttendanceRecord, 'publicUuid' | 'status' | 'occurredAt'>,
): MeAttendanceRecord {
  return {
    sessionPublicUuid: null,
    notes: null,
    justificationStatus: null,
    justificationText: null,
    approvedAt: null,
    ...partial,
  };
}

describe('MeAttendancePageComponent', () => {
  let fixture: ComponentFixture<MeAttendancePageComponent>;

  const records: MeAttendanceRecord[] = [
    record({ publicUuid: 'present', status: 'PRESENT', occurredAt: at(26, 8, 10) }),
    record({ publicUuid: 'absent', status: 'ABSENT', occurredAt: at(26, 11, 40) }),
    record({ publicUuid: 'late', status: 'LATE', occurredAt: at(27, 8, 5) }),
  ];

  beforeEach(async () => {
    const api = jasmine.createSpyObj<MeApiService>('MeApiService', [
      'listAttendance',
      'justifyAttendance',
    ]);
    const response: ApiResponse<MeAttendanceRecord[]> = { success: true, data: records };
    api.listAttendance.and.returnValue(of(response));
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['hasPermission']);
    auth.hasPermission.and.returnValue(true);
    const printService = jasmine.createSpyObj<AttendancePrintService>('AttendancePrintService', [
      'print',
    ]);
    const reportService = jasmine.createSpyObj<AttendanceReportService>('AttendanceReportService', [
      'downloadScopedAttendance',
    ]);

    await TestBed.configureTestingModule({
      imports: [MeAttendancePageComponent],
      providers: [
        provideRouter([]),
        { provide: MeApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: AttendancePrintService, useValue: printService },
        { provide: AttendanceReportService, useValue: reportService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MeAttendancePageComponent);
    fixture.componentInstance.month.set(8);
    fixture.componentInstance.year.set(2026);
    fixture.componentInstance.load();
    fixture.detectChanges();
  });

  it('shows the period summary and keeps both sessions of the same day', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('33.3%');
    expect(text).toContain('Inasistencias');

    const day = fixture.nativeElement.querySelector(
      'button[aria-label*="2 sesiones"]',
    ) as HTMLButtonElement;
    expect(day).not.toBeNull();
    expect(day.getAttribute('aria-label')).toContain('Falta');

    day.click();
    fixture.detectChanges();

    const panel = fixture.nativeElement.textContent as string;
    expect(panel).toContain('08:10');
    expect(panel).toContain('11:40');
    expect(panel).toContain('Miércoles, 26 de agosto');
  });
});

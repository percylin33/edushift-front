import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services';
import { AttendanceApiService } from './attendance-api.service';

describe('AttendanceApiService', () => {
  let service: AttendanceApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const mockSessionRaw = {
    publicUuid: 'sess-1',
    sectionPublicUuid: 'sec-1',
    sectionName: 'A',
    occurredOn: '2026-06-15T08:00:00.000Z',
    slot: 'MORNING',
    startsAt: '2026-06-15T08:00:00.000Z',
    closedAt: null,
    closedByUserId: null,
    status: 'OPEN',
    notes: null,
    createdAt: '2026-06-15T07:55:00.000Z',
    updatedAt: '2026-06-15T08:00:00.000Z',
  };

  const mockRecordRaw = {
    publicUuid: 'rec-1',
    sessionPublicUuid: 'sess-1',
    studentPublicUuid: 'stu-1',
    studentFullName: 'Juan Perez',
    studentDocumentNumber: '12345678',
    status: 'PRESENT',
    occurredAt: '2026-06-15T08:05:00.000Z',
    scannedByUserId: 'tch-1',
    editedByUserId: null,
    editedAt: null,
    notes: null,
    createdAt: '2026-06-15T08:05:00.000Z',
    updatedAt: '2026-06-15T08:05:00.000Z',
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'put']);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AttendanceApiService,
        { provide: ApiService, useValue: apiSpy },
      ],
    });
    service = TestBed.inject(AttendanceApiService);
  });

  it('openSession POSTea a sessions y adapta a AttendanceSession', (done) => {
    apiSpy.post.and.returnValue(of({ success: true, data: mockSessionRaw }));
    service
      .openSession({ sectionPublicUuid: 'sec-1', slot: 'MORNING', occurredOn: '2026-06-15' } as any)
      .subscribe((session) => {
        expect(session.publicUuid).toBe('sess-1');
        expect(session.slot).toBe('MORNING');
        expect(session.startsAt).toBeInstanceOf(Date);
        done();
      });
  });

  it('closeSession PATCHea a sessions/{uuid}/close', (done) => {
    apiSpy.patch.and.returnValue(
      of({
        success: true,
        data: { ...mockSessionRaw, status: 'CLOSED', closedAt: '2026-06-15T10:00:00.000Z' },
      }),
    );
    service.closeSession('sess-1').subscribe((session) => {
      expect(session.status).toBe('CLOSED');
      done();
    });
  });

  it('checkIn POSTea y retorna record + wasIdempotent', (done) => {
    apiSpy.post.and.returnValue(
      of({
        success: true,
        data: mockRecordRaw,
        wasIdempotent: true,
      }),
    );
    service
      .checkIn('sess-1', { studentPublicUuid: 'stu-1', qrToken: 'qr-1' } as any)
      .subscribe((result) => {
        expect(result.record.studentFullName).toBe('Juan Perez');
        expect(result.wasIdempotent).toBeTrue();
        done();
      });
  });

  it('listRecords GETea y adapta a AttendanceRecord[]', (done) => {
    apiSpy.get.and.returnValue(of([mockRecordRaw]));
    service.listRecords('sess-1').subscribe((records) => {
      expect(records).toHaveSize(1);
      expect(records[0].status).toBe('PRESENT');
      expect(records[0].occurredAt).toBeInstanceOf(Date);
      done();
    });
  });

  it('updateRecord PUTea a records/{uuid}', (done) => {
    apiSpy.put.and.returnValue(of({ success: true, data: { ...mockRecordRaw, status: 'LATE' } }));
    service.updateRecord('rec-1', { status: 'LATE' } as any).subscribe((record) => {
      expect(record.status).toBe('LATE');
      done();
    });
  });
});

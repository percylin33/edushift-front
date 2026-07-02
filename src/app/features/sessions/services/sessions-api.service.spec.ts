import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SessionsApiService } from './sessions-api.service';
import { ApiService } from '@core/services';
import { SessionStatus } from '../models';

describe('SessionsApiService', () => {
  let service: SessionsApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  const listRowRaw = {
    publicUuid: 'sess-1',
    version: 1,
    title: 'Intro',
    scheduledDate: '2026-06-15',
    durationMinutes: 90,
    status: SessionStatus.PLANNED,
    startedAt: null,
    endedAt: null,
    cancelledAt: null,
    assignment: { publicUuid: 'a-1', teacherName: 'Maria', courseCode: 'MATH', sectionName: 'A' },
    unit: { publicUuid: 'u-1', name: 'U1', displayOrder: 1 },
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
  };

  const detailRaw = {
    publicUuid: 'sess-1',
    version: 1,
    assignment: {
      publicUuid: 'a-1',
      teacher: { publicUuid: 't-1', firstName: 'Maria', lastName: 'Gomez' },
      course: { publicUuid: 'c-1', code: 'MATH', name: 'Algebra' },
      section: { publicUuid: 'sec-1', name: 'A' },
      period: {
        publicUuid: 'p-1',
        periodType: 'QUARTER',
        ordinal: 1,
        name: 'Q1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    },
    unit: { publicUuid: 'u-1', name: 'U1', displayOrder: 1 },
    title: 'Intro',
    objective: 'obj',
    scheduledDate: '2026-06-15',
    durationMinutes: 90,
    status: SessionStatus.PLANNED,
    content: { objective: 'obj', activities: [], materials: [], observations: '' },
    competencies: [],
    capacities: [],
    startedAt: null,
    endedAt: null,
    cancelledAt: null,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put', 'delete']);
    TestBed.configureTestingModule({
      providers: [SessionsApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(SessionsApiService);
  });

  it('listSessions retorna filas adaptadas con fechas Date', (done) => {
    apiSpy.get.and.returnValue(of([listRowRaw]));
    service.listSessions({}).subscribe((rows) => {
      expect(rows).toHaveSize(1);
      expect(rows[0].scheduledDate).toBeInstanceOf(Date);
      expect(rows[0].teacherName).toBe('Maria');
      done();
    });
  });

  it('getSession retorna detail con período como Date', (done) => {
    apiSpy.get.and.returnValue(of({ success: true, data: detailRaw }));
    service.getSession('sess-1').subscribe((detail) => {
      expect(detail.title).toBe('Intro');
      expect(detail.assignment.period.startDate).toBeInstanceOf(Date);
      done();
    });
  });

  it('createSession POSTea y adapta', (done) => {
    apiSpy.post.and.returnValue(of({ success: true, data: detailRaw }));
    service.createSession({} as any).subscribe((d) => {
      expect(d.title).toBe('Intro');
      done();
    });
  });

  it('updateSession PUTea y adapta', (done) => {
    apiSpy.put.and.returnValue(of({ success: true, data: detailRaw }));
    service.updateSession('sess-1', {} as any).subscribe(() => {
      expect(apiSpy.put).toHaveBeenCalled();
      done();
    });
  });

  it('deleteSession llama DELETE', (done) => {
    apiSpy.delete.and.returnValue(of(void 0));
    service.deleteSession('sess-1').subscribe(() => {
      expect(apiSpy.delete).toHaveBeenCalled();
      done();
    });
  });

  it('startSession / completeSession / cancelSession POSTean a endpoints', (done) => {
    apiSpy.post.and.returnValue(of({ success: true, data: detailRaw }));
    service.startSession('sess-1', { version: 1 }).subscribe(() => {
      service.completeSession('sess-1', { version: 1 }).subscribe(() => {
        service.cancelSession('sess-1', { version: 1, reason: 'r' }).subscribe(() => {
          expect(apiSpy.post).toHaveBeenCalledTimes(3);
          done();
        });
      });
    });
  });

  it('getSessionsByAssignment mapea lista', (done) => {
    apiSpy.get.and.returnValue(of([listRowRaw]));
    service.getSessionsByAssignment('a-1').subscribe((rows) => {
      expect(rows).toHaveSize(1);
      done();
    });
  });

  it('getSessionsByUnit mapea lista', (done) => {
    apiSpy.get.and.returnValue(of([listRowRaw]));
    service.getSessionsByUnit('u-1').subscribe((rows) => {
      expect(rows).toHaveSize(1);
      done();
    });
  });
});

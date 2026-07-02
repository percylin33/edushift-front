import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services';
import { SpringPage } from '@core/models';
import { TaskApiService } from './task-api.service';
import { TaskLifecycle, TaskResponseRaw, TaskSummaryRaw, toTaskDetail, toTaskRow } from '../models';

describe('TaskApiService', () => {
  let service: TaskApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [TaskApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(TaskApiService);
  });

  function pageOf(items: TaskSummaryRaw[]): SpringPage<TaskSummaryRaw> {
    return {
      content: items,
      number: 0,
      size: 20,
      totalElements: items.length,
      totalPages: 1,
      first: true,
      last: true,
      empty: items.length === 0,
      numberOfElements: items.length,
    };
  }

  it('listBySection hace GET y mapea a TaskRow[]', (done) => {
    const raw: TaskSummaryRaw = {
      publicUuid: 't-1',
      title: 'Tarea',
      dueAt: null,
      maxScore: 20,
      lifecycle: TaskLifecycle.Draft,
      submissionsCount: 0,
      sectionLabel: null,
      courseLabel: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    apiSpy.get.and.returnValue(of(pageOf([raw])));

    service.listBySection('s-1').subscribe((rows) => {
      expect(rows).toHaveSize(1);
      expect(rows[0].publicUuid).toBe('t-1');
      done();
    });
  });

  it('listBySection pasa filtro lifecycle', (done) => {
    apiSpy.get.and.returnValue(of(pageOf([])));
    service.listBySection('s-1', { lifecycle: TaskLifecycle.Published }).subscribe(() => {
      expect(apiSpy.get).toHaveBeenCalledWith(
        jasmine.stringMatching(/\/sections\/s-1\/assignments$/),
        { lifecycle: TaskLifecycle.Published, dueBefore: undefined },
      );
      done();
    });
  });

  it('getTask desenvuelve ApiResponse vía toTaskDetail', (done) => {
    const raw: TaskResponseRaw = {
      publicUuid: 't-1',
      sectionPublicUuid: 's-1',
      coursePublicUuid: 'c-1',
      periodPublicUuid: 'p-1',
      title: 'T',
      description: null,
      dueAt: null,
      maxScore: 20,
      allowResubmissions: true,
      requiresAttachment: false,
      lifecycle: TaskLifecycle.Draft,
      createdByTeacherPublicUuid: 'tch-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    apiSpy.get.and.returnValue(of({ success: true, data: raw }));

    service.getTask('t-1').subscribe((detail) => {
      expect(detail).toEqual(toTaskDetail(raw));
      done();
    });
  });

  it('createTask POSTea y devuelve detail', (done) => {
    const raw: TaskResponseRaw = {
      publicUuid: 't-new',
      sectionPublicUuid: 's-1',
      coursePublicUuid: 'c-1',
      periodPublicUuid: 'p-1',
      title: 'Nueva',
      description: null,
      dueAt: '2030-01-01T00:00:00.000Z',
      maxScore: 20,
      allowResubmissions: true,
      requiresAttachment: false,
      lifecycle: TaskLifecycle.Draft,
      createdByTeacherPublicUuid: 'tch-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    };
    apiSpy.post.and.returnValue(of({ success: true, data: raw }));

    service
      .createTask({
        sectionPublicUuid: 's-1',
        coursePublicUuid: 'c-1',
        periodPublicUuid: 'p-1',
        title: 'Nueva',
        dueAt: '2030-01-01T00:00:00.000Z',
        maxScore: 20,
        allowResubmissions: true,
        requiresAttachment: false,
      })
      .subscribe((detail) => {
        expect(detail.publicUuid).toBe('t-new');
        done();
      });
  });

  it('updateTask PATCHea y devuelve detail', (done) => {
    apiSpy.patch.and.returnValue(
      of({
        success: true,
        data: {
          publicUuid: 't-1',
          sectionPublicUuid: 's-1',
          title: 'Editado',
        } as TaskResponseRaw,
      }),
    );

    service.updateTask('t-1', { title: 'Editado' }).subscribe((detail) => {
      expect(detail.title).toBe('Editado');
      done();
    });
  });

  it('publishTask POSTea a publish endpoint', (done) => {
    apiSpy.post.and.returnValue(
      of({
        success: true,
        data: {
          publicUuid: 't-1',
          lifecycle: TaskLifecycle.Published,
        } as TaskResponseRaw,
      }),
    );

    service.publishTask('t-1').subscribe((detail) => {
      expect(detail.lifecycle).toBe(TaskLifecycle.Published);
      done();
    });
  });

  it('closeTask POSTea a close endpoint', (done) => {
    apiSpy.post.and.returnValue(
      of({
        success: true,
        data: {
          publicUuid: 't-1',
          lifecycle: TaskLifecycle.Closed,
        } as TaskResponseRaw,
      }),
    );

    service.closeTask('t-1').subscribe((detail) => {
      expect(detail.lifecycle).toBe(TaskLifecycle.Closed);
      done();
    });
  });

  it('listByStudent hace GET a student endpoint', (done) => {
    apiSpy.get.and.returnValue(of(pageOf([])));
    service.listByStudent('st-1').subscribe(() => {
      expect(apiSpy.get).toHaveBeenCalledWith(
        jasmine.stringMatching(/\/students\/st-1\/assignments$/),
      );
      done();
    });
  });
});

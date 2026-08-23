import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { SubmissionSubmitComponent } from './submission-submit.component';
import { TasksStore } from '../../store';
import { SubmissionsStore } from '../../store';
import { SubmissionStatus } from '../../models';
import { AuthService } from '@core/services';
import { UserRole } from '@core/enums';
import { MeApiService } from '@features/me/services/me-api.service';

describe('SubmissionSubmitComponent', () => {
  let component: any;
  let fixture: ComponentFixture<SubmissionSubmitComponent>;
  let mockTasksStore: jasmine.SpyObj<TasksStore>;
  let mockSubmissionsStore: jasmine.SpyObj<SubmissionsStore>;

  beforeEach(async () => {
    mockTasksStore = jasmine.createSpyObj<TasksStore>('TasksStore', ['loadDetail']);
    mockSubmissionsStore = jasmine.createSpyObj<SubmissionsStore>(
      'SubmissionsStore',
      ['create', 'update', 'loadMySubmission'],
      {
        error: signal(null),
        uploading: signal(false),
        uploadPercent: signal(0),
      },
    );

    mockTasksStore.loadDetail.and.returnValue(Promise.resolve({} as any));
    mockSubmissionsStore.loadMySubmission.and.returnValue(Promise.resolve(null));
    mockSubmissionsStore.create.and.returnValue(Promise.resolve({} as any));
    mockSubmissionsStore.update.and.returnValue(Promise.resolve({} as any));

    await TestBed.configureTestingModule({
      imports: [SubmissionSubmitComponent],
      providers: [
        provideRouter([]),
        { provide: TasksStore, useValue: mockTasksStore },
        { provide: SubmissionsStore, useValue: mockSubmissionsStore },
        {
          provide: AuthService,
          useValue: { hasRole: (role: UserRole) => role === UserRole.Student },
        },
        {
          provide: MeApiService,
          useValue: {
            getProfile: () => of({ data: { publicUuid: 'st-1' } }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SubmissionSubmitComponent);
    component = fixture.componentInstance;
    component.assignmentUuid = 'a-1';
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(component).toBeTruthy();
  });

  it('onResubmit muestra el form', () => {
    component.showForm.set(false);
    component.onResubmit();
    expect(component.showForm()).toBeTrue();
  });

  it('onCreate llama al store con el contrato JSON del BE', async () => {
    component.studentPublicUuid.set('st-1');
    const payload = {
      textContent: 'Mi respuesta',
      attachment: null,
      submittedForStudentPublicUuid: null,
      studentPublicUuid: 'st-1',
    };
    await component.onCreate(payload);
    expect(mockSubmissionsStore.create).toHaveBeenCalledWith('a-1', {
      studentPublicUuid: 'st-1',
      textBody: 'Mi respuesta',
      attachment: null,
    });
  });

  it('onUpdate llama al store', async () => {
    component.mySubmission.set({
      publicUuid: 'sub-1',
      status: SubmissionStatus.Returned,
    } as any);
    const payload = { textContent: 'Re-entrega', attachment: null };
    await component.onUpdate(payload);
    expect(mockSubmissionsStore.update).toHaveBeenCalledWith('sub-1', payload);
  });

  it('canResubmitNow true si no hay submission', () => {
    component.mySubmission.set(null);
    expect(component.canResubmitNow()).toBeTrue();
  });
});

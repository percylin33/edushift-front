import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services';
import { UserRole } from '@core/enums';
import { UsersApiService } from './users-api.service';

describe('UsersApiService', () => {
  let service: UsersApiService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [UsersApiService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(UsersApiService);
  });

  it('list hace GET a /v1/users y adapta a SpringPage<UserRow>', (done) => {
    apiSpy.get.and.returnValue(
      of({
        content: [
          {
            publicUuid: 'u-1',
            email: 'user@test.com',
            fullName: 'Test User',
            roles: ['TEACHER'],
            status: 'ACTIVE',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        number: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
        empty: false,
        numberOfElements: 1,
      }),
    );
    service.list({}).subscribe((page) => {
      expect(page.content).toHaveSize(1);
      expect(page.content[0].email).toBe('user@test.com');
      done();
    });
  });

  it('get hace GET a /v1/users/{uuid}', (done) => {
    apiSpy.get.and.returnValue(
      of({
        success: true,
        data: {
          publicUuid: 'u-1',
          email: 'user@test.com',
          fullName: 'Test User',
          roles: ['TEACHER'],
          permissions: ['read:own'],
          status: 'ACTIVE',
          tenantId: 't-1',
          tenantSlug: 'acme',
          tenantName: 'Acme',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    );
    service.get('u-1').subscribe((user) => {
      expect(user.email).toBe('user@test.com');
      expect(user.roles).toContain(UserRole.Teacher);
      done();
    });
  });

  it('disable POSTea a /v1/users/{uuid}/disable', (done) => {
    apiSpy.post.and.returnValue(
      of({
        success: true,
        data: {
          publicUuid: 'u-1',
          email: 'user@test.com',
          fullName: 'Test User',
          roles: ['TEACHER'],
          status: 'ACTIVE',
          emailVerified: true,
          mfaEnabled: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      }),
    );
    service.disable('u-1').subscribe((user) => {
      expect(user.status).toBe('ACTIVE');
      expect(apiSpy.post).toHaveBeenCalledWith(jasmine.stringMatching(/\/users\/u-1\/disable$/));
      done();
    });
  });
});

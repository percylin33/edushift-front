import { schoolRegistrationDestination } from './school-registration.navigation';

describe('schoolRegistrationDestination', () => {
  it('requires login on the school origin before onboarding when the host changes', () => {
    const url = new URL(schoolRegistrationDestination('http://localhost:4201', 'colegioqa'));
    expect(url.origin).toBe('http://colegioqa.localhost:4201');
    expect(url.pathname).toBe('/auth/login');
    expect(url.searchParams.get('returnUrl')).toBe('/onboarding/welcome');
    expect(url.searchParams.get('schoolCreated')).toBe('1');
    expect(url.hash).toBe('');
    expect([...url.searchParams.keys()].sort()).toEqual(['returnUrl', 'schoolCreated']);
  });
  it('keeps onboarding on the existing school origin without another sign-in', () => {
    expect(schoolRegistrationDestination('http://colegioqa.localhost:4201', 'colegioqa'))
      .toBe('http://colegioqa.localhost:4201/onboarding/welcome');
  });
  it('keeps same-origin onboarding on hosted deployments', () => {
    expect(schoolRegistrationDestination('https://app.example.test', 'colegioqa'))
      .toBe('https://app.example.test/onboarding/welcome');
  });
});

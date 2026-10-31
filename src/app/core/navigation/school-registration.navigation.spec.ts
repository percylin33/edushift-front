import { schoolRegistrationDestination } from './school-registration.navigation';

describe('schoolRegistrationDestination', () => {
  for (const origin of ['http://localhost:4201', 'http://colegioqa.localhost:4201', 'https://app.example.test']) {
    it(`preserves the authenticated origin ${origin} without credentials in the URL`, () => {
      const url = new URL(schoolRegistrationDestination(origin));
      expect(url.origin).toBe(origin);
      expect(url.pathname).toBe('/onboarding/welcome');
      expect(url.search).toBe('');
      expect(url.hash).toBe('');
    });
  }
});

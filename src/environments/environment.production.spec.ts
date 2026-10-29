import { environment } from './environment.production';

describe('production environment', () => {
  it('does not configure Firebase until a production project is provisioned', () => {
    expect(environment.production).toBeTrue();
    expect(environment.firebase).toBeUndefined();
  });
});

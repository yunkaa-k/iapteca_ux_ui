import { describe, expect, it } from 'vitest';
import { profileNames } from '@/lib/profile';

describe('compatible profile names', () => {
  it('keeps every word in legacy full names and tolerates empty accounts', () => {
    expect(profileNames({ name: ' Олена Коваль Петренко ' })).toEqual({ firstName: 'Олена', lastName: 'Коваль Петренко' });
    expect(profileNames({ name: 'Олена' })).toEqual({ firstName: 'Олена', lastName: '' });
    expect(profileNames({})).toEqual({ firstName: '', lastName: '' });
  });
  it('preserves explicitly saved multiword first and last names', () => {
    expect(profileNames({ name: 'Legacy', firstName: 'Марія Анна', lastName: 'Коваль Петренко' })).toEqual({ firstName: 'Марія Анна', lastName: 'Коваль Петренко' });
  });
});

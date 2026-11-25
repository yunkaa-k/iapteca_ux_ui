import type { User } from './types';

// Legacy accounts have only a full name. Keep every word until the owner edits it.
export function profileNames(user: Pick<User, 'name' | 'firstName' | 'lastName'>) {
  if (user.firstName !== undefined || user.lastName !== undefined) {
    return { firstName: user.firstName || '', lastName: user.lastName || '' };
  }
  const [firstName = '', ...rest] = (user.name || '').trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

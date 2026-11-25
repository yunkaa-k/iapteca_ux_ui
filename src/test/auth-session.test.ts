import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthUser, setAuthCookie, deleteAuthCookie } from '@/lib/auth';
import { UserModel, UserSessionModel, connectDB } from '@/lib/db';

const state = vi.hoisted(() => ({ token: '', set: vi.fn(), remove: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: state.token }), set: state.set, delete: state.remove }) }));
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(), UserModel: { findById: vi.fn() }, UserSessionModel: { findOne: vi.fn(), create: vi.fn(), deleteOne: vi.fn() } }));

beforeEach(() => { vi.clearAllMocks(); state.token = ''; });

describe('opaque server-side sessions', () => {
  it('rejects legacy user ID cookies without querying MongoDB', async () => {
    state.token = '507f1f77bcf86cd799439011';
    expect(await getAuthUser()).toBeNull();
    expect(connectDB).not.toHaveBeenCalled();
  });

  it('stores only a hash and puts the random token in an HttpOnly cookie', async () => {
    await setAuthCookie('user1');
    const [cookieName, token, options] = state.set.mock.calls[0];
    expect(cookieName).toBe('auth_id');
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86400 });
    expect(UserSessionModel.create).toHaveBeenCalledWith({ user: 'user1', tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: expect.any(Date) });
  });

  it('requires a nonexpired server session before looking up a user', async () => {
    state.token = 'a'.repeat(64);
    vi.mocked(UserSessionModel.findOne).mockReturnValue({ lean: async () => null } as never);
    expect(await getAuthUser()).toBeNull();
    expect(UserSessionModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: { $gt: expect.any(Date) } }));
    expect(UserModel.findById).not.toHaveBeenCalled();
  });

  it('does not return passwords and rejects banned users', async () => {
    state.token = 'a'.repeat(64);
    vi.mocked(UserSessionModel.findOne).mockReturnValue({ lean: async () => ({ user: 'user1' }) } as never);
    const user = { _id: 'user1', email: 'test@example.test', role: 'CUSTOMER', password: 'secret', isBanned: false };
    vi.mocked(UserModel.findById).mockReturnValue({ lean: async () => user } as never);
    expect(await getAuthUser()).not.toHaveProperty('password');
    vi.mocked(UserModel.findById).mockReturnValue({ lean: async () => ({ ...user, isBanned: true }) } as never);
    expect(await getAuthUser()).toBeNull();
  });

  it('revokes the server session at logout as well as removing the cookie', async () => {
    state.token = 'b'.repeat(64);
    await deleteAuthCookie();
    expect(UserSessionModel.deleteOne).toHaveBeenCalledWith({ tokenHash: createHash('sha256').update(state.token).digest('hex') });
    expect(state.remove).toHaveBeenCalledWith('auth_id');
  });
});

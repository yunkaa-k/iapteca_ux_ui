import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as login } from '@/app/api/auth/login/route';
import { POST as register } from '@/app/api/auth/register/route';
import { POST as reset } from '@/app/api/auth/reset-password/route';
import { UserModel, connectDB } from '@/lib/db';
import { setAuthCookie } from '@/lib/auth';
import bcrypt from 'bcrypt';

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(), UserModel: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock('@/lib/auth', () => ({ setAuthCookie: vi.fn() }));
vi.mock('bcrypt', () => ({ default: { compare: vi.fn(), hash: vi.fn() } }));

const request = (body: unknown, path = 'register') => new Request(`http://localhost/api/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const user = { _id: '507f1f77bcf86cd799439011', email: 'person@example.test', password: 'hashed', role: 'CUSTOMER', isBanned: false };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);
  vi.mocked(UserModel.findOne).mockResolvedValue(null);
  vi.mocked(UserModel.create).mockResolvedValue(user as never);
});

describe('email-only registration', () => {
  it('normalizes email, hashes passwords, records consent and ignores requested admin privileges', async () => {
    const response = await register(request({ email: ' Person@Example.Test ', password: 'StrongPassword123', consent: true, role: 'ADMIN' }));
    expect(response.status).toBe(201);
    expect(UserModel.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'person@example.test', password: 'hashed', privacyAcceptedAt: expect.any(Date) }));
    expect(vi.mocked(UserModel.create).mock.calls[0][0]).not.toHaveProperty('role');
    expect((await response.json()).user).not.toHaveProperty('password');
    expect(setAuthCookie).toHaveBeenCalledWith(user._id);
  });

  it.each([
    { email: 'person@', password: '12345678', consent: true },
    { email: 'person@example.test', password: 'short', consent: true },
    { email: 'person@example.test', password: '12345678', consent: false },
    { email: 'person@example.test', password: 'я'.repeat(37), consent: true },
    { email: { $ne: null }, password: '12345678', consent: true },
  ])('rejects invalid registration before touching the database: %j', async (body) => {
    expect((await register(request(body))).status).toBe(400);
    expect(connectDB).not.toHaveBeenCalled();
    expect(UserModel.create).not.toHaveBeenCalled();
  });

  it('handles both pre-existing and concurrently registered emails as conflicts', async () => {
    vi.mocked(UserModel.findOne).mockResolvedValueOnce(user as never);
    const body = { email: user.email, password: '12345678', consent: true };
    expect((await register(request(body))).status).toBe(409);
    vi.mocked(UserModel.create).mockRejectedValueOnce({ code: 11000 });
    expect((await register(request(body))).status).toBe(409);
    expect(setAuthCookie).not.toHaveBeenCalled();
  });
});

describe('login', () => {
  it('accepts normalized email and returns the same _id shape as /me', async () => {
    vi.mocked(UserModel.findOne).mockResolvedValueOnce(user as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);
    const response = await login(request({ email: ' PERSON@EXAMPLE.TEST ', password: '12345678' }, 'login'));
    expect(response.status).toBe(200);
    expect(UserModel.findOne).toHaveBeenCalledWith({ email: user.email });
    expect((await response.json()).user._id).toBe(user._id);
  });

  it('rejects phone-only login and registration before querying users', async () => {
    const body = { phone: '+999123456789', password: '12345678', consent: true };
    expect((await login(request(body, 'login'))).status).toBe(400);
    expect((await register(request(body))).status).toBe(400);
    expect(UserModel.findOne).not.toHaveBeenCalled();
    expect(setAuthCookie).not.toHaveBeenCalled();
  });

  it.each(['absent', 'wrong-password', 'banned'])('does not create a session for %s', async (scenario) => {
    vi.mocked(UserModel.findOne).mockResolvedValueOnce(scenario === 'absent' ? null : { ...user, isBanned: scenario === 'banned' } as never);
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
    const response = await login(request({ email: user.email, password: '12345678' }, 'login'));
    expect(response.status).toBe(401);
    expect(setAuthCookie).not.toHaveBeenCalled();
  });

  it('rejects cross-origin login requests', async () => {
    const response = await login(new Request('http://localhost/api/auth/login', { method: 'POST', headers: { Origin: 'https://elsewhere.example' }, body: '{}' }));
    expect(response.status).toBe(403);
    expect(connectDB).not.toHaveBeenCalled();
  });

  it('does not permit the old unauthenticated phone-only password reset', async () => {
    expect((await reset()).status).toBe(503);
    expect(connectDB).not.toHaveBeenCalled();
  });
});

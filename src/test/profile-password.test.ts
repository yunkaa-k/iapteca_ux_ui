import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ auth: vi.fn(), find: vi.fn(), update: vi.fn(), profile: vi.fn(), remove: vi.fn(), compare: vi.fn(), hash: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getAuthUser: mock.auth }));
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(), UserModel: { findById: mock.find, updateOne: mock.update, findByIdAndUpdate: mock.profile }, UserSessionModel: { deleteMany: mock.remove } }));
vi.mock('bcrypt', () => ({ default: { compare: mock.compare, hash: mock.hash } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'a'.repeat(64) }) }) }));
import { POST } from '@/app/api/profile/password/route';
import { PUT } from '@/app/api/profile/route';
const request = (body: unknown, origin = 'http://localhost:3000') => new Request('http://localhost:3000/api/profile/password', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const valid = { currentPassword: 'OldPassword123', newPassword: 'NewPassword123', confirmation: 'NewPassword123' };
beforeEach(() => { vi.resetAllMocks(); mock.auth.mockResolvedValue({ _id: 'owner' }); mock.find.mockReturnValue({ select: () => ({ lean: async () => ({ password: 'old-hash' }) }) }); mock.compare.mockResolvedValue(true); mock.hash.mockResolvedValue('new-hash'); mock.update.mockResolvedValue({ modifiedCount: 1 }); mock.remove.mockResolvedValue({ deletedCount: 1 }); });
describe('profile password API', () => {
  it('updates only allowed profile fields and selects a public response', async () => {
    const select = vi.fn(() => ({ lean: async () => ({ _id: 'owner', name: 'Олена', email: 'test@example.test' }) }));
    mock.profile.mockReturnValue({ select });
    const response = await PUT(request({ name: ' Олена ', phone: '+380 (67) 123-45-67', role: 'ADMIN', password: 'injected', _id: 'another-user' }));
    expect(response.status).toBe(200);
    expect(mock.profile).toHaveBeenCalledWith('owner', { $set: { name: 'Олена', phone: '+380671234567' }, $unset: { firstName: 1, lastName: 1 } }, { new: true, runValidators: true });
    expect(select).toHaveBeenCalledWith('_id name firstName lastName phone email role isBanned');
    expect(await response.json()).toEqual({ user: { _id: 'owner', name: 'Олена', email: 'test@example.test' } });
  });
  it('stores structured names and the compatible full name without accepting email changes', async () => {
    mock.profile.mockReturnValue({ select: () => ({ lean: async () => ({ _id: 'owner' }) }) });
    const response = await PUT(request({ firstName: ' Марія Анна ', lastName: ' Коваль ', phone: '', email: 'changed@example.test' }));
    expect(response.status).toBe(200);
    expect(mock.profile).toHaveBeenCalledWith('owner', { $set: { name: 'Марія Анна Коваль', firstName: 'Марія Анна', lastName: 'Коваль' }, $unset: { phone: 1 } }, { new: true, runValidators: true });
  });
  it('rejects incomplete and oversized structured names before writing', async () => {
    expect((await PUT(request({ firstName: 'Олена', lastName: '' }))).status).toBe(400);
    expect((await PUT(request({ firstName: 'а'.repeat(100), lastName: 'Коваль' }))).status).toBe(400);
    expect(mock.profile).not.toHaveBeenCalled();
  });
  it('rejects invalid contact values before writing', async () => {
    expect((await PUT(request({ name: 'Олена', phone: 'wrong' }))).status).toBe(400);
    expect(mock.profile).not.toHaveBeenCalled();
  });
  it('rejects anonymous and cross-origin changes', async () => {
    expect((await POST(request(valid, 'https://other.example'))).status).toBe(403);
    mock.auth.mockResolvedValue(null);
    expect((await POST(request(valid))).status).toBe(401);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('rejects mismatched and oversized passwords before hashing', async () => {
    expect((await POST(request({ ...valid, confirmation: 'different' }))).status).toBe(400);
    expect((await POST(request({ ...valid, newPassword: 'ї'.repeat(40), confirmation: 'ї'.repeat(40) }))).status).toBe(400);
    expect(mock.hash).not.toHaveBeenCalled();
  });
  it('does not change a password if current password is incorrect', async () => {
    mock.compare.mockResolvedValue(false);
    expect((await POST(request(valid))).status).toBe(400);
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('uses the authenticated owner and original hash, preserving only current session', async () => {
    const response = await POST(request(valid));
    expect(response.status).toBe(200);
    expect(mock.update).toHaveBeenCalledWith({ _id: 'owner', password: 'old-hash' }, { $set: { password: 'new-hash' } });
    expect(mock.remove).toHaveBeenCalledWith({ user: 'owner', tokenHash: { $ne: expect.stringMatching(/^[a-f0-9]{64}$/) } });
    expect(JSON.stringify(await response.json())).not.toContain('hash');
  });
  it('rejects simultaneous change using a stale password hash', async () => {
    mock.update.mockResolvedValue({ modifiedCount: 0 });
    expect((await POST(request(valid))).status).toBe(409);
    expect(mock.remove).not.toHaveBeenCalled();
  });
});

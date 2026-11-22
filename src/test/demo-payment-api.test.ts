import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), find: vi.fn(), connect: vi.fn() }));
vi.mock('@/lib/auth', () => ({ getAuthUser: mocks.auth }));
vi.mock('@/lib/db', () => ({ connectDB: mocks.connect, OrderModel: { findOneAndUpdate: mocks.update, findOne: mocks.find } }));
import { POST } from '@/app/api/orders/[id]/demo-payment/route';
const id = 'a'.repeat(24);
const token = 'b'.repeat(64);
const checkout = { payment: 'online', paymentMode: 'demo', demoPaymentStatus: 'paid' };
const context = { params: Promise.resolve({ id }) };
function request(bearer?: string, origin = 'http://localhost:3000', outcome: unknown = 'success') {
  return new Request(`http://localhost:3000/api/orders/${id}/demo-payment`, { method: 'POST', headers: { origin, ...(bearer ? { authorization: 'Bearer ' + bearer } : {}) }, body: JSON.stringify({ outcome }) });
}
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue(null); });
describe('private demo payment retry', () => {
  it('never allows an ordinary ID to grant guest access', async () => {
    expect((await POST(request(), context)).status).toBe(401);
    expect((await POST(request('wrong'), context)).status).toBe(401);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it('scopes a guest retry to the secret hash and updates no inventory or order total', async () => {
    mocks.update.mockResolvedValue({ checkout });
    const response = await POST(request(token), context);
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ _id: id, user: { $exists: false }, guestPaymentTokenHash: createHash('sha256').update(token).digest('hex'), status: { $in: ['PENDING', 'CONFIRMED'] }, 'checkout.demoPaymentStatus': 'failed' }), { $set: { 'checkout.demoPaymentStatus': 'paid' } }, { new: true });
    expect(await response.json()).toEqual({ checkout });
  });
  it('uses the authenticated owner and never a caller-supplied user ID', async () => {
    mocks.auth.mockResolvedValue({ _id: 'owner' }); mocks.update.mockResolvedValue({ checkout });
    expect((await POST(request(), context)).status).toBe(200);
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ user: 'owner' });
  });
  it('is idempotent after success and rejects cancelled or inaccessible orders', async () => {
    mocks.update.mockResolvedValue(null); mocks.find.mockResolvedValue({ checkout });
    expect((await POST(request(token), context)).status).toBe(200);
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ 'checkout.demoPaymentStatus': 'paid', status: { $in: ['PENDING', 'CONFIRMED'] } }));
    mocks.find.mockResolvedValue(null);
    expect((await POST(request(token), context)).status).toBe(404);
  });
  it('rejects a foreign origin and hides internal failures', async () => {
    expect((await POST(request(token, 'https://other.example'), context)).status).toBe(403);
    mocks.update.mockRejectedValue(new Error('private database failure'));
    const response = await POST(request(token), context);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('private');
  });
  it('keeps an unsuccessful card attempt failed instead of approving it', async () => {
    mocks.update.mockResolvedValue({ checkout: { ...checkout, demoPaymentStatus: 'failed' } });
    const response = await POST(request(token, 'http://localhost:3000', 'failure'), context);
    expect((await response.json()).checkout.demoPaymentStatus).toBe('failed');
    expect(mocks.update.mock.calls[0][1]).toEqual({ $set: { 'checkout.demoPaymentStatus': 'failed' } });
  });
  it('rejects missing or unknown outcomes without changing an order', async () => {
    expect((await POST(request(token, 'http://localhost:3000', null), context)).status).toBe(400);
    expect((await POST(request(token, 'http://localhost:3000', 'paid'), context)).status).toBe(400);
    const noBody = new Request(`http://localhost:3000/api/orders/${id}/demo-payment`, { method: 'POST', headers: { authorization: 'Bearer ' + token } });
    expect((await POST(noBody, context)).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

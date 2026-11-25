import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ auth: vi.fn(), read: vi.fn(), restore: vi.fn(), update: vi.fn(), session: { startTransaction: vi.fn(), commitTransaction: vi.fn(), abortTransaction: vi.fn(), endSession: vi.fn() } }));
vi.mock('@/lib/auth', () => ({ getAuthUser: mock.auth }));
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(), OrderModel: { findById: () => ({ session: mock.read }), findByIdAndUpdate: mock.update }, MedicationModel: { findByIdAndUpdate: (...args: unknown[]) => ({ session: () => mock.restore(...args) }) } }));
vi.mock('mongoose', () => ({ default: { startSession: async () => mock.session } }));
import { PATCH } from '@/app/api/orders/[id]/route';
const order = { _id: 'order', user: 'owner', status: 'PENDING', items: [{ medication: 'medicine', quantity: 2 }, { medication: 'kit', kind: 'bundle', quantity: 2, components: [{ medication: 'bandage', quantity: 3 }] }] };
function cancel(status = 'CANCELLED', origin = 'http://localhost:3000') { return PATCH(new Request('http://localhost:3000/api/orders/order', { method: 'PATCH', headers: { origin }, body: JSON.stringify({ status }) }), { params: Promise.resolve({ id: 'order' }) }); }
beforeEach(() => { vi.resetAllMocks(); mock.auth.mockResolvedValue({ _id: 'owner', role: 'CUSTOMER' }); mock.read.mockResolvedValue(order); mock.restore.mockResolvedValue({}); mock.update.mockResolvedValue({ ...order, status: 'CANCELLED' }); });
describe('owner cancellation', () => {
  it('returns mixed inventory and changes order status in one transaction', async () => {
    expect((await cancel()).status).toBe(200);
    expect(mock.restore).toHaveBeenCalledWith('medicine', { $inc: { stock: 2 } });
    expect(mock.restore).toHaveBeenCalledWith('bandage', { $inc: { stock: 6 } });
    expect(mock.update).toHaveBeenCalledWith('order', { $set: { status: 'CANCELLED' } }, { new: true, session: mock.session });
    expect(mock.session.commitTransaction).toHaveBeenCalledOnce();
  });
  it('never restocks a repeated cancellation', async () => {
    mock.read.mockResolvedValue({ ...order, status: 'CANCELLED' });
    expect((await cancel()).status).toBe(200);
    expect(mock.restore).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
  });
  it('marks only paid demo cancellations for refund in the same atomic update', async () => {
    mock.read.mockResolvedValue({ ...order, checkout: { paymentMode: 'demo', demoPaymentStatus: 'paid' } });
    await cancel();
    expect(mock.update.mock.calls[0][1]).toEqual({ $set: { status: 'CANCELLED', 'checkout.demoRefundStatus': 'pending' } });
  });
  it('does not expose another user’s order or let a customer set other statuses', async () => {
    mock.read.mockResolvedValue({ ...order, user: 'another-owner' });
    expect((await cancel()).status).toBe(404); expect(mock.restore).not.toHaveBeenCalled();
    expect((await cancel('COMPLETED')).status).toBe(403);
    mock.auth.mockResolvedValue(null); expect((await cancel()).status).toBe(401);
  });
  it.each(['SHIPPED', 'COMPLETED'])('rejects owner cancellation of %s orders', async status => {
    mock.read.mockResolvedValue({ ...order, status });
    expect((await cancel()).status).toBe(409); expect(mock.restore).not.toHaveBeenCalled();
  });
  it('aborts the whole transaction when a component or status update fails', async () => {
    mock.restore.mockResolvedValueOnce({}).mockResolvedValueOnce(null);
    expect((await cancel()).status).toBe(409);
    expect(mock.update).not.toHaveBeenCalled(); expect(mock.session.abortTransaction).toHaveBeenCalledOnce();
    mock.restore.mockResolvedValue({}); mock.update.mockRejectedValue(new Error('internal failure'));
    expect((await cancel()).status).toBe(503);
  });
  it('retries a write conflict and sees the cancellation committed by another request', async () => {
    mock.update.mockRejectedValueOnce({ code: 112 });
    mock.read.mockResolvedValueOnce(order).mockResolvedValueOnce({ ...order, status: 'CANCELLED' });
    expect((await cancel()).status).toBe(200);
    expect(mock.session.abortTransaction).toHaveBeenCalledOnce();
    expect(mock.session.commitTransaction).toHaveBeenCalledOnce();
    expect(mock.update).toHaveBeenCalledOnce();
  });
  it('rejects foreign origins before changing anything', async () => {
    expect((await cancel('CANCELLED', 'https://other.example')).status).toBe(403);
    expect(mock.read).not.toHaveBeenCalled();
  });
});

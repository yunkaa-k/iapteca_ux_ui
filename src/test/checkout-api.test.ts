import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/orders/route';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), update: vi.fn(), create: vi.fn(),
  session: { startTransaction: vi.fn(), commitTransaction: vi.fn(), abortTransaction: vi.fn(), endSession: vi.fn() },
}));
vi.mock('@/lib/auth', () => ({ getAuthUser: mocks.auth }));
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(), MedicationModel: { findOneAndUpdate: mocks.update }, OrderModel: { create: mocks.create } }));
vi.mock('mongoose', () => ({ default: { startSession: async () => mocks.session } }));
const checkout = { name: 'Тестовий покупець', phone: '+380670000000', email: '', receiving: 'courier', pharmacyId: '', city: 'Харків', address: 'Тестова, 12', payment: 'on-receipt' };
const request = (patch = {}) => new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ items: [{ medication: 'med', quantity: 1, price: 1 }], total: 1, checkout, ...patch }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue(null);
  mocks.update.mockResolvedValue({ _id: 'med', price: 25, stock: 4, requiresPrescription: false });
  mocks.create.mockImplementation(async orders => orders.map((order: object) => ({ ...order, _id: 'order-id' })));
});
describe('checkout orders API', () => {
  it('saves guest contacts and computes prices and delivery on the server', async () => {
    const response = await POST(request()); const data = await response.json();
    expect(response.status).toBe(200); expect(data.user).toBeUndefined(); expect(data.total).toBe(84);
    expect(data.items[0].price).toBe(25); expect(data.checkout.contact.phone).toBe('+380670000000');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ stock: { $gte: 1 } }), { $inc: { stock: -1 } }, expect.objectContaining({ session: mocks.session }));
    expect(mocks.session.commitTransaction).toHaveBeenCalledOnce();
  });
  it.each([0, -1, 1.5, 1001])('rejects invalid quantity %s before touching stock', async quantity => {
    expect((await POST(request({ items: [{ medication: 'med', quantity }] }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('aborts when stock is missing and never creates an order', async () => {
    mocks.update.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.session.abortTransaction).toHaveBeenCalledOnce();
  });
  it('uses a transaction for a single product when saving the order fails', async () => {
    mocks.create.mockRejectedValue(new Error('Storage unavailable'));
    expect((await POST(request())).status).toBe(400);
    expect(mocks.session.abortTransaction).toHaveBeenCalledOnce(); expect(mocks.session.commitTransaction).not.toHaveBeenCalled();
  });
  it('keeps prescription guest orders blocked and rejects invalid checkout fields', async () => {
    mocks.update.mockResolvedValue({ price: 25, requiresPrescription: true });
    expect((await POST(request())).status).toBe(400); expect(mocks.create).not.toHaveBeenCalled();
    mocks.update.mockClear();
    expect((await POST(request({ checkout: { ...checkout, phone: '123' } }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('stores a private guest capability hash but returns only the token and public payment metadata', async () => {
    const response = await POST(request({ checkout: { ...checkout, payment: 'online', demoPaymentOutcome: 'failure' } }));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.guestPaymentToken).toMatch(/^[a-f0-9]{64}$/);
    expect(data.guestPaymentTokenHash).toBeUndefined();
    const saved = mocks.create.mock.calls[0][0][0];
    expect(saved.guestPaymentTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.guestPaymentTokenHash).not.toBe(data.guestPaymentToken);
    expect(saved.checkout).toMatchObject({ paymentMode: 'demo', demoPaymentStatus: 'failed' });
    expect(data.checkout).toMatchObject({ paymentMode: 'demo', demoPaymentStatus: 'failed' });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/orders/route';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), update: vi.fn(), create: vi.fn(), findOrder: vi.fn(), findBundle: vi.fn(),
  session: { startTransaction: vi.fn(), commitTransaction: vi.fn(), abortTransaction: vi.fn(), endSession: vi.fn() },
}));
vi.mock('@/lib/auth', () => ({ getAuthUser: mocks.auth }));
vi.mock('@/lib/db', () => ({
  connectDB: vi.fn(),
  MedicationModel: { findOneAndUpdate: mocks.update },
  BundleModel: { findOne: mocks.findBundle },
  OrderModel: { create: mocks.create, findById: mocks.findOrder },
}));
vi.mock('mongoose', () => ({ default: { startSession: async () => mocks.session } }));
const checkout = { name: 'Тестовий покупець', phone: '+380670000000', email: '', receiving: 'courier', pharmacyId: '', city: 'Харків', address: 'Тестова, 12', payment: 'on-receipt' };
const submissionKey = '0be4dd73-66e7-428a-bfca-a0a496e19725';
const request = (patch = {}, key?: string) => new Request('http://localhost/api/orders', {
  method: 'POST',
  headers: key ? { 'Idempotency-Key': key } : undefined,
  body: JSON.stringify({ items: [{ medication: 'med', quantity: 1, price: 1 }], total: 1, checkout, ...patch }),
});
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue(null);
  mocks.update.mockResolvedValue({ _id: 'med', price: 25, stock: 4, requiresPrescription: false });
  mocks.create.mockImplementation(async orders => orders.map((order: { _id?: string }) => ({ _id: 'order-id', ...order })));
  mocks.findOrder.mockImplementation(() => ({
    select: () => ({ session: async () => mocks.create.mock.results.length ? (await mocks.create.mock.results[0].value)[0] : null }),
  }));
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
  it('replays a committed guest order and its payment capability without deducting stock again', async () => {
    const online = { checkout: { ...checkout, payment: 'online', demoPaymentOutcome: 'failure' } };
    const first = await POST(request(online, submissionKey));
    const original = await first.json();
    expect(first.status).toBe(200);
    expect(original.guestPaymentToken).toMatch(/^[a-f0-9]{64}$/);
    expect(original).not.toHaveProperty('submissionHash');

    const response = await POST(request(online, submissionKey));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(original);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.session.commitTransaction).toHaveBeenCalledOnce();
  });
  it('rejects attempts to reuse a key with different items or under another account', async () => {
    mocks.auth.mockResolvedValue({ _id: 'first-owner' });
    const first = await POST(request({}, submissionKey));
    expect(first.status).toBe(200);
    expect((await first.json()).user).toBe('first-owner');

    const changed = await POST(request({ items: [{ medication: 'med', quantity: 2 }] }, submissionKey));
    expect(changed.status).toBe(409);
    mocks.auth.mockResolvedValue({ _id: 'other-owner' });
    const otherOwner = await POST(request({}, submissionKey));
    expect(otherOwner.status).toBe(409);
    expect(await otherOwner.json()).not.toHaveProperty('user');
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it('recovers the stored order when the transaction commit result is uncertain', async () => {
    mocks.session.commitTransaction.mockRejectedValueOnce(Object.assign(new Error('Commit reply lost'), {
      hasErrorLabel: (label: string) => label === 'UnknownTransactionCommitResult',
    }));
    const response = await POST(request({}, submissionKey));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 84 });
    expect(mocks.findOrder).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it('rolls back the losing transaction and returns the winning order after a duplicate insert', async () => {
    let winningOrder: object | undefined;
    mocks.findOrder.mockReturnValue({
      select: () => ({ session: async () => winningOrder }),
    });
    mocks.create.mockImplementationOnce(async ([order]: object[]) => {
      winningOrder = order;
      throw Object.assign(new Error('Order already exists'), { code: 11000 });
    });

    const response = await POST(request({}, submissionKey));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 84 });
    expect(mocks.findOrder).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.session.abortTransaction).toHaveBeenCalled();
    expect(mocks.session.commitTransaction).not.toHaveBeenCalled();
  });
  it('rejects a malformed submission key before processing stock', async () => {
    expect((await POST(request({}, 'invalid-key'))).status).toBe(400);
    expect(mocks.findOrder).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('rolls back pickup for the demo combination and permits courier delivery', async () => {
    mocks.findBundle.mockReturnValue({
      session: async () => ({
        slug: 'travel', price: 249, components: [{ medication: 'kit-component', quantity: 1 }],
      }),
    });
    mocks.update.mockImplementation(async (filter: { _id: string }) => filter._id === 'med'
      ? { name: 'Нурофен 200 мг №24', price: 145, stock: 4 }
      : { stock: 4 });
    const items = [{ medication: 'med', quantity: 1 }, { medication: 'travel-kit', kind: 'bundle', quantity: 1 }];
    const pickup = await POST(request({ items, checkout: { ...checkout, receiving: 'pickup', pharmacyId: 'center' } }));
    expect(pickup.status).toBe(400);
    expect((await pickup.json()).error).toContain('Немає аптеки з усіма товарами');
    expect(mocks.session.abortTransaction).toHaveBeenCalledOnce();
    expect(mocks.session.commitTransaction).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();

    const courier = await POST(request({ items }));
    expect(courier.status).toBe(200);
    expect(await courier.json()).toMatchObject({ subtotal: 394, total: 453, checkout: { delivery: { method: 'courier' } } });
    expect(mocks.session.commitTransaction).toHaveBeenCalledOnce();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/orders/route';
import { PATCH } from '@/app/api/orders/[id]/route';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), restore: vi.fn(), create: vi.fn(), bundle: vi.fn(), order: vi.fn(), status: vi.fn(), session: { startTransaction: vi.fn(), commitTransaction: vi.fn(), abortTransaction: vi.fn(), endSession: vi.fn() } }));
vi.mock('@/lib/auth', () => ({ getAuthUser: mocks.auth }));
vi.mock('@/lib/db', () => ({ connectDB: vi.fn(), BundleModel: { findOne: () => ({ session: mocks.bundle }) }, MedicationModel: { findOneAndUpdate: mocks.update, findByIdAndUpdate: (...args: unknown[]) => ({ session: () => mocks.restore(...args) }) }, OrderModel: { create: mocks.create, findById: () => ({ session: mocks.order }), findByIdAndUpdate: mocks.status } }));
vi.mock('mongoose', () => ({ default: { startSession: async () => mocks.session } }));
const checkout = { name: 'Тестовий покупець', phone: '+380670000000', email: '', receiving: 'pickup', pharmacyId: 'center', city: '', address: '', payment: 'on-receipt' };
const components = [{ medication: 'bandage', quantity: 2, name: 'Бинт' }, { medication: 'plasters', quantity: 1, name: 'Пластирі' }];
const request = (items: { medication: string; kind?: string; quantity: number }[] = [{ medication: 'kit', kind: 'bundle', quantity: 2 }]) => new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ items, checkout }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.bundle.mockResolvedValue({ name: 'Набір', description: 'Опис', image: '/kit.png', slug: 'travel', price: 249, components });
  mocks.update.mockResolvedValue({ price: 10, requiresPrescription: false });
  mocks.restore.mockResolvedValue({});
  mocks.create.mockImplementation(async data => data.map((o: object) => ({ ...o, _id: 'order' })));
  mocks.status.mockResolvedValue({ status: 'CANCELLED' });
});

describe('bundle orders compatibility', () => {
  it('charges for two fixed kits and stores their immutable composition', async () => {
    const response = await POST(request()); const data = await response.json();
    expect(response.status).toBe(200); expect(data.total).toBe(498);
    expect(data.items[0]).toMatchObject({ medication: 'kit', kind: 'bundle', components, price: 249, quantity: 2 });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ _id: 'bandage', stock: { $gte: 4 } }), { $inc: { stock: -4 } }, expect.anything());
    expect(mocks.session.commitTransaction).toHaveBeenCalledOnce();
  });
  it('supports ordinary medication and kits in the same transaction', async () => {
    const response = await POST(request([{ medication: 'kit', kind: 'bundle', quantity: 1 }, { medication: 'nurofen', quantity: 2 }]));
    const data = await response.json();
    expect(response.status).toBe(200); expect(data.total).toBe(269); expect(data.items).toHaveLength(2);
  });
  it('aborts the entire order if any component is unavailable', async () => {
    mocks.update.mockResolvedValueOnce({ price: 10 }).mockResolvedValueOnce(null);
    expect((await POST(request())).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.session.abortTransaction).toHaveBeenCalledOnce();
  });
  it('does not accept an unavailable kit or a client-supplied replacement composition', async () => {
    mocks.bundle.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(400); expect(mocks.update).not.toHaveBeenCalled();
  });
  it('ignores forged kit price and client-provided components', async () => {
    const response = await POST(new Request('http://localhost/api/orders', { method: 'POST', body: JSON.stringify({ checkout, total: 1, items: [{ medication: 'kit', kind: 'bundle', quantity: 1, price: 1, components: [{ medication: 'unrelated', quantity: 1 }] }] }) }));
    const data = await response.json();
    expect(response.status).toBe(200); expect(data.total).toBe(249);
    expect(data.items[0].components).toEqual(components);
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({ _id: 'unrelated' }), expect.anything(), expect.anything());
  });
  it('restores order-time components atomically and never restocks a second cancellation', async () => {
    mocks.auth.mockResolvedValue({ _id: 'admin', role: 'ADMIN' });
    const order = { status: 'PENDING', items: [{ medication: 'kit', kind: 'bundle', quantity: 2, price: 249, components }] };
    mocks.order.mockResolvedValue(order);
    const cancel = () => PATCH(new Request('http://localhost/api/orders/order', { method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }) }), { params: Promise.resolve({ id: 'order' }) });
    expect((await cancel()).status).toBe(200);
    expect(mocks.restore).toHaveBeenCalledWith('bandage', { $inc: { stock: 4 } });
    expect(mocks.restore).toHaveBeenCalledWith('plasters', { $inc: { stock: 2 } });
    mocks.restore.mockClear(); mocks.order.mockResolvedValue({ ...order, status: 'CANCELLED' });
    expect((await cancel()).status).toBe(200); expect(mocks.restore).not.toHaveBeenCalled();
  });
});

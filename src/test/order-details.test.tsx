import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderDetails } from '@/components/OrderDetails';
import { AccountOrders, type AccountOrder } from '@/components/AccountOrders';
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/lib/useHydrated', () => ({ useHydrated: () => true }));
const order: AccountOrder = { _id: 'a'.repeat(24), user: 'owner', status: 'PENDING', createdAt: '2026-11-23T12:00:00Z', total: 249, items: [{ _id: 'kit', kind: 'bundle', name: 'Тестова аптечка', description: 'Демонстраційний набір', category: 'Тест', manufacturer: 'Тест', price: 249, stock: 2, quantity: 1 }], checkout: { contact: { name: 'Тестовий покупець', phone: '+380670000000' }, delivery: { method: 'pickup', pharmacyName: 'Тестова аптека', address: 'Тестова, 1', fee: 0 }, payment: 'on-receipt' } };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('order details', () => {
  it('shows receiving and payment on list cards using saved order data', () => {
    const courier: AccountOrder = { ...order, _id: 'b'.repeat(24), status: 'COMPLETED', checkout: { ...order.checkout!, delivery: { method: 'courier', address: 'Тестова, 1', fee: 59 } } };
    render(<AccountOrders ownerId="owner" orders={[order, courier]} />);
    expect(screen.getByText('1 товар · Самовивіз з аптеки')).toBeInTheDocument();
    expect(screen.getByText('1 товар · Кур’єрська доставка')).toBeInTheDocument();
    expect(screen.getByText('Оплата при отриманні')).toBeInTheDocument();
    expect(screen.getByText('Оплачено при отриманні')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Скасувати замовлення' })).toHaveLength(1);
  });
  it('does not invent receiving or payment data for legacy list cards', () => {
    render(<AccountOrders ownerId="owner" orders={[{ ...order, checkout: undefined }]} />);
    expect(screen.getByText('1 товар · Спосіб отримання не вказано')).toBeInTheDocument();
    expect(screen.getByText('Не вказано')).toBeInTheDocument();
  });
  it.each(['SHIPPED', 'COMPLETED', 'CANCELLED'] as const)('hides cancellation on %s list cards', status => {
    render(<AccountOrders ownerId="owner" orders={[{ ...order, status }]} />);
    expect(screen.queryByRole('button', { name: 'Скасувати замовлення' })).not.toBeInTheDocument();
  });
  it('cancels from the list only after confirmation and immediately shows the saved refund state', async () => {
    const paid: AccountOrder = { ...order, checkout: { ...order.checkout!, payment: 'online', paymentMode: 'demo', demoPaymentStatus: 'paid' } };
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'CANCELLED', checkout: { ...paid.checkout, demoRefundStatus: 'pending' } }) });
    vi.stubGlobal('fetch', request);
    render(<AccountOrders ownerId="owner" orders={[paid]} />);
    expect(screen.getByText('Оплачено онлайн')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати замовлення' }));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Залишити замовлення' }));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати замовлення' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Скасувати замовлення' }));
    expect(await screen.findByText('Повернення в обробці')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Скасовано');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Скасувати замовлення' })).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledExactlyOnceWith('/api/orders/' + order._id, expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'CANCELLED' }) }));
    expect(navigation.refresh).toHaveBeenCalledOnce();
  });
  it('updates the list when refreshed order data arrives', () => {
    const view = render(<AccountOrders ownerId="owner" orders={[order]} />);
    expect(screen.getByRole('button', { name: 'Скасувати замовлення' })).toBeInTheDocument();
    view.rerender(<AccountOrders ownerId="owner" orders={[{ ...order, status: 'SHIPPED', checkout: { ...order.checkout!, delivery: { method: 'courier', address: 'Тестова, 1', fee: 59 } } }]} />);
    expect(screen.getByRole('status')).toHaveTextContent('Передано кур’єру');
    expect(screen.getByText('1 товар · Кур’єрська доставка')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Скасувати замовлення' })).not.toBeInTheDocument();
  });
  it('keeps fixture metadata out of the product card layout', () => {
    const demo = { ...order, _id: 'b'.repeat(24), items: [{ ...order.items[0], name: '[ДЕМО] В обробці' }] };
    render(<AccountOrders ownerId="owner" orders={[order, demo]} />);
    expect(screen.queryByText('Демонстраційне замовлення')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Переглянути замовлення' })).toHaveLength(2);
  });
  it('links list cards to owned details and handles an inaccessible ID without falling back', () => {
    const view = render(<AccountOrders ownerId="owner" orders={[order]} />);
    expect(screen.getByRole('link', { name: 'Переглянути замовлення' })).toHaveAttribute('href', '/profile?tab=orders&order=' + order._id);
    view.rerender(<AccountOrders ownerId="another-owner" orders={[order]} orderId={order._id} />);
    expect(screen.getByText('Замовлення недоступне')).toBeInTheDocument();
    expect(screen.queryByText('Тестова аптечка')).not.toBeInTheDocument();
  });
  it('renders saved receiving/contact details, kit quantity and totals', () => {
    render(<OrderDetails order={order} />);
    expect(screen.getByRole('region', { name: 'Отримання та оплата' })).toHaveTextContent('Тестовий покупець');
    expect(screen.getByRole('region', { name: 'Деталі замовлення' })).toHaveTextContent('Тестова аптечка');
    expect(screen.getByText('Тестова аптека, Тестова, 1')).toBeInTheDocument();
  });
  it('does not cancel until confirmation and shows the refund state after success', async () => {
    const paid = { ...order, checkout: { ...order.checkout!, payment: 'online' as const, paymentMode: 'demo' as const, demoPaymentStatus: 'paid' as const } };
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'CANCELLED', checkout: { ...paid.checkout, demoRefundStatus: 'pending' } }) }); vi.stubGlobal('fetch', request);
    render(<OrderDetails order={paid} />);
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати замовлення' }));
    let dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('повернення оплачених коштів');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Залишити замовлення' }));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати замовлення' })); dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Скасувати замовлення' }));
    await screen.findByText('Повернення коштів в обробці');
    expect(screen.queryByRole('button', { name: 'Скасувати замовлення' })).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledOnce(); expect(screen.getByText('До повернення')).toBeInTheDocument();
  });
  it('keeps a server error in the dialog without changing the order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Статус уже змінено.' }) }));
    render(<OrderDetails order={order} />); fireEvent.click(screen.getByRole('button', { name: 'Скасувати замовлення' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Скасувати замовлення' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Статус уже змінено.');
    expect(screen.getByText('Замовлення прийнято')).toBeInTheDocument();
  });
  it('blocks duplicate submissions while cancellation is pending', async () => {
    let finish!: (response: unknown) => void;
    const request = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })); vi.stubGlobal('fetch', request);
    render(<OrderDetails order={order} />);
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати замовлення' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Скасувати замовлення' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(request).toHaveBeenCalledOnce();
    expect(within(dialog).getByRole('button', { name: 'Залишити замовлення' })).toBeDisabled();
    finish({ ok: true, json: async () => ({ status: 'CANCELLED', checkout: order.checkout }) });
    await screen.findByText('Замовлення скасовано');
  });
  it('shows courier addresses and never offers cancellation after shipment', () => {
    render(<OrderDetails order={{ ...order, status: 'SHIPPED', checkout: { ...order.checkout!, delivery: { method: 'courier', city: 'Тестове місто', address: 'Тестова, 1', fee: 59 } }, total: 308 }} />);
    expect(screen.getByText('Тестове місто, Тестова, 1')).toBeInTheDocument();
    expect(screen.getByText('Замовлення передано кур’єру')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Скасувати замовлення' })).not.toBeInTheDocument();
  });
  it('keeps fulfillment and payment badge colors independent', () => {
    const paid = { ...order, checkout: { ...order.checkout!, paymentMode: 'demo' as const, demoPaymentStatus: 'paid' as const } };
    const view = render(<OrderDetails order={paid} />);
    expect(screen.getByText('В обробці').className).toContain('warning');
    expect(screen.getByText('Оплату підтверджено').parentElement?.className).toContain('success');
    view.rerender(<OrderDetails order={{ ...paid, status: 'READY_FOR_PICKUP' }} />);
    expect(screen.getByText('Готове до видачі').className).toContain('info');
    expect(screen.getByText('Замовлення готове до видачі').parentElement?.className).toContain('info');
  });
  it('handles old orders without checkout and completed orders truthfully', () => {
    const view = render(<OrderDetails order={{ ...order, checkout: undefined }} />);
    expect(screen.getAllByText('Не вказано').length).toBeGreaterThan(1);
    view.rerender(<OrderDetails order={{ ...order, status: 'COMPLETED' }} />);
    expect(screen.getByText('Дякуємо за замовлення!')).toBeInTheDocument();
    expect(screen.getByText('Сплачено')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Скасувати замовлення' })).not.toBeInTheDocument();
  });
  it.each(['CANCELLED', 'COMPLETED', 'SHIPPED'] as const)('does not offer payment retry for %s', status => {
    render(<OrderDetails order={{ ...order, status, checkout: { ...order.checkout!, payment: 'online', paymentMode: 'demo', demoPaymentStatus: 'failed' } }} />);
    expect(screen.queryByRole('button', { name: 'Повторити оплату' })).not.toBeInTheDocument();
  });
});

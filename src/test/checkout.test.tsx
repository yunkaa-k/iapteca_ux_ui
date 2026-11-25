import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckoutContent } from '@/components/CheckoutContent';
import { OrderResult } from '@/components/OrderResult';
import { useCheckoutStore } from '@/lib/store/checkoutStore';
import { useCartStore, type CartItem } from '@/lib/store/cartStore';
import { useAuthStore } from '@/lib/store/authStore';
import { usePrescriptionStore } from '@/lib/store/prescriptionStore';
import { parseCheckout, validateCheckout, emptyCheckout } from '@/lib/checkout';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/lib/useHydrated', () => ({ useHydrated: () => true }));
const item: CartItem = { _id: 'medicine', name: 'Тестовий препарат', description: '20 табл.', manufacturer: 'Demo', category: 'Demo', stock: 5, price: 25, quantity: 1, requiresPrescription: false };
beforeEach(() => { vi.clearAllMocks(); useCartStore.setState({ items: [item] }); useAuthStore.setState({ user: null, isLoading: false }); usePrescriptionStore.getState().clear(); useCheckoutStore.setState({ drafts: {}, attempts: {}, receipts: {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function contacts() {
  fireEvent.change(screen.getByLabelText('Ім’я та прізвище *'), { target: { value: 'Тестовий покупець' } });
  fireEvent.change(screen.getByLabelText('Номер телефону *'), { target: { value: '+380 67 000 00 00' } });
}
function pickup() { contacts(); fireEvent.click(screen.getByRole('button', { name: 'Обрати iApteca · Центр' })); fireEvent.click(screen.getByRole('radio', { name: /^При отриманні/ })); }

describe('checkout and receipt', () => {
  it('shows the complete empty form and requires its fields instead of creating an order immediately', () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    render(<CheckoutContent />);
    expect(screen.getByRole('heading', { name: 'Контактні дані' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Спосіб отримання' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Спосіб оплати' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Підтвердити замовлення' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Ім’я та прізвище *'), { target: { value: 'Тест' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Перевірте обов’язкові поля');
    expect(screen.getByLabelText('Номер телефону *')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('creates a guest order, preserves a receipt before clearing cart and displays the real confirmation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ _id: 'order12345678', createdAt: '2026-11-20T12:00:00Z', total: 25, items: [{ medication: item._id, quantity: 1, price: 25 }] }) });
    vi.stubGlobal('fetch', fetchMock);
    const view = render(<CheckoutContent />); pickup();
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/order/result?order=order12345678'));
    expect(useCartStore.getState().items).toHaveLength(0);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.checkout.pharmacyId).toBe('center');
    expect(useCheckoutStore.getState().receipts.order12345678.checkout.contact.phone).toBe('+380670000000');
    const restored = JSON.parse(JSON.stringify(useCheckoutStore.getState().receipts)); useCheckoutStore.setState({ receipts: restored });
    view.unmount(); render(<OrderResult orderId="order12345678" />);
    expect(screen.getByRole('heading', { name: 'Замовлення оформлено!' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Тестовий препарат');
    expect(screen.getByText('Тестовий покупець')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Копіювати номер замовлення' })).toBeInTheDocument();
  });
  it('adds courier delivery, requires its address and preserves selection when switching methods', () => {
    render(<CheckoutContent />); contacts();
    fireEvent.click(screen.getByRole('radio', { name: /^Кур’єрська доставка/ }));
    expect(screen.getByRole('complementary', { name: 'Ваше замовлення' })).toHaveTextContent('84 грн');
    fireEvent.change(screen.getByLabelText('Місто *'), { target: { value: 'Харків' } });
    fireEvent.change(screen.getByLabelText('Вулиця, будинок, квартира *'), { target: { value: 'Тестова, 12, кв. 4' } });
    fireEvent.click(screen.getByRole('radio', { name: /^Самовивіз з аптеки/ }));
    expect(screen.queryByLabelText('Місто *')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /^Кур’єрська доставка/ }));
    expect(screen.getByLabelText('Місто *')).toHaveValue('Харків');
  });
  it('keeps entered details and cart on server errors and does not show a fake success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Недостатньо товару.' }) }));
    render(<CheckoutContent />); pickup(); fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Недостатньо товару.');
    expect(screen.getByRole('heading', { name: 'Не вдалося оформити замовлення' })).toHaveFocus();
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCheckoutStore.getState().receipts).toEqual({});
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'До оформлення' }));
    expect(screen.getByLabelText('Ім’я та прізвище *')).toHaveValue('Тестовий покупець');
    expect(screen.getByRole('heading', { name: 'Оформлення замовлення' })).toHaveFocus();
  });
  it('uses the same submission key after a lost response and clears the attempt when the receipt is saved', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Response lost')).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ _id: 'restored-order', total: 25 }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<CheckoutContent />);
    pickup();
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Спробувати ще раз' }));

    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/order/result?order=restored-order'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const key = new Headers(fetchMock.mock.calls[0][1].headers).get('Idempotency-Key');
    expect(key).toMatch(/^[a-f\d-]{36}$/);
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Idempotency-Key')).toBe(key);
    expect(useCheckoutStore.getState().attempts).toEqual({});
  });
  it('uses a fresh submission key after a meaningful checkout edit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'Недостатньо товару.' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<CheckoutContent />);
    pickup();
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));
    fireEvent.click(await screen.findByRole('button', { name: 'До оформлення' }));
    fireEvent.change(screen.getByLabelText('Ім’я та прізвище *'), { target: { value: 'Інший покупець' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));
    await screen.findByRole('heading', { name: 'Не вдалося оформити замовлення' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map(([, options]) => new Headers(options.headers).get('Idempotency-Key'));
    expect(keys.every(key => key)).toBe(true);
    expect(new Set(keys).size).toBe(2);
  });
  it('allows pickup for a mixed basket without depending on product names', () => {
    useCartStore.setState({ items: [
      { ...item, name: 'Нурофен 200 мг №24', price: 145 },
      { ...item, _id: 'travel-kit', kind: 'bundle', slug: 'travel', name: 'Аптечка «Для подорожі»', price: 249 },
    ] });
    render(<CheckoutContent />);
    pickup();
    expect(screen.getByRole('button', { name: 'Обрати iApteca · Центр' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('heading', { name: 'Немає аптеки з усіма товарами' })).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Ваше замовлення' })).toHaveTextContent('394 грн');
    expect(screen.getByRole('button', { name: 'Підтвердити замовлення' })).toBeEnabled();
  });
  it('offers courier delivery in the explicit pickup-unavailable preview without losing contact details', () => {
    vi.stubGlobal('fetch', vi.fn());
    useCartStore.setState({ items: [
      { ...item, name: 'Нурофен 200 мг №24', price: 145 },
      { ...item, _id: 'travel-kit', kind: 'bundle', slug: 'travel', name: 'Аптечка «Для подорожі»', price: 249 },
    ] });
    render(<CheckoutContent pickupUnavailablePreview />);
    contacts();
    fireEvent.click(screen.getByRole('radio', { name: /^Самовивіз з аптеки/ }));
    expect(screen.getByRole('heading', { name: 'Немає аптеки з усіма товарами' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Повернутися до кошика' })).toHaveAttribute('href', '/cart');
    expect(screen.queryByRole('button', { name: 'Обрати iApteca · Центр' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Підтвердити замовлення' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Обрати доставку' }));
    expect(screen.getByRole('radio', { name: /^Кур’єрська доставка/ })).toBeChecked();
    expect(screen.getByLabelText('Місто *')).toHaveFocus();
    expect(screen.getByLabelText('Ім’я та прізвище *')).toHaveValue('Тестовий покупець');
    expect(screen.getByRole('complementary', { name: 'Ваше замовлення' })).toHaveTextContent('453 грн');
    fireEvent.click(screen.getByRole('radio', { name: /^Самовивіз з аптеки/ }));
    expect(screen.getByRole('heading', { name: 'Немає аптеки з усіма товарами' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Підтвердити замовлення' })).toBeDisabled();
  });
  it('does not invent order data when receipt storage is missing', () => {
    render(<OrderResult orderId="unknown" />);
    expect(screen.getByRole('heading', { name: 'Підтвердження недоступне' })).toBeInTheDocument();
    expect(screen.queryByText('Замовлення оформлено!')).not.toBeInTheDocument();
  });
  it('expands receipt rows without changing the full order total or persisted items', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({ ...item, _id: `item-${index}`, name: `Позиція ${index + 1}` }));
    useCheckoutStore.setState({ receipts: { many: { id: 'many', createdAt: '2026-11-22T12:00:00Z', items, total: 125, checkout: { contact: { name: 'Тест', phone: '+380670000000' }, delivery: { method: 'pickup', fee: 0 }, payment: 'on-receipt' } } } });
    render(<OrderResult orderId="many" />);
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('Показано 3 з 5 товарів')).toBeInTheDocument();
    expect(screen.getByText('125 грн')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Показати ще 2' }));
    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getByText('Усі 5 товарів')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Згорнути' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Згорнути' }));
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('125 грн')).toBeInTheDocument();
    expect(useCheckoutStore.getState().receipts.many.items).toHaveLength(5);
  });
  it('validates delivery and payment on the server and allows omitted email', () => {
    const form = { ...emptyCheckout, name: 'Тестовий покупець', phone: '0670000000', receiving: 'pickup' as const, pharmacyId: 'center', payment: 'on-receipt' as const };
    expect(validateCheckout(form)).toEqual({});
    expect(parseCheckout(form).details?.contact.phone).toBe('+380670000000');
    expect(parseCheckout({ ...form, pharmacyId: 'untrusted' }).errors?.pharmacyId).toBeTruthy();
    expect(parseCheckout({ ...form, payment: 'paid' }).errors?.payment).toBeTruthy();
  });
  it.each([{ card: '4242424242424242', outcome: 'success', status: 'paid' }, { card: '4000000000000002', outcome: 'failure', status: 'failed' }])('requires demo fields and keeps card details out of storage and requests: $outcome', async fixture => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ _id: 'new-online-order', total: 25, checkout: { contact: { name: 'Тестовий покупець', phone: '+380670000000' }, delivery: { method: 'pickup', fee: 0 }, payment: 'online', paymentMode: 'demo', demoPaymentStatus: fixture.status } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<CheckoutContent />); pickup();
    fireEvent.click(screen.getByRole('radio', { name: /^Онлайн/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));
    expect(screen.getByLabelText('Номер картки *')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Номер картки *'), { target: { value: fixture.card } });
    fireEvent.change(screen.getByLabelText('Термін дії *'), { target: { value: '1235' } });
    fireEvent.change(screen.getByLabelText('CVV / CVC *'), { target: { value: '123' } });
    expect(JSON.stringify(useCheckoutStore.getState().drafts)).not.toContain('4242');
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.checkout).toMatchObject({ payment: 'online', demoPaymentOutcome: fixture.outcome });
    expect(payload.checkout).not.toHaveProperty('cvv');
    expect(fetchMock.mock.calls[0][1].body).not.toContain('4242');
    expect(useCheckoutStore.getState().receipts['new-online-order'].checkout.demoPaymentStatus).toBe(fixture.status);
    expect(JSON.stringify(useCheckoutStore.getState().receipts)).not.toContain('4242');
  });
  it('retries a failed payment on the same receipt without creating another order', async () => {
    const checkout = { contact: { name: 'Тест', phone: '+380670000000' }, delivery: { method: 'pickup' as const, fee: 0 }, payment: 'online' as const, paymentMode: 'demo' as const, demoPaymentStatus: 'failed' as const };
    const id = 'a'.repeat(24);
    useCheckoutStore.setState({ receipts: { [id]: { id, createdAt: '2026-11-22', items: [item], total: 25, checkout, guestPaymentToken: 'b'.repeat(64) } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checkout: { ...checkout, demoPaymentStatus: 'paid' } }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<OrderResult orderId={id} />);
    expect(screen.queryByRole('heading', { name: 'Замовлення оформлено та оплачено!' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Повторити оплату' }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Номер картки *'), { target: { value: '4242424242424242' } });
    fireEvent.change(screen.getByLabelText('Термін дії *'), { target: { value: '1235' } });
    fireEvent.change(screen.getByLabelText('CVV / CVC *'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити оплату' }));
    await screen.findByRole('heading', { name: 'Замовлення оформлено та оплачено!' });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(`/api/orders/${id}/demo-payment`, expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + 'b'.repeat(64) }, body: JSON.stringify({ outcome: 'success' }) }));
    expect(useCheckoutStore.getState().receipts[id].total).toBe(25);
    expect(useCheckoutStore.getState().receipts[id].items).toHaveLength(1);
  });
  it('leaves a failed payment unchanged on retry errors and prevents double submission', async () => {
    const id = 'a'.repeat(24);
    const checkout = { contact: { name: 'Тест', phone: '+380670000000' }, delivery: { method: 'pickup' as const, fee: 0 }, payment: 'online' as const, paymentMode: 'demo' as const, demoPaymentStatus: 'failed' as const };
    useCheckoutStore.setState({ receipts: { [id]: { id, createdAt: '2026-11-22', items: [item], total: 25, checkout } } });
    let finish!: (value: unknown) => void;
    const fetchMock = vi.fn(() => new Promise(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetchMock);
    render(<OrderResult orderId={id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Повторити оплату' }));
    fireEvent.change(screen.getByLabelText('Номер картки *'), { target: { value: '4242424242424242' } });
    fireEvent.change(screen.getByLabelText('Термін дії *'), { target: { value: '1235' } });
    fireEvent.change(screen.getByLabelText('CVV / CVC *'), { target: { value: '123' } });
    const retry = screen.getByRole('button', { name: 'Підтвердити оплату' });
    fireEvent.click(retry); fireEvent.click(retry);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(retry).toBeDisabled();
    finish({ ok: false, json: async () => ({ error: 'Unavailable' }) });
    await screen.findByRole('alert');
    expect(useCheckoutStore.getState().receipts[id].checkout.demoPaymentStatus).toBe('failed');
    expect(screen.queryByRole('heading', { name: 'Замовлення оформлено та оплачено!' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Підтвердити оплату' })).toBeEnabled();
  });
  it('allows cancelling a retry and keeps a second failing card attempt unpaid', async () => {
    const id = 'a'.repeat(24);
    const checkout = { contact: { name: 'Тест', phone: '+380670000000' }, delivery: { method: 'pickup' as const, fee: 0 }, payment: 'online' as const, paymentMode: 'demo' as const, demoPaymentStatus: 'failed' as const };
    useCheckoutStore.setState({ receipts: { [id]: { id, createdAt: '2026-11-22', items: [item], total: 25, checkout } } });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ checkout }) }); vi.stubGlobal('fetch', fetchMock);
    render(<OrderResult orderId={id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Повторити оплату' }));
    expect(screen.getByLabelText('Номер картки *')).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити оплату' }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Повторити оплату' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Повторити оплату' }));
    fireEvent.change(screen.getByLabelText('Номер картки *'), { target: { value: '4000000000000002' } });
    fireEvent.change(screen.getByLabelText('Термін дії *'), { target: { value: '1235' } });
    fireEvent.change(screen.getByLabelText('CVV / CVC *'), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити оплату' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Оплату не підтверджено');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ outcome: 'failure' });
    expect(useCheckoutStore.getState().receipts[id].checkout.demoPaymentStatus).toBe('failed');
    expect(screen.queryByRole('heading', { name: 'Замовлення оформлено та оплачено!' })).not.toBeInTheDocument();
  });
});

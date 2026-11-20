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
beforeEach(() => { vi.clearAllMocks(); useCartStore.setState({ items: [item] }); useAuthStore.setState({ user: null, isLoading: false }); usePrescriptionStore.getState().clear(); useCheckoutStore.setState({ drafts: {}, receipts: {} }); });
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
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(screen.getByLabelText('Ім’я та прізвище *')).toHaveValue('Тестовий покупець');
    expect(useCheckoutStore.getState().receipts).toEqual({});
    expect(navigation.push).not.toHaveBeenCalled();
  });
  it('does not invent order data when receipt storage is missing', () => {
    render(<OrderResult orderId="unknown" />);
    expect(screen.getByRole('heading', { name: 'Підтвердження недоступне' })).toBeInTheDocument();
    expect(screen.queryByText('Замовлення оформлено!')).not.toBeInTheDocument();
  });
  it('validates delivery and payment on the server and allows omitted email', () => {
    const form = { ...emptyCheckout, name: 'Тестовий покупець', phone: '0670000000', receiving: 'pickup' as const, pharmacyId: 'center', payment: 'on-receipt' as const };
    expect(validateCheckout(form)).toEqual({});
    expect(parseCheckout(form).details?.contact.phone).toBe('+380670000000');
    expect(parseCheckout({ ...form, pharmacyId: 'untrusted' }).errors?.pharmacyId).toBeTruthy();
    expect(parseCheckout({ ...form, payment: 'paid' }).errors?.payment).toBeTruthy();
  });
});

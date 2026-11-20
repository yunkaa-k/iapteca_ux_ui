import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountOrders } from '@/components/AccountOrders';
import { useCheckoutStore } from '@/lib/store/checkoutStore';
import { CheckoutContent } from '@/components/CheckoutContent';
import { PrescriptionVerification } from '@/components/PrescriptionVerification';
import { useCartStore, type CartItem } from '@/lib/store/cartStore';
import { useAuthStore } from '@/lib/store/authStore';
import { usePrescriptionStore, REVIEW_DELAY } from '@/lib/store/prescriptionStore';
import { requestStatus, usePrescriptionRequestStore } from '@/lib/store/prescriptionRequestStore';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/lib/useHydrated', () => ({ useHydrated: () => true }));
const user = { _id: 'owner-one', email: 'demo@example.test', role: 'CUSTOMER' as const, isBanned: false };
const rx: CartItem = { _id: 'medicine-a', name: 'Препарат А', description: 'Демонстраційний товар', category: 'Test', manufacturer: 'Test', stock: 5, quantity: 1, requiresPrescription: true, price: 120 };
const other: CartItem = { ...rx, _id: 'medicine-b', name: 'Препарат Б', requiresPrescription: false, price: 40 };
function createRequest(name = 'clear.jpg') {
  const draft = usePrescriptionStore.getState();
  draft.attach(rx, name); draft.submit([rx, other]);
  return usePrescriptionRequestStore.getState().create(user._id, [rx, other], usePrescriptionStore.getState().entries)!;
}
beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user, isLoading: false });
  useCartStore.setState({ items: [rx, other] });
  usePrescriptionStore.getState().clear();
  usePrescriptionRequestStore.setState({ requests: [] });
  useCheckoutStore.setState({ drafts: {}, receipts: {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('account prescription requests', () => {
  it('saves one independent snapshot and avoids duplicate submissions', () => {
    const id = createRequest();
    expect(createRequest()).toBe(id);
    useCartStore.setState({ items: [{ ...other, quantity: 4 }] });
    usePrescriptionStore.getState().clear();
    const request = usePrescriptionRequestStore.getState().requests[0];
    expect(request.items.map(item => item.quantity)).toEqual([1, 1]);
    expect(request.entries[rx._id].fileName).toBe('clear.jpg');
    expect(usePrescriptionRequestStore.getState().requests).toHaveLength(1);
  });
  it('keeps the attached recipe and asks a guest to sign in before saving', () => {
    useAuthStore.setState({ user: null });
    usePrescriptionStore.getState().attach(rx, 'photo.jpg');
    render(<PrescriptionVerification />);
    fireEvent.click(screen.getByRole('button', { name: 'Надіслати на перевірку' }));
    expect(navigation.push).toHaveBeenCalledWith('/login?returnTo=%2Fcart%2Fprescription');
    expect(usePrescriptionStore.getState().entries[rx._id].fileName).toBe('photo.jpg');
    expect(usePrescriptionRequestStore.getState().requests).toHaveLength(0);
  });
  it('updates status in My orders after leaving the upload screen', () => {
    vi.useFakeTimers();
    const id = createRequest();
    render(<AccountOrders ownerId={user._id} orders={[]} />);
    expect(screen.getByText('Очікує перевірки рецепта')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(REVIEW_DELAY));
    expect(screen.getByText('Рецепт підтверджено')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Заявка №/ })).toHaveAttribute('href', `/profile?tab=orders&request=${id}`);
  });
  it('hides other owners requests and rejects cross-account changes', () => {
    const id = createRequest();
    render(<AccountOrders ownerId="different-owner" orders={[]} requestId={id} />);
    expect(screen.getByText('Заявка недоступна')).toBeInTheDocument();
    expect(screen.queryByText('clear.jpg')).not.toBeInTheDocument();
    expect(usePrescriptionRequestStore.getState().cancel(id, 'different-owner')).toBe(false);
    usePrescriptionRequestStore.getState().replaceFile(id, 'different-owner', rx._id, 'wrong.jpg');
    expect(usePrescriptionRequestStore.getState().requests[0].entries[rx._id].fileName).toBe('clear.jpg');
  });
  it('restores a serialized request and replaces only the rejected file', () => {
    vi.useFakeTimers();
    const second = { ...rx, _id: 'rx-two' };
    const draft = usePrescriptionStore.getState();
    draft.attach(rx, 'blur.jpg'); draft.attach(second, 'clear.jpg'); draft.submit([rx, second]);
    const store = usePrescriptionRequestStore.getState();
    const id = store.create(user._id, [rx, second], usePrescriptionStore.getState().entries)!;
    usePrescriptionRequestStore.setState({ requests: JSON.parse(JSON.stringify(usePrescriptionRequestStore.getState().requests)) });
    vi.advanceTimersByTime(REVIEW_DELAY); store.settle();
    expect(requestStatus(usePrescriptionRequestStore.getState().requests[0])).toBe('needs-new-photo');
    store.replaceFile(id, user._id, rx._id, 'replacement.jpg'); store.submit(id, user._id);
    expect(usePrescriptionRequestStore.getState().requests[0].entries[second._id].status).toBe('approved');
    vi.advanceTimersByTime(REVIEW_DELAY); store.settle();
    expect(requestStatus(usePrescriptionRequestStore.getState().requests[0])).toBe('approved');
  });
  it('asks for cancellation confirmation; repeated cancellation never alters cart or stock', () => {
    const id = createRequest();
    render(<AccountOrders ownerId={user._id} orders={[]} requestId={id} />);
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати заявку' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Скасувати заявку?');
    fireEvent.click(screen.getByRole('button', { name: 'Залишити заявку' }));
    expect(usePrescriptionRequestStore.getState().requests[0].state).toBe('active');
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати заявку' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Скасувати заявку' }).at(-1)!);
    expect(usePrescriptionRequestStore.getState().requests[0].state).toBe('cancelled');
    expect(usePrescriptionRequestStore.getState().cancel(id, user._id)).toBe(false);
    expect(useCartStore.getState().items).toEqual([rx, other]);
  });
  it('checks out a saved request without losing unrelated current cart products', async () => {
    const id = createRequest();
    const store = usePrescriptionRequestStore.getState();
    usePrescriptionRequestStore.setState({ requests: store.requests.map(r => ({ ...r, entries: { [rx._id]: { fileName: 'clear.jpg', quantity: 1, status: 'approved' } } })) });
    const unrelated = { ...other, _id: 'new-purchase', quantity: 2 };
    useCartStore.setState({ items: [unrelated] });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ _id: 'new-order' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<CheckoutContent requestId={id} />);
    fireEvent.change(screen.getByLabelText('Ім’я та прізвище *'), { target: { value: 'Тестовий покупець' } });
    fireEvent.change(screen.getByLabelText('Номер телефону *'), { target: { value: '+380670000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Обрати iApteca · Центр' }));
    fireEvent.click(screen.getByRole('radio', { name: /^При отриманні/ }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Підтвердити замовлення' })));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.items.map((line: { medication: string }) => line.medication)).toEqual([rx._id, other._id]);
    expect(useCartStore.getState().items).toEqual([unrelated]);
    expect(usePrescriptionRequestStore.getState().requests[0].state).toBe('completed');
  });
});

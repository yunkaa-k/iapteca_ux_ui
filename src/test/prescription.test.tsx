import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrescriptionVerification } from '@/components/PrescriptionVerification';
import CheckoutPage from '@/app/checkout/page';
import { useCartStore, type CartItem } from '@/lib/store/cartStore';
import { prescriptionFor, prescriptionsApproved, REVIEW_DELAY, usePrescriptionStore } from '@/lib/store/prescriptionStore';

vi.mock('@/lib/useHydrated', () => ({ useHydrated: () => true }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
const rx: CartItem = { _id: 'rx-one', name: 'Препарат один', description: '500 мг · 10 капс.', category: 'Test', manufacturer: 'Test', price: 120, stock: 5, quantity: 1, requiresPrescription: true };
const second: CartItem = { ...rx, _id: 'rx-two', name: 'Препарат два' };
beforeEach(() => {
  useCartStore.setState({ items: [rx] });
  usePrescriptionStore.getState().clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('demo prescription verification', () => {
  it('requires every prescription and keeps each slot independent', () => {
    const store = usePrescriptionStore.getState();
    store.attach(rx, 'first.jpg');
    store.submit([rx, second]);
    expect(usePrescriptionStore.getState().entries[rx._id].status).toBe('attached');
    expect(prescriptionsApproved([rx, second], usePrescriptionStore.getState().entries)).toBe(false);
    store.attach(second, 'second.jpg');
    store.remove(rx._id);
    expect(prescriptionFor(second, usePrescriptionStore.getState().entries)?.fileName).toBe('second.jpg');
  });
  it('restores pending review from serializable state and resolves only after its deadline', () => {
    vi.useFakeTimers();
    const store = usePrescriptionStore.getState();
    store.attach(rx, 'readable.jpg'); store.submit([rx]);
    const snapshot = JSON.parse(JSON.stringify(usePrescriptionStore.getState().entries));
    usePrescriptionStore.setState({ entries: snapshot });
    store.settle();
    expect(prescriptionsApproved([rx], usePrescriptionStore.getState().entries)).toBe(false);
    vi.advanceTimersByTime(REVIEW_DELAY); store.settle();
    expect(prescriptionsApproved([rx], usePrescriptionStore.getState().entries)).toBe(true);
    expect(prescriptionsApproved([{ ...rx, quantity: 2 }], usePrescriptionStore.getState().entries)).toBe(false);
  });
  it('requests a replacement deterministically without losing the other approved prescription', () => {
    vi.useFakeTimers();
    const store = usePrescriptionStore.getState();
    store.attach(rx, 'blur.jpg'); store.attach(second, 'clear.jpg'); store.submit([rx, second]);
    vi.advanceTimersByTime(REVIEW_DELAY); store.settle();
    expect(usePrescriptionStore.getState().entries[rx._id].status).toBe('needs-new-photo');
    expect(usePrescriptionStore.getState().entries[second._id].status).toBe('approved');
    store.attach(rx, 'replacement.jpg'); store.submit([rx, second]);
    vi.advanceTimersByTime(REVIEW_DELAY); store.settle();
    expect(prescriptionsApproved([rx, second], usePrescriptionStore.getState().entries)).toBe(true);
  });
  it('attaches, replaces and removes a file; unlocks checkout only after demo review', () => {
    vi.useFakeTimers();
    render(<PrescriptionVerification />);
    const input = screen.getByLabelText('Файл рецепта для Препарат один');
    fireEvent.change(input, { target: { files: [new File(['demo'], 'first.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByText('first.jpg')).toBeInTheDocument();
    fireEvent.change(input, { target: { files: [new File(['demo'], 'new.jpg', { type: 'image/jpeg' })] } });
    expect(screen.queryByText('first.jpg')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Видалити рецепт для Препарат один'));
    expect(screen.queryByText('new.jpg')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Файл рецепта для Препарат один'), { target: { files: [new File(['demo'], 'clear.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(screen.getByRole('button', { name: 'Надіслати на перевірку' }));
    expect(screen.queryByRole('link', { name: 'Перейти до оформлення' })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(REVIEW_DELAY));
    expect(screen.getByRole('link', { name: 'Перейти до оформлення' })).toHaveAttribute('href', '/checkout');
  });
  it('rejects unsupported files and offers reuse for the second prescription', () => {
    useCartStore.setState({ items: [rx, second] });
    render(<PrescriptionVerification />);
    fireEvent.change(screen.getByLabelText('Файл рецепта для Препарат один'), { target: { files: [new File(['demo'], 'bad.exe', { type: 'application/octet-stream' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG, WEBP або PDF');
    expect(usePrescriptionStore.getState().entries).toEqual({});
    fireEvent.change(screen.getByLabelText('Файл рецепта для Препарат один'), { target: { files: [new File(['demo'], 'shared.jpg', { type: 'image/jpeg' })] } });
    expect(screen.getByRole('button', { name: 'Надіслати на перевірку' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'shared.jpg' }));
    expect(screen.getByRole('button', { name: 'Надіслати на перевірку' })).toBeEnabled();
  });
  it('blocks a direct checkout URL until every required prescription is approved', () => {
    vi.useFakeTimers();
    const { unmount } = render(<CheckoutPage />);
    expect(screen.queryByRole('button', { name: 'Підтвердити замовлення' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Перейти до перевірки рецепта' })).toHaveAttribute('href', '/cart/prescription');
    unmount();
    const store = usePrescriptionStore.getState();
    store.attach(rx, 'clear.jpg'); store.submit([rx]);
    vi.advanceTimersByTime(REVIEW_DELAY); store.settle();
    render(<CheckoutPage />);
    expect(screen.getByRole('button', { name: 'Підтвердити замовлення' })).toBeInTheDocument();
  });
});

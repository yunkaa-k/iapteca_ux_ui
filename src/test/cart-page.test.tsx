import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePrescriptionStore } from '@/lib/store/prescriptionStore';
import { CartPage } from '@/components/CartPage';
import { useCartStore, type CartItem } from '@/lib/store/cartStore';
vi.mock('@/lib/useHydrated', () => ({ useHydrated: () => true }));
const item: CartItem = { _id: 'test-product', name: 'Тестовий товар', description: 'Тест', manufacturer: 'Test', category: 'Test', price: 25, stock: 2, quantity: 1, requiresPrescription: false };
beforeEach(() => { useCartStore.setState({ items: [] }); usePrescriptionStore.getState().clear(); });
afterEach(cleanup);
describe('cart page', () => {
  it('shows an empty state and catalog link', () => {
    render(<CartPage />);
    expect(screen.getByRole('heading', { name: 'Ваш кошик порожній' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Перейти до оформлення' })).not.toBeInTheDocument();
  });
  it('recalculates quantities and total without exceeding stock', () => {
    useCartStore.setState({ items: [item] }); render(<CartPage />);
    const plus = screen.getByRole('button', { name: 'Збільшити кількість Тестовий товар' });
    fireEvent.click(plus);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
    expect(plus).toBeDisabled();
    expect(screen.getByRole('complementary', { name: 'Підсумок замовлення' })).toHaveTextContent('50 грн');
    expect(screen.getByRole('link', { name: 'Перейти до оформлення' })).toHaveAttribute('href', '/checkout');
  });
  it('removes the last package and restores it without duplicating the line', () => {
    useCartStore.setState({ items: [item] }); render(<CartPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Зменшити кількість Тестовий товар' }));
    expect(useCartStore.getState().items).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Відновити' }));
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });
  it('does not bypass the pending prescription flow', () => {
    useCartStore.setState({ items: [{ ...item, requiresPrescription: true }] }); render(<CartPage />);
    expect(screen.getByRole('link', { name: 'Перейти до перевірки рецепта' })).toHaveAttribute('href', '/cart/prescription');
    expect(screen.queryByRole('link', { name: 'Перейти до оформлення' })).not.toBeInTheDocument();
  });
});

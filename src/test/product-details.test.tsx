import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductDetails } from '@/components/ProductDetails';
import { productFacts, prescriptionLabel, unitPrice } from '@/lib/product';
import { useCartStore } from '@/lib/store/cartStore';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import type { Medication } from '@/lib/types';
vi.mock('@/lib/useHydrated', () => ({ useHydrated: () => true }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
const med: Medication = { _id: 'test-product', name: 'Демонстраційний товар', description: 'Тестові дані', price: 100, stock: 2, category: 'Test', manufacturer: 'Test' };
beforeEach(() => { useCartStore.setState({ items: [] }); useFavoritesStore.setState({ items: [] }); });
afterEach(cleanup);
describe('product details', () => {
  it('does not infer prescription, ingredient or dosage from a name', () => {
    expect(prescriptionLabel(med)).toBe('Не вказано');
    expect(productFacts(med)).toContainEqual(['Діючі речовини', 'Не вказано']);
    expect(unitPrice(med)).toBe('Не вказано');
    expect(unitPrice({ ...med, packSize: 20 })).toBe('5 грн / од.');
    expect(unitPrice({ ...med, packSize: 20, dosageForm: 'tablets' })).toBe('5 грн / табл.');
  });
  it('caps selected quantity and cart additions at available stock', () => {
    render(<ProductDetails medication={med} alternatives={[]} />);
    const plus = screen.getByRole('button', { name: 'Збільшити кількість' });
    fireEvent.click(plus); expect(plus).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Додати в кошик' }));
    expect(useCartStore.getState().items[0].quantity).toBe(2);
    expect(screen.getByRole('button', { name: 'Увесь доступний залишок уже в кошику' })).toBeDisabled();
  });
  it('shows stock-zero and empty alternatives without offering purchase', () => {
    render(<ProductDetails medication={{ ...med, stock: 0 }} alternatives={[]} />);
    expect(screen.queryByRole('button', { name: 'Додати в кошик' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Переглянути аналоги' })).toHaveAttribute('href', '#product-alternatives');
    expect(screen.getByRole('heading', { name: 'Доступних аналогів поки немає' })).toBeInTheDocument();
  });
  it('compares an alternative with the current product and removes it again', () => {
    render(<ProductDetails medication={med} alternatives={[{ ...med, _id: 'other-product', name: 'Інший тестовий товар', price: 80 }]} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Порівняти' }));
    expect(screen.getByRole('table')).toHaveTextContent('Переглядаєте зараз');
    expect(screen.getByRole('table')).toHaveTextContent('80 грн');
    fireEvent.click(screen.getByRole('button', { name: 'Прибрати' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('keeps favorites working on the details screen', () => {
    render(<ProductDetails medication={med} alternatives={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Додати до обраного' }));
    expect(useFavoritesStore.getState().items[0].medication._id).toBe(med._id);
    fireEvent.click(screen.getByRole('button', { name: 'Вилучити з обраного' }));
    expect(useFavoritesStore.getState().items).toHaveLength(0);
  });
  it('closes a comparison, resets selection and returns focus to its entry point', () => {
    render(<ProductDetails medication={med} alternatives={[{ ...med, _id: 'alternative' }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Порівняти всі' }));
    expect(screen.getByRole('table', { name: 'Порівняння препаратів' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Закрити порівняння' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Порівняти всі' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Порівняти' })).toHaveAttribute('aria-pressed', 'false');
  });
});

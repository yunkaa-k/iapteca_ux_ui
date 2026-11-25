import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KitCard } from '@/components/KitCard';
import { useCartStore } from '@/lib/store/cartStore';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import type { BundleProduct } from '@/lib/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const kit: BundleProduct = {
  _id: 'test-kit', kind: 'bundle', slug: 'test-kit', name: 'Тестова аптечка',
  description: 'Демонстраційний набір', purpose: 'Тест', category: 'Аптечки',
  manufacturer: 'Тест', price: 249, stock: 1, image: '/images/kits/travel.png',
  components: [{ medication: 'test-component', quantity: 2, name: 'Тестовий компонент' }],
  compositionConfirmed: true,
};

beforeEach(() => {
  localStorage.clear();
  useFavoritesStore.setState({ items: [] });
  useCartStore.setState({ items: [] });
});
afterEach(cleanup);

describe('kit card actions', () => {
  it('synchronizes favorites across copies without changing the cart', () => {
    render(<><KitCard kit={kit} /><KitCard kit={kit} /></>);
    fireEvent.click(screen.getAllByRole('button', { name: 'Додати Тестова аптечка до обраного' })[0]);
    const selected = screen.getAllByRole('button', { name: 'Вилучити Тестова аптечка з обраного' });
    expect(selected).toHaveLength(2);
    selected.forEach(button => expect(button).toHaveAttribute('aria-pressed', 'true'));
    expect(useFavoritesStore.getState().items[0].medication).toMatchObject({ kind: 'bundle', slug: kit.slug });
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(JSON.parse(localStorage.getItem('iapteca-favorites')!).state.items).toHaveLength(1);
    fireEvent.click(selected[1]);
    expect(useFavoritesStore.getState().items).toHaveLength(0);
  });

  it('adds a bundle with its fixed composition and respects available stock', () => {
    render(<KitCard kit={kit} />);
    const add = screen.getByRole('button', { name: 'Додати Тестова аптечка до кошика' });
    fireEvent.click(add);
    expect(useCartStore.getState().items[0]).toMatchObject({ kind: 'bundle', components: kit.components, quantity: 1 });
    expect(add).toBeDisabled();
    expect(useFavoritesStore.getState().items).toHaveLength(0);
  });

  it('allows saving an unavailable kit but prevents adding it to the cart', () => {
    render(<KitCard kit={{ ...kit, stock: 0 }} />);
    expect(screen.getByRole('button', { name: 'Додати Тестова аптечка до кошика' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Додати Тестова аптечка до обраного' }));
    expect(useFavoritesStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items).toHaveLength(0);
  });
});

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesPage } from '@/components/FavoritesPage';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useCartStore } from '@/lib/store/cartStore';
import type { Medication } from '@/lib/types';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const medication: Medication = { _id: 'first', name: 'Тестова позиція', price: 100, stock: 5, description: 'Тест', category: 'Тест', manufacturer: 'Тест' };

beforeEach(() => {
  localStorage.clear();
  useFavoritesStore.setState({ items: [{ medication }, { medication: { ...medication, _id: 'second', name: 'Друга позиція' } }] });
  useCartStore.setState({ items: [] });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('adding favorites to the existing cart', () => {
  it('uses current server prices and skips out-of-stock products', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...medication, price: 130 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...medication, _id: 'second', stock: 0 }) }));
    render(<FavoritesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Додати все до кошика' }));
    await waitFor(() => expect(useCartStore.getState().items).toHaveLength(1));
    expect(useCartStore.getState().items[0]).toMatchObject({ _id: 'first', price: 130, quantity: 1 });
    expect(useFavoritesStore.getState().items).toHaveLength(2);
  });

  it('leaves the cart unchanged when one availability request fails', async () => {
    useCartStore.getState().addItem(medication);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => medication })
      .mockRejectedValueOnce(new Error('offline')));
    render(<FavoritesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Додати все до кошика' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Додати все до кошика' })).toBeEnabled());
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it('does not increase quantities above fresh stock or add deleted products', async () => {
    useCartStore.getState().addItem(medication);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...medication, stock: 1 }) })
      .mockResolvedValueOnce({ ok: false, status: 404 }));
    render(<FavoritesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Додати все до кошика' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Додати все до кошика' })).toBeEnabled());
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });
});

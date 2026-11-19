import { beforeEach, describe, expect, it } from 'vitest';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useCartStore } from '@/lib/store/cartStore';
import type { Medication } from '@/lib/types';

const medication: Medication = {
  _id: 'favorite-test', name: 'Тестовий товар', description: 'Тест',
  price: 100, stock: 1, category: 'Тест', manufacturer: 'Тест',
};

beforeEach(() => {
  localStorage.clear();
  useFavoritesStore.setState({ items: [] });
  useCartStore.setState({ items: [] });
});

describe('browser-local favorites', () => {
  it('keeps saved items after rehydration, including their presentation', async () => {
    useFavoritesStore.getState().toggle({ medication, summary: 'Опис', imageOverride: '/image.png' });
    useFavoritesStore.setState({ items: [] }, false);
    // Restore the persisted snapshot to simulate a fresh application instance.
    localStorage.setItem('iapteca-favorites', JSON.stringify({ state: { items: [{ medication, summary: 'Опис', imageOverride: '/image.png' }] }, version: 1 }));
    await useFavoritesStore.persist.rehydrate();
    expect(useFavoritesStore.getState().items[0]).toMatchObject({ medication, summary: 'Опис', imageOverride: '/image.png' });
  });

  it('removes the same product on a second toggle instead of duplicating it', () => {
    useFavoritesStore.getState().toggle({ medication });
    useFavoritesStore.getState().toggle({ medication: { ...medication, price: 120 } });
    expect(useFavoritesStore.getState().items).toEqual([]);
  });

  it('removes one saved product without changing the others or the cart', () => {
    useCartStore.getState().addItem(medication);
    useFavoritesStore.getState().toggle({ medication });
    useFavoritesStore.getState().toggle({ medication: { ...medication, _id: 'second' } });
    useFavoritesStore.getState().remove(medication._id);
    expect(useFavoritesStore.getState().items.map((item) => item.medication._id)).toEqual(['second']);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it('clears persisted favorites without clearing purchased selections', () => {
    useCartStore.getState().addItem(medication);
    useFavoritesStore.getState().toggle({ medication });
    useFavoritesStore.getState().clear();
    expect(JSON.parse(localStorage.getItem('iapteca-favorites')!).state.items).toEqual([]);
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});

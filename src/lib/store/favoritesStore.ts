import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Medication } from '../types';

export interface FavoriteItem {
  medication: Medication;
  imageOverride?: string;
  summary?: string;
}

interface FavoritesState {
  items: FavoriteItem[];
  toggle: (item: FavoriteItem) => void;
  remove: (id: string) => void;
  clear: () => void;
}

// Browser-local favorites also work before signing in. No personal data is stored.
export const useFavoritesStore = create<FavoritesState>()(persist((set) => ({
  items: [],
  toggle: (item) => set((state) => ({
    items: state.items.some((entry) => entry.medication._id === item.medication._id)
      ? state.items.filter((entry) => entry.medication._id !== item.medication._id)
      : [...state.items, item],
  })),
  remove: (id) => set((state) => ({ items: state.items.filter((item) => item.medication._id !== id) })),
  clear: () => set({ items: [] }),
}), { name: 'iapteca-favorites', version: 1 }));

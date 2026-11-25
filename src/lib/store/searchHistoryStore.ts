import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SearchHistoryState {
  queries: string[];
  remember: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
}

const clean = (query: string) => query.trim().slice(0, 150);
const key = (query: string) => clean(query).toLocaleLowerCase('uk-UA');

export const useSearchHistoryStore = create<SearchHistoryState>()(persist((set) => ({
  queries: [],
  remember: (query) => {
    const value = clean(query);
    if (value) set((state) => ({ queries: [value, ...state.queries.filter((item) => key(item) !== key(value))].slice(0, 5) }));
  },
  remove: (query) => set((state) => ({ queries: state.queries.filter((item) => key(item) !== key(query)) })),
  clear: () => set({ queries: [] }),
}), {
  name: 'iapteca-search-history', version: 1,
  storage: createJSONStorage(() => ({
    getItem: (name) => { try { return globalThis.localStorage.getItem(name); } catch { return null; } },
    setItem: (name, value) => { try { globalThis.localStorage.setItem(name, value); } catch { /* Search still works if browser storage is unavailable. */ } },
    removeItem: (name) => { try { globalThis.localStorage.removeItem(name); } catch { /* No persistent storage to clear. */ } },
  })),
  merge: (persisted, current) => {
    const stored = persisted && typeof persisted === 'object' && 'queries' in persisted && Array.isArray(persisted.queries) ? persisted.queries : [];
    return { ...current, queries: stored.filter((item): item is string => typeof item === 'string').map(clean).filter(Boolean).slice(0, 5) };
  },
}));

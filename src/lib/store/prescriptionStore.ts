import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem } from './cartStore';

export type PrescriptionStatus = 'attached' | 'reviewing' | 'approved' | 'needs-new-photo';
export interface PrescriptionEntry {
  fileName: string;
  quantity: number;
  status: PrescriptionStatus;
  readyAt?: number;
}
export const REVIEW_DELAY = 8000;
export function settlePrescriptionEntries(entries: Record<string, PrescriptionEntry>, now = Date.now()) {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id,
    entry.status === 'reviewing' && entry.readyAt !== undefined && entry.readyAt <= now
      ? { ...entry, readyAt: undefined, status: /blur|нечитабельн/i.test(entry.fileName) ? 'needs-new-photo' as const : 'approved' as const }
      : entry,
  ]));
}
export function prescriptionFor(item: CartItem, entries: Record<string, PrescriptionEntry>) {
  const entry = entries[item._id];
  return entry?.quantity === item.quantity ? entry : undefined;
}
export function prescriptionsApproved(items: CartItem[], entries: Record<string, PrescriptionEntry>) {
  return items.every(item => !item.requiresPrescription || prescriptionFor(item, entries)?.status === 'approved');
}
interface PrescriptionState {
  entries: Record<string, PrescriptionEntry>;
  attach: (item: CartItem, fileName: string) => void;
  remove: (id: string) => void;
  submit: (items: CartItem[]) => void;
  settle: () => void;
  clear: () => void;
}

// Demo metadata only: neither file contents nor medical documents leave the browser.
export const usePrescriptionStore = create<PrescriptionState>()(persist((set, get) => ({
  entries: {},
  attach: (item, fileName) => set({ entries: { ...get().entries, [item._id]: { fileName, quantity: item.quantity, status: 'attached' } } }),
  remove: id => set({ entries: Object.fromEntries(Object.entries(get().entries).filter(([key]) => key !== id)) }),
  submit: items => {
    const required = items.filter(item => item.requiresPrescription);
    if (!required.length || required.some(item => !prescriptionFor(item, get().entries) || prescriptionFor(item, get().entries)?.status === 'needs-new-photo')) return;
    const entries = { ...get().entries };
    for (const item of required) {
      const entry = entries[item._id];
      if (entry.status === 'attached') entries[item._id] = { ...entry, status: 'reviewing', readyAt: Date.now() + REVIEW_DELAY };
    }
    set({ entries });
  },
  settle: () => {
    let changed = false;
    const entries = { ...get().entries };
    for (const [id, entry] of Object.entries(entries)) {
      if (entry.status === 'reviewing' && entry.readyAt !== undefined && entry.readyAt <= Date.now()) {
        changed = true;
        // Predictable demo branch, not image recognition or a pharmacist's decision.
        entries[id] = { ...entry, readyAt: undefined, status: /blur|нечитабельн/i.test(entry.fileName) ? 'needs-new-photo' : 'approved' };
      }
    }
    if (changed) set({ entries });
  },
  clear: () => set({ entries: {} }),
}), { name: 'iapteca-prescription-demo', storage: createJSONStorage(() => sessionStorage) }));

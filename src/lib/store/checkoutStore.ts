import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem } from './cartStore';
import { emptyCheckout, type CheckoutDetails, type CheckoutForm } from '../checkout';

export interface OrderReceipt {
  id: string; createdAt: string; ownerId?: string; items: CartItem[]; total: number; checkout: CheckoutDetails;
}
interface CheckoutState {
  drafts: Record<string, CheckoutForm>;
  receipts: Record<string, OrderReceipt>;
  update: (key: string, patch: Partial<CheckoutForm>) => void;
  saveReceipt: (key: string, receipt: OrderReceipt) => void;
}
export const useCheckoutStore = create<CheckoutState>()(persist((set, get) => ({
  drafts: {}, receipts: {},
  update: (key, patch) => set({ drafts: { ...get().drafts, [key]: { ...emptyCheckout, ...get().drafts[key], ...patch } } }),
  saveReceipt: (key, receipt) => set({ receipts: { ...get().receipts, [receipt.id]: receipt }, drafts: Object.fromEntries(Object.entries(get().drafts).filter(([id]) => id !== key)) }),
}), { name: 'iapteca-checkout', storage: createJSONStorage(() => sessionStorage) }));

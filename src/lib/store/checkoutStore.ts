import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem } from './cartStore';
import { emptyCheckout, type CheckoutDetails, type CheckoutForm } from '../checkout';

export interface OrderReceipt {
  id: string; createdAt: string; ownerId?: string; guestPaymentToken?: string; items: CartItem[]; total: number; checkout: CheckoutDetails;
}
interface CheckoutState {
  drafts: Record<string, CheckoutForm>;
  attempts: Record<string, { payload: string; id: string }>;
  receipts: Record<string, OrderReceipt>;
  update: (key: string, patch: Partial<CheckoutForm>) => void;
  getAttemptId: (key: string, payload: string) => string;
  saveReceipt: (key: string, receipt: OrderReceipt) => void;
  updateReceiptCheckout: (id: string, checkout: CheckoutDetails) => void;
}
export const useCheckoutStore = create<CheckoutState>()(persist((set, get) => ({
  drafts: {}, attempts: {}, receipts: {},
  update: (key, patch) => set({ drafts: { ...get().drafts, [key]: { ...emptyCheckout, ...get().drafts[key], ...patch } } }),
  getAttemptId: (key, payload) => {
    const attempts = get().attempts;
    const attempt = attempts[key];
    if (attempt?.payload === payload) return attempt.id;
    const id = crypto.randomUUID();
    set({ attempts: { ...attempts, [key]: { id, payload } } });
    return id;
  },
  saveReceipt: (key, receipt) => set(state => ({
    receipts: { ...state.receipts, [receipt.id]: receipt },
    drafts: Object.fromEntries(Object.entries(state.drafts).filter(([id]) => id !== key)),
    attempts: Object.fromEntries(Object.entries(state.attempts).filter(([id]) => id !== key)),
  })),
  updateReceiptCheckout: (id, checkout) => set(state => state.receipts[id] ? { receipts: { ...state.receipts, [id]: { ...state.receipts[id], checkout } } } : state),
}), { name: 'iapteca-checkout', storage: createJSONStorage(() => sessionStorage) }));

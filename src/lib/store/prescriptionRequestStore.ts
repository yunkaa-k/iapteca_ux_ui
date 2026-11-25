import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem } from './cartStore';
import { prescriptionFor, prescriptionsApproved, REVIEW_DELAY, settlePrescriptionEntries, type PrescriptionEntry } from './prescriptionStore';

export interface PrescriptionRequest {
  id: string;
  number: string;
  ownerId: string;
  createdAt: number;
  items: CartItem[];
  entries: Record<string, PrescriptionEntry>;
  state: 'active' | 'cancelled' | 'completed';
  orderId?: string;
}
export function requestStatus(request: PrescriptionRequest) {
  if (request.state !== 'active') return request.state;
  if (request.items.some(item => item.requiresPrescription && ['needs-new-photo', 'attached', 'missing'].includes(prescriptionFor(item, request.entries)?.status || 'missing'))) return 'needs-new-photo';
  if (prescriptionsApproved(request.items, request.entries)) return 'approved';
  return 'reviewing';
}
interface RequestState {
  requests: PrescriptionRequest[];
  create: (ownerId: string, items: CartItem[], entries: Record<string, PrescriptionEntry>) => string | undefined;
  replaceFile: (id: string, ownerId: string, itemId: string, fileName: string) => void;
  removeFile: (id: string, ownerId: string, itemId: string) => void;
  submit: (id: string, ownerId: string) => void;
  settle: () => void;
  cancel: (id: string, ownerId: string) => boolean;
  complete: (id: string, ownerId: string, orderId: string) => void;
}
// Account-scoped demo snapshots, kept only in this browser tab, independent of the live cart.
export const usePrescriptionRequestStore = create<RequestState>()(persist((set, get) => ({
  requests: [],
  create: (ownerId, items, entries) => {
    const required = items.filter(item => item.requiresPrescription);
    if (!ownerId || !required.length || required.some(item => !['reviewing', 'approved'].includes(prescriptionFor(item, entries)?.status || ''))) return;
    const fingerprint = (lines: CartItem[], files: Record<string, PrescriptionEntry>) => JSON.stringify(lines.map(item => [item._id, item.quantity, item.price, files[item._id]?.fileName]));
    const existing = get().requests.find(r => r.ownerId === ownerId && r.state === 'active' && fingerprint(r.items, r.entries) === fingerprint(items, entries));
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    const request: PrescriptionRequest = {
      id, number: `RX-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`, ownerId, createdAt: Date.now(),
      items: items.map(item => ({ ...item })),
      entries: Object.fromEntries(required.map(item => [item._id, { ...entries[item._id] }])), state: 'active',
    };
    set({ requests: [request, ...get().requests] });
    return id;
  },
  replaceFile: (id, ownerId, itemId, fileName) => set({ requests: get().requests.map(r => {
    if (r.id !== id || r.ownerId !== ownerId || r.state !== 'active') return r;
    const item = r.items.find(item => item._id === itemId && item.requiresPrescription);
    const entry = r.entries[itemId];
    if (!item || (entry && !['needs-new-photo', 'attached'].includes(entry.status))) return r;
    return { ...r, entries: { ...r.entries, [itemId]: { fileName, quantity: item.quantity, status: 'attached' } } };
  }) }),
  removeFile: (id, ownerId, itemId) => set({ requests: get().requests.map(r => {
    if (r.id !== id || r.ownerId !== ownerId || r.state !== 'active' || !['attached', 'needs-new-photo'].includes(r.entries[itemId]?.status)) return r;
    return { ...r, entries: Object.fromEntries(Object.entries(r.entries).filter(([key]) => key !== itemId)) };
  }) }),
  submit: (id, ownerId) => set({ requests: get().requests.map(r => {
    if (r.id !== id || r.ownerId !== ownerId || r.state !== 'active') return r;
    const required = r.items.filter(item => item.requiresPrescription);
    if (required.some(item => !['attached', 'approved'].includes(r.entries[item._id]?.status))) return r;
    return { ...r, entries: Object.fromEntries(Object.entries(r.entries).map(([key, entry]) => [key, entry.status === 'attached' ? { ...entry, status: 'reviewing', readyAt: Date.now() + REVIEW_DELAY } : entry])) };
  }) }),
  settle: () => {
    let changed = false;
    const requests = get().requests.map(r => {
      if (r.state !== 'active') return r;
      const entries = settlePrescriptionEntries(r.entries);
      if (Object.keys(entries).every(id => entries[id] === r.entries[id])) return r;
      changed = true; return { ...r, entries };
    });
    if (changed) set({ requests });
  },
  cancel: (id, ownerId) => {
    const request = get().requests.find(r => r.id === id && r.ownerId === ownerId && r.state === 'active');
    if (!request) return false;
    set({ requests: get().requests.map(r => r === request ? { ...r, state: 'cancelled' } : r) });
    return true;
  },
  complete: (id, ownerId, orderId) => set({ requests: get().requests.map(r => r.id === id && r.ownerId === ownerId && r.state === 'active' && requestStatus(r) === 'approved' ? { ...r, state: 'completed', orderId } : r) }),
}), { name: 'iapteca-prescription-requests', storage: createJSONStorage(() => sessionStorage) }));

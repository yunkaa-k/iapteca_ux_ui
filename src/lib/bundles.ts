import type { Bundle, BundleProduct, Medication, OrderItem } from './types';

export function bundleAvailability(bundle: Bundle, medications: Medication[]): number {
  if (!bundle.compositionConfirmed || bundle.isDeleted || !bundle.components.length) return 0;
  const required = new Map<string, number>();
  for (const item of bundle.components) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) return 0;
    const id = item.medication.toString();
    required.set(id, (required.get(id) || 0) + item.quantity);
  }
  return Math.min(...[...required].map(([id, quantity]) => {
    const medication = medications.find(m => m._id.toString() === id);
    return !medication || medication.isDeleted || !Number.isSafeInteger(medication.stock) || medication.stock < 0 ? 0 : Math.floor(medication.stock / quantity);
  }));
}

export function bundleProduct(bundle: Bundle, medications: Medication[]): BundleProduct {
  return { ...bundle, _id: bundle._id.toString(), kind: 'bundle', category: 'Готові аптечки', manufacturer: 'iApteca', stock: bundleAvailability(bundle, medications), requiresPrescription: bundle.components.some(c => medications.find(m => m._id.toString() === c.medication.toString())?.requiresPrescription === true) };
}

export const productHref = (item: Medication) => item.kind === 'bundle' ? '/kits/' + encodeURIComponent(item.slug || item._id) : '/product/' + item._id;

// Quantities are stored per ONE bundle in immutable order snapshots.
export function inventoryLines(item: OrderItem): { medication: string; quantity: number }[] {
  if (item.kind !== 'bundle') return [{ medication: item.medication, quantity: item.quantity }];
  if (!item.components?.length) throw new Error('Немає збереженого складу аптечки.');
  return item.components.map(component => ({ medication: component.medication, quantity: component.quantity * item.quantity }));
}

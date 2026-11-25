import { describe, expect, it } from 'vitest';
import { bundleAvailability, bundleProduct, inventoryLines } from '@/lib/bundles';
import type { Bundle, Medication } from '@/lib/types';

const bundle: Bundle = { _id: 'kit', slug: 'travel', name: 'Аптечка', description: 'Набір', purpose: 'Для подорожей', price: 249, image: '/test.png', compositionConfirmed: true, components: [{ medication: 'a', name: 'Бинт', quantity: 2 }, { medication: 'b', name: 'Пластир', quantity: 1 }] };
const medications = [{ _id: 'a', stock: 7 }, { _id: 'b', stock: 10 }] as Medication[];

describe('fixed bundles inventory', () => {
  it('uses the limiting component and rounds down to complete kits', () => {
    expect(bundleAvailability(bundle, medications)).toBe(3);
    expect(bundleProduct(bundle, medications)).toMatchObject({ kind: 'bundle', stock: 3, price: 249, requiresPrescription: false });
  });
  it('aggregates repeated components instead of overestimating availability', () => {
    expect(bundleAvailability({ ...bundle, components: [...bundle.components, { medication: 'a', name: 'Бинт', quantity: 2 }] }, medications)).toBe(1);
  });
  it('disables incomplete, deleted, invalid and unconfirmed compositions', () => {
    expect(bundleAvailability(bundle, medications.slice(0, 1))).toBe(0);
    expect(bundleAvailability(bundle, [{ _id: 'a', stock: 0 }, medications[1]] as Medication[])).toBe(0);
    expect(bundleAvailability(bundle, [{ ...medications[0], isDeleted: true }, medications[1]])).toBe(0);
    expect(bundleAvailability({ ...bundle, compositionConfirmed: false }, medications)).toBe(0);
    expect(bundleAvailability({ ...bundle, components: [] }, medications)).toBe(0);
    expect(bundleAvailability({ ...bundle, components: [{ medication: 'a', name: 'Бинт', quantity: .5 }] }, medications)).toBe(0);
  });
  it('returns frozen order components multiplied by kit count and preserves legacy medication orders', () => {
    expect(inventoryLines({ medication: 'kit', kind: 'bundle', quantity: 2, price: 249, components: bundle.components })).toEqual([{ medication: 'a', quantity: 4 }, { medication: 'b', quantity: 2 }]);
    expect(inventoryLines({ medication: 'a', quantity: 3, price: 25 })).toEqual([{ medication: 'a', quantity: 3 }]);
    expect(() => inventoryLines({ medication: 'kit', kind: 'bundle', quantity: 1, price: 249 })).toThrow();
  });
});

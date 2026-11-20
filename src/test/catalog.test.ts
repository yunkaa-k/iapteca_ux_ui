import { describe, expect, it } from 'vitest';
import { catalogQuery, toSearchParams } from '@/lib/catalog';

describe('catalog queries', () => {
  it('uses literal search text and searches names and active ingredients', () => {
    const { filter } = catalogQuery(new URLSearchParams({ search: 'ліки (200) [A]+.*' }));
    expect(filter.$or).toEqual([
      { name: { $regex: 'ліки \\(200\\) \\[A\\]\\+\\.\\*', $options: 'i' } },
      { activeIngredient: { $regex: 'ліки \\(200\\) \\[A\\]\\+\\.\\*', $options: 'i' } },
    ]);
  });

  it('combines category, multiple forms, numeric pack sizes and price', () => {
    const params = toSearchParams({ category: 'Тест', form: ['tablets', 'capsules'], packSize: ['10', '20', 'invalid'], minPrice: '40.50', maxPrice: '200', inStock: 'true', manufacturer: 'Виробник' });
    expect(catalogQuery(params).filter).toMatchObject({ category: 'Тест', dosageForm: { $in: ['tablets', 'capsules'] }, packSize: { $in: [10, 20] }, price: { $gte: 40.5, $lte: 200 }, stock: { $gt: 0 }, manufacturer: 'Виробник' });
  });

  it('does not classify unknown prescription metadata as non-prescription', () => {
    expect(catalogQuery(new URLSearchParams('prescription=not-required')).filter.requiresPrescription).toBe(false);
    expect(catalogQuery(new URLSearchParams('prescription=required&prescription=not-required')).filter).not.toHaveProperty('requiresPrescription');
  });

  it('rejects invalid numbers and bounds page and limit values', () => {
    const parsed = catalogQuery(new URLSearchParams('page=-3&limit=99999&minPrice=NaN&maxPrice=-100&form=invalid'));
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(100);
    expect(parsed.filter).toEqual({ isDeleted: { $ne: true }, inventoryOnly: { $ne: true } });
    expect(catalogQuery(new URLSearchParams('page=Infinity&limit=0')).page).toBe(1);
  });

  it('sorts deterministically and distinguishes filters from a text-only search', () => {
    expect(catalogQuery(new URLSearchParams('sort=price_desc')).sort).toEqual({ price: -1, _id: 1 });
    expect(catalogQuery(new URLSearchParams('search=тест')).hasFilters).toBe(false);
    expect(catalogQuery(new URLSearchParams('minPrice=0')).hasFilters).toBe(true);
  });
});

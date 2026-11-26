import { describe, expect, it } from 'vitest';
import { catalogAgeOptions, catalogQuery, catalogResultCount, catalogSearchPattern, toSearchParams } from '@/lib/catalog';

describe('catalog queries', () => {
  it.each([
    [0, 'Знайдено 0 товарів'], [1, 'Знайдено 1 товар'], [2, 'Знайдено 2 товари'],
    [4, 'Знайдено 4 товари'], [5, 'Знайдено 5 товарів'], [11, 'Знайдено 11 товарів'],
    [12, 'Знайдено 12 товарів'], [14, 'Знайдено 14 товарів'], [21, 'Знайдено 21 товар'],
    [22, 'Знайдено 22 товари'], [24, 'Знайдено 24 товари'], [111, 'Знайдено 111 товарів'],
  ])('uses Ukrainian product endings for %i results', (count, expected) => {
    expect(catalogResultCount(count as number)).toBe(expected);
  });
  it('groups age instructions into short labels without inventing an age for unspecified instructions', () => {
    expect(catalogAgeOptions(['Від 12 років.', 'Від 12 років; маса тіла — не менше 40 кг.', 'Від 6 років; маса тіла — понад 20 кг.', 'Дорослим; досвіду застосування дітям немає.', 'Не застосовувати у педіатричній практиці через недостатній досвід застосування.', 'Дітям — відповідна форма та дозування за призначенням лікаря.'])).toEqual(['Від 6 років', 'Від 12 років', 'Для дорослих']);
  });

  it('matches all instruction variants for an age group and preserves legacy exact filters', () => {
    const age = catalogQuery(new URLSearchParams({ ageGroup: 'Від 12 років' })).filter.ageGroup as { $regex: string; $options: string };
    const pattern = new RegExp(age.$regex, age.$options);
    expect(pattern.test('Від 12 років.')).toBe(true);
    expect(pattern.test('Від 12 років; маса тіла — не менше 40 кг.')).toBe(true);
    expect(pattern.test('Від 120 років.')).toBe(false);
    expect(pattern.test('Від 6 років.')).toBe(false);
    const adult = catalogQuery(new URLSearchParams({ ageGroup: 'Для дорослих' })).filter.ageGroup as { $regex: string; $options: string };
    expect(new RegExp(adult.$regex, adult.$options).test('Дорослим; досвіду застосування дітям немає.')).toBe(true);
    expect(catalogQuery(new URLSearchParams({ ageGroup: 'Від 12 років.' })).filter.ageGroup).toBe('Від 12 років.');
  });
  it('uses literal search terms and searches names and active ingredients', () => {
    const { filter } = catalogQuery(new URLSearchParams({ search: 'ліки (200) [A]+.*' }));
    expect(filter.$or).toEqual([
      { name: { $regex: 'ліки.*?\\(200\\).*?\\[A\\]\\+\\.\\*', $options: 'i' } },
      { activeIngredient: { $regex: 'ліки.*?\\(200\\).*?\\[A\\]\\+\\.\\*', $options: 'i' } },
    ]);
  });

  it('finds package suggestions across omitted dosage without matching a different package', () => {
    const pattern = new RegExp(catalogSearchPattern('парацетамол №10'), 'i');
    expect(pattern.test('Парацетамол 500 мг №10')).toBe(true);
    expect(pattern.test('Парацетамол 500 мг №100')).toBe(false);
    expect(pattern.test('Парацетамол 500 мг №20')).toBe(false);
    expect(pattern.test('Нурофен 200 мг №10')).toBe(false);
    expect(new RegExp(catalogSearchPattern('  парацетамол   № 10 '), 'i').test('Парацетамол 500 мг № 10')).toBe(true);
    expect(catalogQuery(new URLSearchParams({ search: 'парацетамол №10' })).hasFilters).toBe(false);
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

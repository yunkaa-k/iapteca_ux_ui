export const dosageForms = [
  { value: 'tablets', label: 'Таблетки' },
  { value: 'capsules', label: 'Капсули' },
  { value: 'suspensions', label: 'Суспензії' },
  { value: 'powders', label: 'Порошки та гранули' },
  { value: 'ointments', label: 'Гелі / мазі' },
  { value: 'dragees', label: 'Драже' },
] as const;

// Facet options follow Screens; full combination strengths remain product facts.
export const catalogDosages = ['200 мг', '400 мг', '500 мг', '5 мг', '60 мг'] as const;
export const catalogCategoryOrder = ['Застуда та грип', 'Біль і запалення', 'Шлунково-кишковий тракт', 'Серцево-судинні', 'Вітаміни та мінерали', 'Дерматологія та догляд'] as const;

const productPlural = new Intl.PluralRules('uk-UA');
export function catalogResultCount(count: number) {
  const form = productPlural.select(count);
  return `Знайдено ${count} ${form === 'one' ? 'товар' : form === 'few' ? 'товари' : 'товарів'}`;
}

// Keep instruction caveats on product pages, not in the age facet labels.
export function catalogAgeLabel(value: string) {
  const minimum = value.match(/^Від (\d+) років(?:[.;\s]|$)/i);
  if (minimum) return `Від ${Number(minimum[1])} років`;
  if (/^(Дорослим|Не застосовувати у педіатричній практиці)/i.test(value)) return 'Для дорослих';
  return '';
}

export function catalogAgeOptions(values: string[]) {
  return [...new Set(values.map(catalogAgeLabel).filter(Boolean))]
    .sort((a, b) => (Number(a.match(/\d+/)?.[0]) || Infinity) - (Number(b.match(/\d+/)?.[0]) || Infinity));
}

export const catalogSelects = [
  { key: 'activeIngredient', label: 'Діюча речовина', placeholder: 'Усі діючі речовини' },
  { key: 'country', label: 'Країна виробництва', placeholder: 'Усі країни' },
  { key: 'atcCode', label: 'Класифікація АТХ', placeholder: 'Усі коди АТХ' },
  { key: 'brand', label: 'Бренд / торгова назва', placeholder: 'Усі бренди' },
  { key: 'manufacturer', label: 'Виробник', placeholder: 'Усі виробники' },
  { key: 'ageGroup', label: 'Вік пацієнта', placeholder: 'Будь-який вік' },
  { key: 'packageType', label: 'Тип упаковки', placeholder: 'Усі типи' },
] as const;

export const facetKeys = ['dosage', 'packSize', ...catalogSelects.map((item) => item.key)] as const;
export type CatalogFacetKey = (typeof facetKeys)[number];
export type CatalogFacets = Record<CatalogFacetKey, string[]> & { forms: Record<string, number>; maxPrice: number };
export type CatalogParams = Record<string, string | string[] | undefined>;

export function toSearchParams(params: CatalogParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, entry);
  }
  return search;
}

const list = (params: URLSearchParams, key: string) => [...new Set(params.getAll(key).map((item) => item.trim().slice(0, 150)).filter(Boolean))].slice(0, 30);
const text = (params: URLSearchParams, key: string) => (params.get(key) || '').trim().slice(0, 150);
const price = (value: string | null) => value !== null && value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.min(Number(value), 10000000) : undefined;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A query such as "парацетамол №10" may omit the dosage between the words.
// Every term stays literal; package numbers must not also match №100, etc.
export function catalogSearchPattern(search: string) {
  return search.trim().replace(/№\s+(?=\d)/gu, '№').split(/\s+/u).map(term => {
    const pack = term.match(/^№(\d+)$/u);
    return pack ? `№\\s*${pack[1]}(?!\\d)` : escapeRegex(term);
  }).join('.*?');
}

export function catalogQuery(params: URLSearchParams, defaultLimit = 20) {
  const search = text(params, 'search');
  const filter: Record<string, unknown> = { isDeleted: { $ne: true }, inventoryOnly: { $ne: true } };
  if (search) filter.$or = ['name', 'activeIngredient'].map((key) => ({ [key]: { $regex: catalogSearchPattern(search), $options: 'i' } }));
  if (text(params, 'category')) filter.category = text(params, 'category');
  if (params.get('inStock') === 'true') filter.stock = { $gt: 0 };
  for (const { key } of catalogSelects) if (text(params, key)) filter[key] = text(params, key);
  const age = text(params, 'ageGroup');
  if (/^Від \d+ років$/.test(age)) filter.ageGroup = { $regex: `^${escapeRegex(age)}(?:[.;\\s]|$)`, $options: 'i' };
  else if (age === 'Для дорослих') filter.ageGroup = { $regex: '^(Дорослим|Не застосовувати у педіатричній практиці)', $options: 'i' };
  const forms = list(params, 'form').filter((value) => dosageForms.some((form) => form.value === value));
  if (forms.length) filter.dosageForm = { $in: forms };
  const dosages = list(params, 'dosage');
  if (dosages.length) filter.dosage = { $in: dosages };
  const packs = list(params, 'packSize').filter((value) => /^\d+$/.test(value) && Number(value) > 0).map(Number);
  if (packs.length) filter.packSize = { $in: packs };
  const prescriptions = list(params, 'prescription').filter((value) => value === 'required' || value === 'not-required');
  if (prescriptions.length === 1) filter.requiresPrescription = prescriptions[0] === 'required';
  if (params.get('onSale') === 'true') filter.onSale = true;
  const minPrice = price(params.get('minPrice'));
  const maxPrice = price(params.get('maxPrice'));
  if (minPrice !== undefined || maxPrice !== undefined) filter.price = { ...(minPrice !== undefined ? { $gte: minPrice } : {}), ...(maxPrice !== undefined ? { $lte: maxPrice } : {}) };
  const pageValue = Number(params.get('page'));
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 100000) : 1;
  const limitValue = Number(params.get('limit'));
  const limit = Number.isSafeInteger(limitValue) && limitValue > 0 ? Math.min(limitValue, 100) : defaultLimit;
  const sort: Record<string, 1 | -1> = params.get('sort') === 'price_desc' ? { price: -1, _id: 1 } : params.get('sort') === 'newest' ? { createdAt: -1, _id: 1 } : { price: 1, _id: 1 };
  const hasFilters = Object.keys(filter).some((key) => key !== 'isDeleted' && key !== 'inventoryOnly' && key !== '$or');
  return { filter, sort, page, limit, search, hasFilters, minPrice, maxPrice };
}

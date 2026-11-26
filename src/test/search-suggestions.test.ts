import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findSpellingCorrection, spellingDistance, suggestedQueries } from '@/lib/searchSuggestions';
import { useSearchHistoryStore } from '@/lib/store/searchHistoryStore';
import { GET } from '@/app/api/search/suggestions/route';
import { connectDB, MedicationModel } from '@/lib/db';

vi.mock('@/lib/db', () => ({ connectDB: vi.fn(), MedicationModel: { find: vi.fn() } }));
const result = (rows: object[]) => ({ select: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(rows) });
const request = (q: string) => new Request(`http://localhost/api/search/suggestions?q=${encodeURIComponent(q)}`);

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); useSearchHistoryStore.setState({ queries: [] }); });
afterEach(() => vi.restoreAllMocks());

describe('suggested query labels', () => {
  it('completes a partial brand using the actual product name', () => {
    expect(suggestedQueries('нуроф', [{ _id: 'n', name: 'Нурофен 200 мг №24', price: 145, stock: 1, dosage: '200 мг', packSize: 24 }], [])).toEqual(['нурофен', 'нурофен 200 мг', 'нурофен №24']);
  });
  it('does not suggest a combination strength absent from searchable product text', () => {
    expect(suggestedQueries('цитра', [{ _id: 'c', name: 'Цитрамон-Дарниця №10', price: 52, stock: 1, dosage: '240 мг + 180 мг + 30 мг', packSize: 10 }], [])).toEqual(['цитрамон-дарниця', 'цитрамон-дарниця №10']);
  });
});

describe('spelling correction from the catalog dictionary', () => {
  it('handles replacement and adjacent transposition', () => {
    expect(findSpellingCorrection('парацетомол', ['Парацетамол 500 мг №10'])).toBe('парацетамол');
    expect(spellingDistance('alhpa', 'alpha')).toBe(1);
  });
  it('does not correct valid, ambiguous or unsupported queries', () => {
    expect(findSpellingCorrection('парацетамол', ['Парацетамол 500 мг'])).toBeNull();
    expect(findSpellingCorrection('кот', ['кит', 'кат'])).toBeNull();
    expect(findSpellingCorrection('невідоме', [])).toBeNull();
    expect(findSpellingCorrection('500', ['500 мг'])).toBeNull();
    expect(findSpellingCorrection('два слова', ['слова'])).toBeNull();
  });
});

describe('local search history', () => {
  it('deduplicates submitted queries and retains only the five most recent', () => {
    for (const query of ['one', 'two', 'three', 'four', 'five', 'six', ' TWO ']) useSearchHistoryStore.getState().remember(query);
    expect(useSearchHistoryStore.getState().queries).toEqual(['TWO', 'six', 'five', 'four', 'three']);
    expect(JSON.parse(localStorage.getItem('iapteca-search-history')!).state.queries).toHaveLength(5);
  });
  it('removes one query and clears the persisted list', () => {
    useSearchHistoryStore.getState().remember('alpha');
    useSearchHistoryStore.getState().remember('beta');
    useSearchHistoryStore.getState().remove('ALPHA');
    expect(useSearchHistoryStore.getState().queries).toEqual(['beta']);
    useSearchHistoryStore.getState().clear();
    expect(JSON.parse(localStorage.getItem('iapteca-search-history')!).state.queries).toEqual([]);
  });
  it('continues searching when localStorage is unavailable', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('StorageBlocked'); });
    expect(() => useSearchHistoryStore.getState().remember('alpha')).not.toThrow();
    expect(useSearchHistoryStore.getState().queries).toEqual(['alpha']);
  });
});

describe('suggestions API', () => {
  it('does not query MongoDB for empty or one-character input', async () => {
    expect((await (await GET(request('a'))).json()).products).toEqual([]);
    expect(connectDB).not.toHaveBeenCalled();
  });
  it('returns only projected products and matching active ingredients', async () => {
    vi.mocked(MedicationModel.find).mockReturnValue(result([{ _id: 'p1', name: 'Alpha', description: '500 мг · 10 табл.', price: 145, stock: 2, activeIngredient: 'alpha', requiresPrescription: true, dosage: '500 мг', packSize: 10 }]) as never);
    const response = await GET(request('al'));
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ products: [{ _id: 'p1', price: 145, description: '500 мг · 10 табл.', requiresPrescription: true, dosage: '500 мг', packSize: 10 }], ingredients: ['alpha'], correction: null });
    expect(MedicationModel.find).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: { $ne: true } }));
  });
  it('proposes a known catalog word without inventing products or silently changing the query', async () => {
    vi.mocked(MedicationModel.find).mockReturnValueOnce(result([]) as never).mockReturnValueOnce(result([{ name: 'Парацетамол 500 мг' }]) as never);
    const response = await GET(request('парацетомол'));
    expect(await response.json()).toEqual({ products: [], ingredients: [], correction: 'парацетамол' });
  });
  it('reports database errors as errors rather than a false empty result', async () => {
    vi.mocked(connectDB).mockRejectedValueOnce(new Error('private-database-error'));
    const response = await GET(request('alpha'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-database-error');
  });
});

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchAndFilters } from '@/components/SearchAndFilters';
import type { CatalogFacets } from '@/lib/catalog';

const navigation = vi.hoisted(() => ({ query: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: navigation.push }), useSearchParams: () => new URLSearchParams(navigation.query) }));
const facets: CatalogFacets = { forms: { tablets: 2 }, dosage: [], packSize: [], activeIngredient: [], country: [], atcCode: [], brand: [], manufacturer: [], ageGroup: [], packageType: [], maxPrice: 10000 };
const view = () => <SearchAndFilters facets={facets} categories={[]} total={0}><p>Results</p></SearchAndFilters>;
const lastUrl = () => new URL(navigation.push.mock.calls.at(-1)![0], 'http://localhost');

beforeEach(() => {
  navigation.query = '';
  navigation.push.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('catalog URL controls', () => {
  it('shows the 0–10000 price range with two accessible slider handles', () => {
    render(view());
    expect(screen.getByRole('spinbutton', { name: 'Мінімальна ціна' })).toHaveValue(0);
    expect(screen.getByRole('spinbutton', { name: 'Максимальна ціна' })).toHaveValue(10000);
    expect(screen.getByRole('slider', { name: 'Нижня межа ціни' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByRole('slider', { name: 'Верхня межа ціни' })).toHaveAttribute('aria-valuemax', '10000');
  });

  it('applies a price above 1000 and preserves the other filters', () => {
    navigation.query = 'category=Test&search=alpha&page=2';
    render(view());
    const high = screen.getByRole('spinbutton', { name: 'Максимальна ціна' });
    fireEvent.change(high, { target: { value: '7500' } });
    fireEvent.blur(high);
    expect(lastUrl().searchParams.get('maxPrice')).toBe('7500');
    expect(lastUrl().searchParams.get('category')).toBe('Test');
    expect(lastUrl().searchParams.get('search')).toBe('alpha');
    expect(lastUrl().searchParams.has('page')).toBe(false);
  });

  it('applies either slider handle using the keyboard', () => {
    render(view());
    const lower = screen.getByRole('slider', { name: 'Нижня межа ціни' });
    act(() => lower.focus());
    fireEvent.keyDown(lower, { key: 'ArrowRight' });
    expect(lastUrl().searchParams.get('minPrice')).toBe('1');
    const upper = screen.getByRole('slider', { name: 'Верхня межа ціни' });
    act(() => upper.focus());
    fireEvent.keyDown(upper, { key: 'ArrowLeft' });
    expect(lastUrl().searchParams.get('maxPrice')).toBe('9999');
    expect(lastUrl().searchParams.get('minPrice')).toBe('1');
  });

  it('preserves the search and sort when adding a filter and resets pagination', () => {
    navigation.query = 'search=alpha&sort=price_desc&page=3';
    render(view());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Лише в наявності' }));
    const params = lastUrl().searchParams;
    expect(params.get('search')).toBe('alpha');
    expect(params.get('sort')).toBe('price_desc');
    expect(params.get('inStock')).toBe('true');
    expect(params.has('page')).toBe(false);
  });

  it('submits the search using Enter/form submission while preserving the category', () => {
    navigation.query = 'category=Test&page=2';
    render(view());
    fireEvent.change(screen.getByLabelText('Назва або діюча речовина'), { target: { value: 'new query' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(lastUrl().searchParams.get('search')).toBe('new query');
    expect(lastUrl().searchParams.get('category')).toBe('Test');
    expect(lastUrl().searchParams.has('page')).toBe(false);
  });

  it('removes only the selected value of a multi-select filter', () => {
    navigation.query = 'form=tablets&form=capsules&inStock=true';
    render(view());
    fireEvent.click(screen.getByRole('button', { name: 'Прибрати фільтр: Форма: Таблетки' }));
    expect(lastUrl().searchParams.getAll('form')).toEqual(['capsules']);
    expect(lastUrl().searchParams.get('inStock')).toBe('true');
  });

  it('restores the search input and checked filters when the URL changes', () => {
    navigation.query = 'search=first&inStock=true';
    const { rerender } = render(view());
    fireEvent.change(screen.getByLabelText('Назва або діюча речовина'), { target: { value: 'unsent' } });
    navigation.query = 'search=previous';
    rerender(view());
    expect(screen.getByLabelText('Назва або діюча речовина')).toHaveValue('previous');
    expect(screen.getByRole('checkbox', { name: 'Лише в наявності' })).not.toBeChecked();
  });

  it('does not navigate with an inverted price range', () => {
    render(view());
    const low = screen.getByRole('spinbutton', { name: 'Мінімальна ціна' });
    fireEvent.change(low, { target: { value: '20000' } });
    fireEvent.blur(low);
    expect(screen.getByRole('alert')).toHaveTextContent('Вкажіть коректний діапазон ціни.');
    expect(navigation.push).not.toHaveBeenCalled();
  });
});

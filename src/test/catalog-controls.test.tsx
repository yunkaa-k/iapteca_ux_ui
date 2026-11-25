import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchAndFilters } from '@/components/SearchAndFilters';
import type { CatalogFacets } from '@/lib/catalog';

const navigation = vi.hoisted(() => ({ query: '', push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: navigation.push }), useSearchParams: () => new URLSearchParams(navigation.query) }));
const facets: CatalogFacets = { forms: { tablets: 2 }, dosage: [], packSize: [], activeIngredient: [], country: [], atcCode: [], brand: [], manufacturer: [], ageGroup: [], packageType: [], maxPrice: 10000 };
const view = () => <SearchAndFilters facets={facets} categories={[]} total={0}><p>Results</p></SearchAndFilters>;
const lastUrl = () => new URL(navigation.push.mock.calls.at(-1)![0], 'http://localhost');
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeEach(() => {
  navigation.query = '';
  navigation.push.mockClear();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); if (originalScrollIntoView) HTMLElement.prototype.scrollIntoView = originalScrollIntoView; else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView'); });

describe('catalog URL controls', () => {
  it('shows short unique age options and navigates using the grouped age', async () => {
    navigation.query = 'ageGroup=';
    render(<SearchAndFilters facets={{ ...facets, ageGroup: ['Від 12 років.', 'Від 12 років; маса тіла — не менше 40 кг.', 'Від 6 років; маса тіла — понад 20 кг.', 'Дорослим; досвіду застосування дітям немає.', 'Дітям — відповідна форма та дозування за призначенням лікаря.'] }} categories={[]} total={0}><p>Results</p></SearchAndFilters>);
    const trigger = screen.getByRole('combobox', { name: 'Вік пацієнта' });
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const list = await screen.findByRole('listbox');
    expect(within(list).getAllByRole('option').map(option => option.textContent)).toEqual(['Будь-який вік', 'Від 6 років', 'Від 12 років', 'Для дорослих']);
    const option = within(list).getByRole('option', { name: 'Від 12 років' });
    act(() => option.focus());
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(lastUrl().searchParams.get('ageGroup')).toBe('Від 12 років');
  });
  it('keeps only the five design dosage options even after combination strengths are filled', () => {
    navigation.query = 'dosage=200+%D0%BC%D0%B3';
    render(<SearchAndFilters facets={{ ...facets, dosage: ['0,86 мг (2500 МО) + 1 мг + 1 мг + 35 мг', '240 мг + 180 мг + 30 мг', '50 мг/г + 5 мг/г', '200 мг'] }} categories={[]} total={1}><p>Results</p></SearchAndFilters>);
    const group = screen.getByRole('group', { name: 'Дозування' });
    expect(within(group).getAllByRole('checkbox').map(box => box.closest('label')?.textContent)).toEqual(['200 мг', '400 мг', '500 мг', '5 мг', '60 мг']);
    fireEvent.click(within(group).getByRole('checkbox', { name: '500 мг' }));
    expect(lastUrl().searchParams.getAll('dosage')).toEqual(['200 мг', '500 мг']);
  });
  it('opens category options in design order and selects a category with the keyboard', async () => {
    render(<SearchAndFilters facets={facets} categories={[
      { _id: 'skin', name: 'Дерматологія та догляд' },
      { _id: 'pain', name: 'Біль і запалення' },
      { _id: 'cold', name: 'Застуда та грип' },
    ]} total={0}><p>Results</p></SearchAndFilters>);
    const trigger = screen.getByRole('combobox', { name: 'Категорія' });
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const list = await screen.findByRole('listbox');
    expect(within(list).getAllByRole('option').map(option => option.textContent)).toEqual(['Усі категорії', 'Застуда та грип', 'Біль і запалення', 'Дерматологія та догляд']);
    const option = within(list).getByRole('option', { name: 'Біль і запалення' });
    act(() => option.focus());
    fireEvent.keyDown(option, { key: 'Enter' });
    expect(lastUrl().searchParams.get('category')).toBe('Біль і запалення');
  });
  it('refreshes repeated filter combinations instead of reusing a stale navigation URL', () => {
    navigation.query = 'prescription=not-required&sort=price_desc';
    const result = render(view());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Рецептурні' }));
    const both = lastUrl();
    expect(both.searchParams.getAll('prescription')).toEqual(['not-required', 'required']);
    navigation.query = both.searchParams.toString();
    result.rerender(view());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Рецептурні' }));
    const single = lastUrl();
    expect(single.searchParams.getAll('prescription')).toEqual(['not-required']);
    expect(single.searchParams.get('sort')).toBe('price_desc');
    navigation.query = single.searchParams.toString();
    result.rerender(view());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Рецептурні' }));
    const bothAgain = lastUrl();
    expect(bothAgain.searchParams.getAll('prescription')).toEqual(['not-required', 'required']);
    expect(bothAgain.href).not.toBe(both.href);
    expect(bothAgain.searchParams.getAll('_revision')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Прибрати фільтр:.*revision/ })).not.toBeInTheDocument();
  });

  it('keeps filters and results on the same server snapshot while the browser URL changes', () => {
    navigation.query = 'prescription=not-required&prescription=required';
    const result = render(<SearchAndFilters queryString="prescription=not-required" facets={facets} categories={[]} total={10}><p>OTC results</p></SearchAndFilters>);
    fireEvent.click(screen.getByText('Додаткові фільтри'));
    expect(screen.getByRole('checkbox', { name: 'Без рецепта' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('checkbox', { name: 'Рецептурні' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('status')).toHaveTextContent('Знайдено 10 товарів');
    result.rerender(<SearchAndFilters queryString="prescription=required" facets={facets} categories={[]} total={1}><p>Rx results</p></SearchAndFilters>);
    expect(screen.getByRole('checkbox', { name: 'Без рецепта' })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByRole('checkbox', { name: 'Рецептурні' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Знайдено 1 товар');
    expect(screen.queryByText('OTC results')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Рецептурні' }));
    expect(lastUrl().searchParams.has('prescription')).toBe(false);
  });
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

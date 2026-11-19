import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogSearch } from '@/components/CatalogSearch';
import { useSearchHistoryStore } from '@/lib/store/searchHistoryStore';

const actions = { onSearch: vi.fn(), onCategory: vi.fn(), onBrowseCatalog: vi.fn() };
const input = () => screen.getByRole('combobox', { name: 'Назва або діюча речовина' });
const response = (data: object) => ({ ok: true, json: async () => data });
const productData = (name: string) => ({ products: [{ _id: 'p1', name, price: 145, stock: 2 }], ingredients: [], correction: null });

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); useSearchHistoryStore.setState({ queries: [] });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ products: [], ingredients: [], correction: null })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('catalog suggestions', () => {
  it('opens recent queries without a network request and supports arrows/Escape', () => {
    useSearchHistoryStore.getState().remember('recent');
    render(<CatalogSearch initialValue="" disabled={false} {...actions} />);
    act(() => input().focus());
    expect(screen.getByRole('dialog', { name: 'Підказки пошуку' })).toBeVisible();
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    expect(screen.getByRole('button', { name: 'recent' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(input()).toHaveFocus();
    expect(input()).toHaveAttribute('aria-expanded', 'false');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('remembers submitted queries and clears history using the panel action', () => {
    render(<CatalogSearch initialValue="" disabled={false} {...actions} />);
    fireEvent.change(input(), { target: { value: 'query' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(actions.onSearch).toHaveBeenCalledWith('query');
    expect(useSearchHistoryStore.getState().queries).toEqual(['query']);
    fireEvent.click(screen.getByRole('button', { name: 'Очистити пошуковий запит' }));
    fireEvent.click(screen.getByRole('button', { name: 'Очистити' }));
    expect(useSearchHistoryStore.getState().queries).toEqual([]);
  });

  it('displays live product links after the debounce', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(productData('Alpha')) as Response);
    render(<CatalogSearch initialValue="" disabled={false} {...actions} />);
    fireEvent.change(input(), { target: { value: 'alpha' } });
    expect((await screen.findByRole('link', { name: /Alpha/ })).getAttribute('href')).toBe('/product/p1');
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Усі результати за «alpha»' }));
    expect(actions.onSearch).toHaveBeenCalledWith('alpha');
  });

  it('ignores a late response for an older query even if fetch ignores abort', async () => {
    let old: (value: Response) => void = () => {};
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { old = resolve; })).mockResolvedValueOnce(response(productData('Latest')) as Response);
    render(<CatalogSearch initialValue="" disabled={false} {...actions} />);
    fireEvent.change(input(), { target: { value: 'old' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    fireEvent.change(input(), { target: { value: 'latest' } });
    await screen.findByRole('link', { name: /Latest/ });
    await act(async () => old(response(productData('Old product')) as Response));
    expect(screen.queryByRole('link', { name: /Old product/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Latest/ })).toBeVisible();
  });

  it('requires explicit selection before applying a spelling correction', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ products: [], ingredients: [], correction: 'парацетамол' }) as Response);
    render(<CatalogSearch initialValue="" disabled={false} {...actions} />);
    fireEvent.change(input(), { target: { value: 'парацетомол' } });
    const correction = await screen.findByRole('button', { name: 'Можливо, ви мали на увазі парацетамол?' });
    expect(input()).toHaveValue('парацетомол');
    expect(actions.onSearch).not.toHaveBeenCalled();
    fireEvent.click(correction);
    expect(actions.onSearch).toHaveBeenCalledWith('парацетамол');
  });

  it('lets the user retry a failed suggestion request', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(productData('Recovered')) as Response);
    render(<CatalogSearch initialValue="" disabled={false} {...actions} />);
    fireEvent.change(input(), { target: { value: 'alpha' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Не вдалося завантажити підказки.');
    fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }));
    expect(await screen.findByRole('link', { name: /Recovered/ })).toBeVisible();
  });

  it('opens a category for a symptom without recommending a particular medicine', () => {
    render(<CatalogSearch initialValue="" disabled={false} {...actions} />);
    act(() => input().focus());
    fireEvent.click(screen.getByRole('button', { name: 'Біль Голова, зуби, м’язи' }));
    expect(actions.onCategory).toHaveBeenCalledWith('Біль і запалення');
    expect(actions.onSearch).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

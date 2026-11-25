'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchHistoryStore } from '@/lib/store/searchHistoryStore';
import { useHydrated } from '@/lib/useHydrated';
import { popularQueries, suggestedQueries, symptomCategories, type SearchSuggestions } from '@/lib/searchSuggestions';
import { useCartStore } from '@/lib/store/cartStore';
import { notifyCartAdded } from './ProductFeedback';
import styles from './CatalogSearch.module.css';

type ResponseState = { key: string; data?: SearchSuggestions; failed?: boolean };

function SearchChoice({ children, onClick, className = styles.choice }: { children: ReactNode; onClick: () => void; className?: string }) {
  return <button data-search-choice className={className} type="button" onClick={onClick}>{children}</button>;
}

function PopularQueries({ heading, onChoose }: { heading: string; onChoose: (term: string) => void }) {
  return <section className={styles.section}><h2>{heading}</h2><div className={styles.chips}>{popularQueries.map((term) => <SearchChoice key={term} className={styles.chip} onClick={() => onChoose(term)}>{term}</SearchChoice>)}</div></section>;
}

export function CatalogSearch({ initialValue, disabled, onSearch, onCategory, onBrowseCatalog }: { initialValue: string; disabled: boolean; onSearch: (query: string) => void; onCategory: (category: string) => void; onBrowseCatalog: () => void }) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const focusEdge = useRef(0);
  const suppressFocusOpen = useRef(false);
  const hydrated = useHydrated();
  const history = useSearchHistoryStore((state) => state.queries);
  const remember = useSearchHistoryStore((state) => state.remember);
  const remove = useSearchHistoryStore((state) => state.remove);
  const clearHistory = useSearchHistoryStore((state) => state.clear);
  const addItem = useCartStore(state => state.addItem);
  const cartItems = useCartStore(state => state.items);
  const query = value.trim();
  const requestKey = `${query}:${retry}`;
  const current = response?.key === requestKey ? response : null;

  useEffect(() => {
    if (initialValue) remember(initialValue);
  }, [initialValue, remember]);

  useEffect(() => {
    if (!open || query.length < 2) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`, { signal: controller.signal, cache: 'no-store' });
        if (!result.ok) throw new Error('SuggestionsUnavailable');
        const data = await result.json() as SearchSuggestions;
        if (active) setResponse({ key: requestKey, data });
      } catch {
        if (active && !controller.signal.aborted) setResponse({ key: requestKey, failed: true });
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [query, open, requestKey]);

  useEffect(() => {
    if (open && focusEdge.current) {
      const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('[data-search-choice]:not(:disabled)') || []);
      (focusEdge.current > 0 ? targets[0] : targets.at(-1))?.focus();
      focusEdge.current = 0;
    }
  }, [open]);

  function close(returnFocus = false) {
    setOpen(false);
    if (returnFocus) {
      suppressFocusOpen.current = true;
      input.current?.focus();
      suppressFocusOpen.current = false;
    }
  }
  function chooseSearch(next: string) {
    setValue(next);
    remember(next);
    close();
    onSearch(next.trim());
  }
  function keys(event: KeyboardEvent<HTMLElement>, fromInput = false) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    if (!open) { focusEdge.current = direction; setOpen(true); return; }
    const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('[data-search-choice]:not(:disabled)') || []);
    if (!targets.length) return;
    const index = targets.indexOf(event.target as HTMLElement);
    const next = fromInput ? direction > 0 ? 0 : targets.length - 1 : (index + direction + targets.length) % targets.length;
    targets[next]?.focus();
  }

  const data = current?.data;
  const queries = data ? suggestedQueries(query, data.products, data.ingredients) : [];
  const ingredient = data?.ingredients.find(term => !/[,;+]/.test(term)) || data?.ingredients[0];
  const allResultsQuery = ingredient?.toLocaleLowerCase('uk-UA').startsWith(query.toLocaleLowerCase('uk-UA')) ? ingredient.toLocaleLowerCase('uk-UA') : query;

  return (
    <div className={styles.wrapper} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(); }}>
      <form className={styles.search} role="search" onSubmit={(event) => { event.preventDefault(); chooseSearch(value); }}>
        <Image src="/images/home/search.svg" alt="" width={20} height={20} />
        <label className="sr-only" htmlFor="catalog-search">Назва або діюча речовина</label>
        <input ref={input} id="catalog-search" name="search" type="search" role="combobox" aria-haspopup="dialog" aria-expanded={open && !disabled} aria-controls={open && !disabled ? 'catalog-suggestions' : undefined} autoComplete="off" placeholder="Шукайте препарати за назвою або діючою речовиною" value={value} maxLength={150} disabled={disabled} onChange={(event) => { setValue(event.target.value); setOpen(true); }} onFocus={() => { if (!suppressFocusOpen.current) setOpen(true); }} onClick={() => setOpen(true)} onKeyDown={(event) => keys(event, true)} />
        {value && <button type="button" className={styles.clearQuery} aria-label="Очистити пошуковий запит" disabled={disabled} onClick={() => { setValue(''); setOpen(true); input.current?.focus(); }}>×</button>}
        <button className={styles.submit} type="submit" disabled={disabled}>Знайти</button>
      </form>

      {open && !disabled && <div ref={panel} id="catalog-suggestions" className={`${styles.panel} ${data?.products.length ? styles.productPanel : ''}`} role="dialog" aria-label="Підказки пошуку" onKeyDown={(event) => keys(event)}>
        {query.length < 2 ? (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeading}><h2>НЕЩОДАВНІ ПОШУКИ</h2>{hydrated && history.length > 0 && <button className={styles.textButton} type="button" onClick={clearHistory}>Очистити</button>}</div>
              {hydrated && history.length > 0 ? history.map((term) => <div key={term} className={styles.recentRow}><SearchChoice onClick={() => chooseSearch(term)}>{term}</SearchChoice><button className={styles.remove} type="button" aria-label={`Видалити запит: ${term}`} onClick={() => remove(term)}>×</button></div>) : <p className={styles.muted}>Ви ще нічого не шукали.</p>}
            </section>
            <PopularQueries heading="ПОПУЛЯРНЕ ЗАРАЗ" onChoose={chooseSearch} />
            <section className={styles.section}><h2>ШУКАТИ ЗА СИМПТОМОМ</h2><div className={styles.symptoms}>{symptomCategories.map((item) => <SearchChoice key={item.title} className={styles.symptom} onClick={() => { close(); onCategory(item.category); }}><strong>{item.title}</strong>{' '}<span>{item.detail}</span></SearchChoice>)}</div></section>
          </>
        ) : !current ? <p className={styles.message} role="status">Шукаємо підказки…</p> : current.failed ? (
          <div className={styles.message}><p role="alert">Не вдалося завантажити підказки.</p><button className={styles.textButton} type="button" onClick={() => setRetry((attempt) => attempt + 1)}>Спробувати ще раз</button></div>
        ) : data?.products.length ? (
          <div className={styles.columns}>
            <div className={styles.queries}>
              <section className={styles.section}><h2>ЗАПИТИ</h2><div className={styles.queryList}>{queries.map((term, index) => <SearchChoice key={term} className={`${styles.queryChoice} ${index === 0 ? styles.queryPrimary : ''}`} onClick={() => chooseSearch(term)}><Image src={index === 0 ? '/images/catalog/query-search.svg' : '/images/catalog/query-search-muted.svg'} alt="" width={16} height={16} /><span>{term}</span></SearchChoice>)}</div></section>
              {ingredient && <section className={styles.section}><h2>ДІЮЧА РЕЧОВИНА</h2><div className={styles.ingredientList}>{[
                { title: ingredient, hint: 'Усі препарати з цією діючою речовиною' },
                { title: ingredient.toLocaleLowerCase('uk-UA') === 'парацетамол' ? 'Препарати з парацетамолом' : `Препарати: ${ingredient}`, hint: 'Порівняйте склад та дозування' },
              ].map(item => <SearchChoice key={item.title} className={styles.ingredientChoice} onClick={() => chooseSearch(ingredient)}><Image src="/images/catalog/ingredient-link.svg" alt="" width={20} height={20} /><span><strong>{item.title}</strong><small>{item.hint}</small></span></SearchChoice>)}</div></section>}
            </div>
            <section className={styles.productSection}><h2>ТОВАРИ</h2>
              {data.products.map((product) => {
                const canAdd = product.stock > (hydrated ? cartItems.find(item => item._id === product._id)?.quantity || 0 : 0);
                return <div className={styles.product} key={product._id}><Link data-search-choice className={styles.productLink} href={`/product/${product._id}`} onClick={() => { remember(query); close(); }}>
                  <span className={styles.productImage}>{product.image ? <Image src={product.image} alt="" fill sizes="72px" /> : <Image src="/images/home/search.svg" alt="" width={20} height={20} />}</span>
                  <span className={styles.productCopy}><strong>{product.name}</strong>{product.description && <span>{product.description}</span>}<span className={`${styles.availability} ${product.stock <= 0 ? styles.unavailable : ''}`}><Image src={product.stock > 0 ? '/images/home/availability-dot.svg' : '/images/home/availability-error-dot.svg'} alt="" width={8} height={8} />{product.stock > 0 ? 'В наявності' : 'Немає в наявності'}</span></span></Link><span className={styles.price}>{product.price.toLocaleString('uk-UA')} грн</span>
                  <button data-search-choice type="button" className={styles.cartButton} disabled={!canAdd} aria-label={`Додати ${product.name} до кошика`} onClick={() => { addItem({ ...product, description: product.description || '', category: product.category || '', manufacturer: product.manufacturer || '' }); notifyCartAdded(product.name); }}><Image src="/images/home/cart-add.svg" alt="" width={20} height={20} /></button>
                </div>;
              })}
              <SearchChoice className={styles.allResults} onClick={() => chooseSearch(allResultsQuery)}>Усі результати за «{allResultsQuery}»</SearchChoice>
            </section>
          </div>
        ) : (
          <>
            <section className={styles.section}><p className={styles.emptyText}>За запитом «{query}» нічого не знайдено</p>{data?.correction && <SearchChoice className={styles.correction} onClick={() => chooseSearch(data.correction!)}>Можливо, ви мали на увазі {data.correction}?</SearchChoice>}</section>
            <section className={styles.section}><h2>ЯК ЗНАЙТИ ШВИДШЕ</h2><div className={styles.recovery}>
              <SearchChoice className={styles.symptom} onClick={() => { setValue(''); input.current?.focus(); }}><strong>Діюча речовина</strong>{' '}<span>Шукайте за складом препарату</span></SearchChoice>
              <SearchChoice className={styles.symptom} onClick={() => { setValue(''); input.current?.focus(); }}><strong>Інший запит</strong>{' '}<span>Спробуйте іншу назву або написання</span></SearchChoice>
              <SearchChoice className={styles.symptom} onClick={() => { close(); onBrowseCatalog(); }}><strong>Каталог препаратів</strong>{' '}<span>Перегляньте всі доступні товари</span></SearchChoice>
            </div></section>
            <PopularQueries heading="ЧАСТО ШУКАЮТЬ" onChoose={chooseSearch} />
          </>
        )}
      </div>}
    </div>
  );
}

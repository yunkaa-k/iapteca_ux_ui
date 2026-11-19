'use client';

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Slider } from 'radix-ui';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { catalogQuery, catalogSelects, dosageForms, type CatalogFacets } from '@/lib/catalog';
import type { Category } from '@/lib/types';
import styles from './Catalog.module.css';
import { CatalogSearch } from './CatalogSearch';

function CatalogSelect({ id, label, value, placeholder, options, onChange, disabled }: { id: string; label: string; value: string; placeholder: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  const entries = value && !options.some((option) => option.value === value) ? [...options, { value, label: value }] : options;
  return (
    <Select value={value || '__all__'} onValueChange={(next) => onChange(next === '__all__' ? '' : next)} disabled={disabled}>
      <SelectTrigger id={id} className={styles.select} aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent><SelectItem value="__all__">{placeholder}</SelectItem>{entries.filter((entry) => entry.value && entry.value !== '__all__').map((entry) => <SelectItem key={entry.value} value={entry.value}>{entry.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function PriceFilter({ min, max, bound, disabled, apply }: { min: number; max: number; bound: number; disabled: boolean; apply: (min: number, max: number) => void }) {
  const [low, setLow] = useState(String(min));
  const [high, setHigh] = useState(String(max));
  const [error, setError] = useState('');
  function commit() {
    const start = Number(low);
    const end = Number(high);
    if (!low.trim() || !high.trim() || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
      setError('Вкажіть коректний діапазон ціни.');
      return;
    }
    setError('');
    if (start !== min || end !== max) apply(start, end);
  }
  const rangeMax = Math.max(bound, Number(high) || 0, Number(low) || 0);
  const rangeLow = Math.max(0, Math.min(Number(low) || 0, rangeMax));
  const rangeHigh = Math.max(rangeLow, Number(high) || 0);
  return (
    <form className={styles.priceFilter} onSubmit={(event) => { event.preventDefault(); commit(); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commit(); }}>
      <Slider.Root className={styles.range} min={0} max={rangeMax} step={1} value={[rangeLow, rangeHigh]} disabled={disabled} onValueChange={([start, end]) => { setLow(String(start)); setHigh(String(end)); setError(''); }} onValueCommit={([start, end]) => { if (start !== min || end !== max) apply(start, end); }}>
        <Slider.Track className={styles.rangeTrack}><Slider.Range className={styles.rangeSelected} /></Slider.Track>
        <Slider.Thumb className={styles.rangeThumb} aria-label="Нижня межа ціни" aria-valuetext={`${rangeLow} грн`} />
        <Slider.Thumb className={styles.rangeThumb} aria-label="Верхня межа ціни" aria-valuetext={`${rangeHigh} грн`} />
      </Slider.Root>
      <div className={styles.priceInputs}>
        <label className={styles.priceField}><span>Від</span><Input aria-label="Мінімальна ціна" type="number" min="0" step="0.01" value={low} disabled={disabled} aria-invalid={!!error} aria-describedby={error ? 'price-error' : undefined} onChange={(event) => setLow(event.target.value)} /><span>грн</span></label>
        <label className={styles.priceField}><span>До</span><Input aria-label="Максимальна ціна" type="number" min="0" step="0.01" value={high} disabled={disabled} aria-invalid={!!error} aria-describedby={error ? 'price-error' : undefined} onChange={(event) => setHigh(event.target.value)} /><span>грн</span></label>
      </div>
      {error && <p className={styles.error} id="price-error" role="alert">{error}</p>}
    </form>
  );
}

export function SearchAndFilters({ facets, categories, total, children }: { facets: CatalogFacets; categories: Category[]; total: number; children: ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const search = params.get('search') || '';
  const query = catalogQuery(new URLSearchParams(params.toString()));
  const min = query.minPrice ?? 0;
  const max = query.maxPrice ?? facets.maxPrice;

  function navigate(changes: Record<string, string | string[] | null>) {
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    for (const [key, value] of Object.entries(changes)) {
      next.delete(key);
      for (const entry of Array.isArray(value) ? value : value ? [value] : []) next.append(key, entry);
    }
    if (next.toString() === params.toString()) return;
    startTransition(() => router.push(`/catalog${next.size ? `?${next}` : ''}`, { scroll: false }));
  }
  function toggle(key: string, value: string, checked: boolean) {
    const selected = params.getAll(key);
    navigate({ [key]: checked ? [...selected.filter((entry) => entry !== value), value] : selected.filter((entry) => entry !== value) });
  }
  function resetFilters() {
    startTransition(() => router.push(`/catalog${search ? `?search=${encodeURIComponent(search)}` : ''}`, { scroll: false }));
  }
  const chipLabels: Record<string, string> = { category: 'Категорія', form: 'Форма', dosage: 'Дозування', packSize: 'Упаковка', prescription: 'Рецептурність', inStock: 'Лише в наявності', minPrice: 'Від', maxPrice: 'До', onSale: 'Акційні товари', ...Object.fromEntries(catalogSelects.map((item) => [item.key, item.label])) };
  const chips = Array.from(params.entries()).filter(([key, value]) => key in chipLabels && value !== '' && !(['inStock', 'onSale'].includes(key) && value !== 'true'));
  const checkRow = (key: string, value: string, label: string) => (
    <label className={styles.checkRow} key={`${key}-${value}`}>
      <Checkbox checked={params.getAll(key).includes(value)} disabled={pending} onCheckedChange={(checked) => toggle(key, value, checked === true)} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link><span aria-hidden="true">/</span><span aria-current="page">Каталог</span></nav>
      <header className={styles.heading}><h1>{search ? 'Результати пошуку' : 'Каталог товарів'}</h1><p>Знаходьте препарати та уточнюйте результати за допомогою фільтрів</p></header>
      <div className={styles.searchRow}>
        <CatalogSearch key={search} initialValue={search} disabled={pending} onSearch={(value) => navigate({ search: value || null })} onCategory={(category) => navigate({ category, search: null })} onBrowseCatalog={() => startTransition(() => router.push('/catalog', { scroll: false }))} />
      </div>
      <div className={styles.layout}>
        <aside className={styles.sidebar} aria-label="Фільтри каталогу">
          <div className={styles.filterHeading}><h2>Фільтри</h2><button className={styles.textButton} type="button" disabled={pending || !chips.length} onClick={resetFilters}>Скинути</button></div>
          <div className={styles.group}><label htmlFor="catalog-category">Категорія</label><CatalogSelect id="catalog-category" label="Категорія" value={params.get('category') || ''} placeholder="Усі категорії" options={categories.map((category) => ({ value: category.name, label: category.name }))} onChange={(value) => navigate({ category: value })} disabled={pending} /></div>
          <fieldset className={styles.group}><legend>Лікарська форма</legend>{dosageForms.map((form) => checkRow('form', form.value, `${form.label} (${facets.forms[form.value] || 0})`))}</fieldset>
          <fieldset className={styles.group}><legend>Наявність</legend>{checkRow('inStock', 'true', 'Лише в наявності')}</fieldset>
          <div className={styles.group}><h3>Ціна, грн</h3><PriceFilter key={`${min}:${max}`} min={Math.max(0, min)} max={max} bound={facets.maxPrice} disabled={pending} apply={(low, high) => navigate({ minPrice: low > 0 ? String(low) : null, maxPrice: high < facets.maxPrice || params.has('maxPrice') ? String(high) : null })} /></div>
          <details className={styles.advanced}>
            <summary>Додаткові фільтри</summary>
            <div className={styles.advancedContent}>
              <fieldset className={styles.group}><legend>Дозування</legend>{(facets.dosage.length ? facets.dosage : ['200 мг', '400 мг', '500 мг', '5 мг', '60 мг']).map((dose) => checkRow('dosage', dose, dose))}</fieldset>
              <fieldset className={styles.group}><legend>Кількість в упаковці</legend>{(facets.packSize.length ? facets.packSize : ['12', '20', '24', '10', '30', '100']).map((pack) => checkRow('packSize', pack, `№${pack}`))}</fieldset>
              <fieldset className={styles.group}><legend>Рецептурність</legend>{checkRow('prescription', 'not-required', 'Без рецепта')}{checkRow('prescription', 'required', 'Рецептурні')}</fieldset>
              {catalogSelects.map(({ key, label, placeholder }) => <div className={styles.group} key={key}><label htmlFor={`filter-${key}`}>{label}</label><CatalogSelect id={`filter-${key}`} label={label} placeholder={placeholder} value={params.get(key) || ''} options={facets[key].map((value) => ({ value, label: value }))} onChange={(value) => navigate({ [key]: value })} disabled={pending} />{key === 'ageGroup' && <p className={styles.hint}>Враховуйте також обмеження за масою тіла з інструкції.</p>}</div>)}
              <fieldset className={styles.group}><legend>Пропозиції</legend>{checkRow('onSale', 'true', 'Акційні товари')}</fieldset>
            </div>
          </details>
        </aside>

        <div className={styles.main} aria-busy={pending}>
          <div className={styles.resultsHeading}><div><h2>{search ? 'Результати пошуку' : chips.length ? 'Результати фільтрації' : 'Усі товари'}</h2><p role="status">{pending ? 'Оновлюємо результати…' : `Знайдено ${total} товарів`}</p></div><div className={styles.sort}><CatalogSelect id="catalog-sort" label="Сортування товарів" value={params.get('sort') || 'price_asc'} placeholder="Оберіть сортування" options={[{ value: 'price_asc', label: 'За ціною: спочатку дешевші' }, { value: 'price_desc', label: 'За ціною: спочатку дорожчі' }, { value: 'newest', label: 'Спочатку нові' }]} onChange={(value) => navigate({ sort: value })} disabled={pending} /></div></div>
          {chips.length > 0 && <div className={styles.chips} aria-label="Застосовані фільтри">{chips.map(([key, value]) => {
            const display = key === 'form' ? dosageForms.find((form) => form.value === value)?.label || value : key === 'prescription' ? value === 'required' ? 'Рецептурні' : 'Без рецепта' : value;
            const label = key === 'inStock' || key === 'onSale' ? chipLabels[key] : `${chipLabels[key]}: ${display}${key.endsWith('Price') ? ' грн' : ''}`;
            return <button className={styles.chip} key={`${key}-${value}`} type="button" disabled={pending} aria-label={`Прибрати фільтр: ${label}`} onClick={() => toggle(key, value, false)}>{label}<span aria-hidden="true">×</span></button>;
          })}</div>}
          {children}
        </div>
      </div>
    </div>
  );
}

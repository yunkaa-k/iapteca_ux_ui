'use client';
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronDown, Heart } from 'lucide-react';
import { notifyCartAdded, notifyFavorite } from './ProductFeedback';
import type { Medication } from '@/lib/types';
import { money, productFacts, prescriptionLabel, unitPrice } from '@/lib/product';
import { productInstruction } from '@/lib/product-instructions';
import { useCartStore } from '@/lib/store/cartStore';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useHydrated } from '@/lib/useHydrated';
import { ProductCard } from './ProductCard';
import styles from './ProductDetails.module.css';

const comparisonPriceFormat = new Intl.NumberFormat('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function comparisonUnitPrice(medication: Medication) {
  if (!medication.packSize || medication.packSize <= 0) return 'Не вказано';
  return comparisonPriceFormat.format(medication.price / medication.packSize) + ' грн';
}

function Accordion({ title, children, initialOpen = false }: { title: string; children: ReactNode; initialOpen?: boolean }) {
  return <details className={styles.accordion} open={initialOpen || undefined}><summary>{title}<span><span className={styles.closedText}>Розгорнути</span><span className={styles.openText}>Згорнути</span><ChevronDown size={16} aria-hidden="true" /></span></summary><div className={styles.accordionBody}>{children}</div></details>;
}
export function ProductDetails({ medication: med, alternatives }: { medication: Medication; alternatives: Medication[] }) {
  const instruction = productInstruction(med);
  const [quantity, setQuantity] = useState(1);
  const [compared, setCompared] = useState<string[]>([]);
  const hydrated = useHydrated();
  const inCart = useCartStore(state => state.items.find(item => item._id === med._id)?.quantity || 0);
  const addItem = useCartStore(state => state.addItem);
  const saved = useFavoritesStore(state => state.items.some(item => item.medication._id === med._id));
  const toggle = useFavoritesStore(state => state.toggle);
  const available = Math.max(0, med.stock - (hydrated ? inCart : 0));
  const compareAll = useRef<HTMLButtonElement>(null);
  const selected = alternatives.filter(item => compared.includes(item._id));
  selected.splice(Math.min(2, selected.length), 0, med);
  return <div className={styles.page}>
    <nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link> / <Link href="/catalog">Каталог</Link> / <span aria-current="page">{med.name}</span></nav>
    <h1>{med.name}</h1>
    <div className={`${styles.overview} ${med.stock <= 0 ? styles.stockZero : ''}`}>
      <section className={styles.gallery} aria-label="Зображення препарату"><div className={styles.photo}>{med.image ? <span className={med.stock <= 0 ? styles.stockZeroImage : styles.fullImage}><Image src={med.image} alt={med.name} fill sizes={med.stock <= 0 ? "230px" : "488px"} /></span> : <span>Зображення ще не додано</span>}</div><p>Зовнішній вигляд товару може відрізнятися від зображеного</p></section>
      <section className={styles.purchase} aria-label="Придбати препарат">
        <div className={styles.badges}><span className={med.stock > 0 ? styles.stock : styles.unavailable}>{med.stock > 0 ? '● В наявності' : <><Image src="/images/home/availability-error-dot.svg" alt="" width={8} height={8} />Немає в наявності</>}</span>{med.requiresPrescription !== undefined && <span className={med.requiresPrescription ? styles.rx : styles.otc}>{prescriptionLabel(med)}</span>}</div>
        <dl className={styles.keyFacts}>{productFacts(med).filter(([name]) => ['Діючі речовини', 'Дозування', 'Кількість в упаковці'].includes(name)).map(([name, value]) => <div key={name}><dt>{name === 'Кількість в упаковці' ? 'В упаковці' : name}</dt><dd>{value}</dd></div>)}</dl>
        <div><p className={styles.muted}>Виробник</p><p>{med.manufacturer}{med.country ? ` · ${med.country}` : ''}</p></div>
        <div className={styles.priceBlock}><p className={styles.muted}>Ціна за упаковку</p><div className={styles.price}><strong>{money(med.price)}</strong>{med.packSize && <span>{unitPrice(med, med.stock <= 0 ? 2 : undefined)}</span>}</div></div>
        {med.stock > 0 ? <div className={styles.buyRow}><div className={styles.quantity} aria-label="Кількість упаковок"><button type="button" aria-label="Зменшити кількість" disabled={quantity <= 1} onClick={() => setQuantity(value => value - 1)}>−</button><output aria-live="polite">{Math.min(quantity, available || 1)}</output><button type="button" aria-label="Збільшити кількість" disabled={quantity >= available} onClick={() => setQuantity(value => value + 1)}>+</button></div><button className={styles.primary} disabled={!available} onClick={() => { const count = Math.min(quantity, available); for (let i = 0; i < count; i++) addItem(med); if (count) notifyCartAdded(med.name); }}>{available ? 'Додати в кошик' : 'Увесь доступний залишок уже в кошику'}</button><button className={`${styles.favorite} ${hydrated && saved ? styles.saved : ''}`} aria-label={hydrated && saved ? 'Вилучити з обраного' : 'Додати до обраного'} aria-pressed={hydrated && saved} onClick={() => { toggle({ medication: med }); notifyFavorite(med.name, hydrated && saved); }}><Heart size={22} fill={hydrated && saved ? 'currentColor' : 'none'} aria-hidden="true" /></button></div> : <><p className={styles.stockZeroExplanation}>Товару тимчасово немає в наявності. Перегляньте доступні варіанти нижче.</p><div className={styles.buyRow}><a className={styles.primary} href="#product-alternatives">Переглянути аналоги</a><button type="button" className={`${styles.favorite} ${styles.stockZeroFavorite} ${hydrated && saved ? styles.saved : ''}`} aria-label={hydrated && saved ? 'Вилучити з обраного' : 'Додати до обраного'} aria-pressed={hydrated && saved} onClick={() => { toggle({ medication: med }); notifyFavorite(med.name, hydrated && saved); }}><Image src={hydrated && saved ? '/images/home/heart-favorite-filled.svg' : '/images/account/product-unavailable-heart.svg'} alt="" width={22} height={22} /></button></div></>}
        {med.stock > 0 && <dl className={styles.delivery}><dt>Самовивіз</dt><dd>Вибір аптеки під час оформлення</dd><dt>Кур’єрська доставка</dt><dd>Доступність і вартість за адресою</dd></dl>}
      </section>
    </div>
    <div className={styles.accordions}>
      <Accordion title="Характеристики" initialOpen><dl className={styles.facts}>{productFacts(med).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl></Accordion>
      <Accordion title="Інструкція"><div className={styles.instruction}>
        <h3>Коротко про препарат</h3>
        <p>{instruction?.summary || med.description}</p>
        <p>Показання та спосіб застосування перевіряйте в офіційній інструкції виробника.</p>
        <div className={styles.instructionNote}>
          <strong>Перед застосуванням прочитайте повну інструкцію</strong>
          <p>Враховуйте протипоказання, взаємодії з іншими ліками та обмеження за віком і масою тіла. Дозу й тривалість застосування перевіряйте в інструкції саме цього препарату.</p>
          {instruction ? <a className={styles.instructionLink} href={instruction.url} target="_blank" rel="noopener noreferrer">Відкрити повну інструкцію<Image src="/images/account/instruction-external.svg" alt="" width={16} height={16} /><span className="sr-only"> (у новій вкладці)</span></a> : <p>Посилання на інструкцію для цього препарату ще не додано. Ознайомтеся з інструкцією в упаковці.</p>}
        </div>
        {instruction && <p className={styles.instructionSource}>Джерело: опублікована інструкція для обраного лікарського засобу.</p>}
      </div></Accordion>
      <Accordion title="Доставка та оплата"><dl className={styles.fulfillmentDetails}>
        <div><dt>Самовивіз з аптеки</dt><dd>Під час оформлення оберіть на мапі аптеку з підтвердженою наявністю всіх товарів із кошика.</dd></div>
        <div><dt>Кур’єрська доставка</dt><dd>Вкажіть адресу під час оформлення, щоб перевірити доступність доставки й дізнатися її вартість.</dd></div>
        <div><dt>Оплата</dt><dd>Доступний спосіб оплати та підсумкову суму буде показано перед підтвердженням замовлення.</dd></div>
      </dl></Accordion>
    </div>
    <section id="product-alternatives" className={styles.alternatives} aria-labelledby="alternatives-heading"><div className={styles.sectionHeading}><div><h2 id="alternatives-heading">{med.stock > 0 && alternatives.length > 0 ? 'Аналоги та інші варіанти' : 'Доступні аналоги та інші варіанти'}</h2><p>{alternatives.length ? `Порівняйте дозування, упаковку та ціну${med.dosageForm === 'tablets' ? ' за таблетку' : ' за одиницю'}.` : 'Спробуйте інший запит або поверніться до каталогу.'}</p></div>{alternatives.length > 0 && <button ref={compareAll} className={styles.secondary} onClick={() => setCompared(alternatives.map(item => item._id))}>Порівняти всі</button>}</div>
      {compared.length > 0 && <section className={styles.comparison} aria-labelledby="comparison-title">
        <div className={styles.comparisonHeader}><h3 id="comparison-title">Порівняння препаратів</h3><button type="button" className={styles.secondary} aria-label="Закрити порівняння" onClick={() => { setCompared([]); compareAll.current?.focus(); }}>Закрити<Image src="/images/account/comparison-close.svg" alt="" width={16} height={16} aria-hidden="true" /></button></div>
        <table aria-labelledby="comparison-title"><thead><tr><th scope="col">Параметр</th>{selected.map(item => <th scope="col" key={item._id}><Link href={`/product/${item._id}`}>{item.name}</Link>{item._id === med._id && <span className="sr-only">Переглядаєте зараз</span>}</th>)}</tr></thead><tbody>{['Діючі речовини', 'Дозування', 'Лікарська форма', 'Кількість в упаковці', 'Ціна упаковки', 'Ціна за одиницю', 'Країна виробництва'].map(name => <tr key={name} className={name === 'Дозування' ? styles.dosageRow : undefined}><th scope="row">{({ 'Діючі речовини': 'Діюча речовина', 'Кількість в упаковці': 'Упаковка', 'Ціна за одиницю': selected.every(item => item.dosageForm === 'tablets') ? 'Ціна за таблетку' : 'Ціна за одиницю', 'Країна виробництва': 'Країна' } as Record<string, string>)[name] || name}</th>{selected.map(item => <td key={item._id}>{name === 'Ціна упаковки' ? money(item.price) : name === 'Ціна за одиницю' ? comparisonUnitPrice(item) : name === 'Кількість в упаковці' && item.packSize ? `${item.packSize} ${item.dosageForm === 'tablets' ? 'табл.' : item.dosageForm === 'capsules' ? 'капс.' : 'од.'}` : productFacts(item).find(([label]) => label === name)?.[1]}</td>)}</tr>)}</tbody></table><p>Різні дозування не є рівнозначною заміною. Порівняння цін не є рекомендацією змінювати лікування; заміну узгодьте з лікарем або фармацевтом.</p></section>}
      {alternatives.length ? <div className={styles.alternativeGrid}>{alternatives.map(item => <ProductCard key={item._id} medication={item} variant="alternative" referenceDosage={med.dosage} footerAction={<button type="button" className={`${styles.secondary} ${styles.compareAlternative}`} aria-pressed={compared.includes(item._id)} onClick={() => setCompared(ids => ids.includes(item._id) ? ids.filter(id => id !== item._id) : [...ids, item._id])}>{compared.includes(item._id) ? 'Прибрати' : 'Порівняти'}</button>} summary={[item.activeIngredient, item.dosage, item.packSize ? `${item.packSize} ${item.dosageForm === 'tablets' ? 'табл.' : item.dosageForm === 'capsules' ? 'капс.' : 'од.'}` : ''].filter(Boolean).join(' · ')} />)}</div> : <div className={styles.empty}><h3>Доступних аналогів поки немає</h3><p>Перегляньте інші препарати або змініть параметри пошуку в каталозі.</p><Link className={styles.primary} href="/catalog">Повернутися до каталогу</Link></div>}
      {alternatives.length > 0 && <p className={styles.disclaimer}>Варіанти з іншим дозуванням не є автоматичною заміною препарату.</p>}
    </section>
  </div>;
}

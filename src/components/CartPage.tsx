'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useCartStore, type CartItem } from '@/lib/store/cartStore';
import { useHydrated } from '@/lib/useHydrated';
import { money, prescriptionLabel } from '@/lib/product';
import { prescriptionsApproved, usePrescriptionStore } from '@/lib/store/prescriptionStore';
import styles from './CartPage.module.css';

export function CartPage() {
  const { items, removeItem, updateQuantity, addItem } = useCartStore();
  const hydrated = useHydrated();
  const [removed, setRemoved] = useState<CartItem | null>(null);
  const prescriptions = usePrescriptionStore(state => state.entries);
  if (!hydrated) return <div className={styles.page} role="status">Завантажуємо кошик…</div>;
  const packages = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const rx = items.some(item => item.requiresPrescription === true);
  const knownOtc = items.every(item => item.requiresPrescription === false);
  function remove(item: CartItem) { setRemoved({ ...item }); removeItem(item._id); usePrescriptionStore.getState().remove(item._id); }
  function changeQuantity(item: CartItem, quantity: number) { updateQuantity(item._id, quantity); usePrescriptionStore.getState().remove(item._id); }
  function restore() {
    if (!removed) return;
    const current = useCartStore.getState().items.find(item => item._id === removed._id)?.quantity || 0;
    const count = Math.min(removed.quantity, Math.max(0, removed.stock - current));
    for (let i = 0; i < count; i++) addItem(removed);
    setRemoved(null);
  }
  return <div className={styles.page}>
    <div className={styles.heading}><h1>Кошик ({packages})</h1>{items.length > 0 && <Link href="/catalog"><ArrowLeft size={16} aria-hidden="true" />До каталогу</Link>}</div>
    {removed && <div className={styles.undo} role="status"><span>Товар «{removed.name}» видалено з кошика.</span><button onClick={restore}>Відновити</button><button aria-label="Закрити повідомлення про видалення" onClick={() => setRemoved(null)}>×</button></div>}
    {!items.length ? <section className={styles.empty}><span className={styles.emptyIcon}><Image src="/images/home/cart-header.svg" width={32} height={32} alt="" /></span><h2>Ваш кошик порожній</h2><p>Додайте препарати з каталогу, щоб оформити замовлення.</p><Link className={styles.primary} href="/catalog">Перейти до каталогу</Link></section> : <div className={styles.layout}>
      <div className={styles.items} aria-label="Товари в кошику">{items.map(item => <article className={styles.item} key={item._id}>
        <Link className={styles.image} href={`/product/${item._id}`} aria-label={`Переглянути ${item.name}`}>{item.image ? <Image src={item.image} alt="" fill sizes="144px" /> : <span>Немає фото</span>}</Link>
        <div className={styles.details}><div className={styles.itemHeading}><Link href={`/product/${item._id}`}>{item.name}</Link><button className={styles.remove} aria-label={`Видалити ${item.name}`} onClick={() => remove(item)}>Видалити</button></div><p className={styles.description}>{item.description}</p><div className={styles.statuses}><span className={item.stock > 0 ? styles.stock : styles.unavailable}>{item.stock > 0 ? '● В наявності' : '● Немає в наявності'}</span>{item.requiresPrescription !== undefined && <span className={item.requiresPrescription ? styles.rxBadge : styles.otc}>{prescriptionLabel(item)}</span>}</div>
          <div className={styles.bottom}><div><p className={styles.quantityLabel}>Кількість упаковок</p><div className={styles.quantity}><button aria-label={`Зменшити кількість ${item.name}`} onClick={() => item.quantity === 1 ? remove(item) : changeQuantity(item, item.quantity - 1)}>−</button><output aria-label={`Кількість ${item.name}`} aria-live="polite">{item.quantity}</output><button aria-label={`Збільшити кількість ${item.name}`} disabled={item.quantity >= item.stock} onClick={() => changeQuantity(item, item.quantity + 1)}>+</button></div></div><div className={styles.linePrice}><span>{money(item.price)} / уп.</span><strong>{money(item.price * item.quantity)}</strong></div></div>
        </div>
      </article>)}
        <aside className={styles.prescription}><strong>{rx ? 'У вашому замовленні є рецептурні препарати' : knownOtc ? 'Рецепт для цих препаратів не потрібен' : 'Рецептурність окремих препаратів потребує уточнення'}</strong><p>{rx ? 'На наступному кроці додайте фото або скан рецепта для кожного рецептурного препарату. Фармацевт перевірить рецепти перед оформленням.' : 'Для рецептурних препаратів перед оформленням потрібна перевірка рецепта фармацевтом.'}</p></aside>
      </div>
      <aside className={styles.summary} aria-label="Підсумок замовлення"><h2>Підсумок замовлення</h2><dl><div><dt>Товари ({items.length} позиції)</dt><dd>{money(total)}</dd></div><div><dt>Упаковок</dt><dd>{packages}</dd></div><div><dt>Доставка</dt><dd>За тарифами перевізника</dd></div></dl><div className={styles.total}><span>До сплати</span><strong>{money(total)}</strong></div>{rx && !prescriptionsApproved(items, prescriptions) ? <Link className={styles.primary} href="/cart/prescription">Перейти до перевірки рецепта</Link> : <Link className={styles.primary} href="/checkout">Перейти до оформлення</Link>}<p>Вартість доставки визначається за тарифами перевізника й оплачується окремо.</p></aside>
    </div>}
  </div>;
}

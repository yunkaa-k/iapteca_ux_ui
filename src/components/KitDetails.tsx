'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { BundleProduct } from '@/lib/types';
import { useCartStore } from '@/lib/store/cartStore';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useHydrated } from '@/lib/useHydrated';
import { money } from '@/lib/product';
import { notifyCartAdded, notifyFavorite } from './ProductFeedback';
import { KitAvailability, KitCard } from './KitCard';
import styles from './Kits.module.css';

export function KitDetails({ kit, recommendations }: { kit: BundleProduct; recommendations: BundleProduct[] }) {
  const [quantity, setQuantity] = useState(1);
  const hydrated = useHydrated();
  const inCart = useCartStore(s => s.items.find(i => i._id === kit._id)?.quantity || 0);
  const favorite = useFavoritesStore(s => s.items.some(i => i.medication._id === kit._id));
  const isFavorite = hydrated && favorite;
  const remaining = Math.max(0, kit.stock - (hydrated ? inCart : 0));
  return <>
    <div className={styles.purchaseLayout}>
      <div className={styles.gallery}><div className={styles.galleryImage}><Image src={kit.slug === 'travel' ? '/images/kits/travel-detail.png' : kit.image!} alt={kit.name} fill sizes="412px" /></div><p>Зовнішній вигляд товару може відрізнятися від зображеного</p></div>
      <section className={styles.purchase} aria-label="Придбати аптечку">
        <div className={styles.status}><KitAvailability stock={kit.stock} /><span className={styles.badge}>{kit.requiresPrescription ? 'Потрібен рецепт' : 'Без рецепта'}</span></div>
        <dl className={styles.specs}><div><dt>Призначення</dt><dd>{kit.purpose}</dd></div><div><dt>Комплектація</dt><dd>{kit.components.length} {kit.components.length === 3 ? 'позиції' : 'позицій'}</dd></div><div><dt>Формат</dt><dd>Готовий набір</dd></div></dl>
        <p>{kit.description}</p>
        <div className={styles.price}><span>Ціна за набір</span><strong>{money(kit.price)}</strong></div>
        <div className={styles.purchaseActions}><div className={styles.quantity}><button type="button" aria-label="Зменшити кількість наборів" disabled={quantity <= 1} onClick={() => setQuantity(q => q - 1)}>−</button><output aria-label="Кількість наборів" aria-live="polite">{quantity}</output><button type="button" aria-label="Збільшити кількість наборів" disabled={quantity >= remaining} onClick={() => setQuantity(q => q + 1)}>+</button></div><button type="button" className={styles.primary} disabled={!remaining || quantity > remaining} onClick={() => { for (let i = 0; i < quantity; i++) useCartStore.getState().addItem(kit); notifyCartAdded(kit.name); }}>Додати набір у кошик</button><button type="button" className={styles.favorite + (isFavorite ? ' ' + styles.selected : '')} aria-label={(isFavorite ? 'Вилучити ' : 'Додати ') + kit.name + (isFavorite ? ' з обраного' : ' до обраного')} aria-pressed={isFavorite} onClick={() => { useFavoritesStore.getState().toggle({ medication: kit }); notifyFavorite(kit.name, isFavorite); }}><Image src={isFavorite ? '/images/home/heart-favorite-filled.svg' : '/images/kits/heart.svg'} alt="" width={22} height={22} /></button></div>
        <dl className={styles.fulfillment}><div><dt>Самовивіз</dt><dd>Вибір аптеки під час оформлення</dd></div><div><dt>Кур’єрська доставка</dt><dd>Доступність і вартість за адресою</dd></div></dl>
      </section>
    </div>
    <section className={styles.contents} aria-labelledby="kit-contents"><h2 id="kit-contents">Склад набору</h2><dl>{kit.components.map((c, index) => <div key={c.medication + index}><dt>{c.name}</dt><dd>{c.quantity} {c.name.includes('рукавички') ? 'пар.' : c.name.includes('Ножиці') || c.name.includes('Термопокривало') || c.name.includes('пов’язка') ? 'шт.' : 'уп.'}</dd></div>)}</dl></section>
    <section className={styles.recommendations} aria-labelledby="other-kits"><h2 id="other-kits">Інші готові аптечки</h2><div className={styles.grid}>{recommendations.map(other => <KitCard key={other._id} kit={other} />)}</div></section>
  </>;
}

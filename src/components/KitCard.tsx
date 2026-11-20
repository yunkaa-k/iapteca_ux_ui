'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { BundleProduct } from '@/lib/types';
import { useCartStore } from '@/lib/store/cartStore';
import { useHydrated } from '@/lib/useHydrated';
import { notifyCartAdded } from './ProductFeedback';
import { money } from '@/lib/product';
import styles from './Kits.module.css';

export function KitCard({ kit }: { kit: BundleProduct }) {
  const hydrated = useHydrated();
  const quantity = useCartStore(s => s.items.find(i => i._id === kit._id)?.quantity || 0);
  return <article className={styles.card}>
    <Link className={styles.cardImage} href={'/kits/' + kit.slug} aria-label={'Переглянути: ' + kit.name}><Image src={kit.image!} alt="" fill sizes="253px" /></Link>
    <div className={styles.cardDetails}><Link className={styles.cardTitle} href={'/kits/' + kit.slug}>{kit.name}</Link><p>{kit.description}</p><KitAvailability stock={kit.stock} /></div>
    <div className={styles.cardFooter}><strong>{money(kit.price)}</strong><button type="button" className={styles.cartIcon} aria-label={'Додати ' + kit.name + ' до кошика'} disabled={kit.stock <= (hydrated ? quantity : 0)} onClick={() => { useCartStore.getState().addItem(kit); notifyCartAdded(kit.name); }}><Image src="/images/home/cart-add.svg" alt="" width={20} height={20} /></button></div>
  </article>;
}

export function KitAvailability({ stock }: { stock: number }) {
  return <span className={styles.availability + (stock <= 0 ? ' ' + styles.unavailable : '')}>{stock > 0 ? <Image src="/images/home/availability-dot.svg" alt="" width={8} height={8} /> : <span className={styles.unavailableDot} />}{stock > 0 ? 'В наявності' : 'Немає в наявності'}</span>;
}

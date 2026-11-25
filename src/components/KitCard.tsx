'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { BundleProduct } from '@/lib/types';
import { useCartStore } from '@/lib/store/cartStore';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useHydrated } from '@/lib/useHydrated';
import { notifyCartAdded, notifyFavorite } from './ProductFeedback';
import { money } from '@/lib/product';
import styles from './Kits.module.css';
import productStyles from './ProductCard.module.css';

export function KitCard({ kit }: { kit: BundleProduct }) {
  const hydrated = useHydrated();
  const quantity = useCartStore(s => s.items.find(i => i._id === kit._id)?.quantity || 0);
  const saved = useFavoritesStore(s => s.items.some(item => item.medication._id === kit._id));
  const isFavorite = hydrated && saved;
  return <article className={styles.card}>
    <Link className={styles.cardImage} href={'/kits/' + kit.slug} aria-label={'Переглянути: ' + kit.name}><Image src={kit.image!} alt="" fill sizes="(min-width: 1280px) 255px, 22vw" /></Link>
    <button type="button" className={`${productStyles.favoriteButton} ${isFavorite ? productStyles.favoriteActive : ''}`} aria-label={isFavorite ? `Вилучити ${kit.name} з обраного` : `Додати ${kit.name} до обраного`} aria-pressed={isFavorite} onClick={() => { useFavoritesStore.getState().toggle({ medication: kit }); notifyFavorite(kit.name, isFavorite); }}>
      <Image src={isFavorite ? '/images/home/heart-favorite-filled.svg' : '/images/home/heart-favorite.svg'} alt="" width={22} height={22} aria-hidden="true" />
    </button>
    <div className={styles.cardDetails}><Link className={styles.cardTitle} href={'/kits/' + kit.slug}>{kit.name}</Link><p>{kit.description}</p><KitAvailability stock={kit.stock} /></div>
    <div className={styles.cardFooter}><strong>{money(kit.price)}</strong><button type="button" className={styles.cartIcon} aria-label={'Додати ' + kit.name + ' до кошика'} disabled={kit.stock <= (hydrated ? quantity : 0)} onClick={() => { useCartStore.getState().addItem(kit); notifyCartAdded(kit.name); }}><Image src="/images/home/cart-add.svg" alt="" width={20} height={20} /></button></div>
  </article>;
}

export function KitAvailability({ stock }: { stock: number }) {
  return <span className={styles.availability + (stock <= 0 ? ' ' + styles.unavailable : '')}>{stock > 0 ? <Image src="/images/home/availability-dot.svg" alt="" width={8} height={8} /> : <span className={styles.unavailableDot} />}{stock > 0 ? 'В наявності' : 'Немає в наявності'}</span>;
}

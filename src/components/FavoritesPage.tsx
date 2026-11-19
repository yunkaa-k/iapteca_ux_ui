'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { ProductCard } from './ProductCard';
import { CartDrawer } from './CartDrawer';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useCartStore } from '@/lib/store/cartStore';
import { useHydrated } from '@/lib/useHydrated';
import type { Medication } from '@/lib/types';
import styles from './FavoritesPage.module.css';

function savedLabel(count: number) {
  const last = count % 10;
  const teen = count % 100 >= 11 && count % 100 <= 14;
  return `Збережено ${count} ${!teen && last === 1 ? 'товар' : !teen && last >= 2 && last <= 4 ? 'товари' : 'товарів'}`;
}

export function FavoritesPage() {
  const hydrated = useHydrated();
  const items = useFavoritesStore((state) => state.items);
  const clear = useFavoritesStore((state) => state.clear);
  const [adding, setAdding] = useState(false);
  const total = items.reduce((sum, item) => sum + item.medication.price, 0);

  async function addAll() {
    if (adding) return;
    setAdding(true);
    try {
      // Recheck current price, deletion and availability before touching the cart.
      const current = await Promise.all(items.map(async ({ medication }) => {
        const response = await fetch(`/api/medications/${medication._id}`, { cache: 'no-store' });
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('availability');
        return await response.json() as Medication;
      }));
      let added = 0;
      for (const medication of current) {
        if (!medication || medication.isDeleted || medication.stock <= 0) continue;
        const cart = useCartStore.getState();
        const quantity = cart.items.find((item) => item._id === medication._id)?.quantity ?? 0;
        if (quantity >= medication.stock) continue;
        cart.addItem(medication);
        added++;
      }
      if (added) toast.success(`Додано до кошика: ${added}`, {
        description: added < items.length ? 'Недоступні товари та позиції з максимальною кількістю пропущено.' : undefined,
      });
      else toast.info('Немає доступних товарів для додавання', { description: 'Перевірте наявність або кількість у кошику.' });
    } catch {
      toast.error('Не вдалося перевірити наявність товарів. Спробуйте ще раз.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link><span aria-hidden="true">/</span><span aria-current="page">Обране</span></nav>
        <h1>Обране</h1>
        {hydrated && items.length > 0 && <p aria-live="polite">{savedLabel(items.length)}</p>}
      </div>

      {!hydrated ? <p className={styles.loading} role="status">Завантаження обраного…</p> : items.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}><Image src="/images/home/heart-header.svg" alt="" width={28} height={28} /></div>
          <h2>В обраному поки немає товарів</h2>
          <p>Натискайте на сердечко біля товару, щоб зберегти його тут.</p>
          <Link className={styles.primaryButton} href="/catalog">Перейти до каталогу</Link>
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            <p>Загальна вартість <strong>{total.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} грн</strong></p>
            <div className={styles.actions}>
              <button className={styles.primaryButton} type="button" disabled={adding} onClick={addAll}>{adding ? 'Перевіряємо наявність…' : 'Додати все до кошика'}</button>
              <button className={styles.secondaryButton} type="button" disabled={adding} onClick={clear}>Очистити обране</button>
            </div>
          </div>
          <div className={styles.grid} aria-label="Збережені товари">
            {items.map((item) => <ProductCard key={item.medication._id} {...item} variant="featured" />)}
          </div>
          <div className={styles.cartLink}><CartDrawer><button className={styles.secondaryButton} type="button">Переглянути кошик</button></CartDrawer></div>
        </>
      )}
    </div>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/authStore';
import { useCartStore } from '@/lib/store/cartStore';
import styles from './Header.module.css';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useHydrated } from '@/lib/useHydrated';

export function Header() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const itemsCount = useCartStore((state) => state.items.reduce((total, item) => total + item.quantity, 0));
  const favoritesCount = useFavoritesStore((state) => state.items.length);
  const hydrated = useHydrated();
  const displayedCount = hydrated ? itemsCount : 0;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brandAndNav}>
          <Link href="/" className={styles.brand} aria-label="iApteca — на головну">
            <Image src="/images/home/brand-emblem.svg" alt="" width={30} height={30} aria-hidden="true" />
            <span>iApteca</span>
          </Link>

          <nav className={styles.navigation} aria-label="Головна навігація">
            <Link href="/catalog" aria-current={pathname === '/catalog' ? 'page' : undefined}>Каталог</Link>
            <Link href="/prescription" aria-current={pathname === '/prescription' ? 'page' : undefined}>Рецепт</Link>
            <Link href="/delivery" aria-current={pathname === '/delivery' ? 'page' : undefined}>Доставка</Link>
            <Link href="/about" aria-current={pathname === '/about' ? 'page' : undefined}>Про нас</Link>
          </nav>
        </div>

        <div className={styles.actions}>
          <Link className={styles.iconButton} href={user ? '/profile' : '/login'} aria-label={user ? 'Особистий кабінет' : 'Увійти або створити акаунт'}>
            <Image src="/images/home/profile.svg" alt="" width={28} height={28} aria-hidden="true" />
          </Link>

          <Link className={styles.iconButton} href="/favorites" aria-label={`Обране, товарів: ${hydrated ? favoritesCount : 0}`}>
            <Image src="/images/home/heart-header.svg" alt="" width={28} height={28} aria-hidden="true" />
          </Link>

          <Link href="/cart" className={styles.cartButton} aria-label={`Кошик, товарів: ${displayedCount}`}>
              <span className={styles.cartIcon} aria-hidden="true"><Image src="/images/home/cart-header-thin.svg" alt="" width={25.53} height={25.51} /></span>
              <span>Кошик</span>
              {displayedCount > 0 && <span className={styles.cartCount} aria-hidden="true">{displayedCount}</span>}
          </Link>

          <button className={styles.languageButton} type="button" aria-label="Мова інтерфейсу: українська">
            <span>UA</span>
            <Image src="/images/home/language-chevron.svg" alt="" width={24} height={24} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

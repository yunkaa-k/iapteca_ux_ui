'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/authStore';
import { useCartStore } from '@/lib/store/cartStore';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CartDrawer } from './CartDrawer';
import { LayoutDashboard, LogOut, User } from 'lucide-react';
import styles from './Header.module.css';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useHydrated } from '@/lib/useHydrated';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
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
            <Link href="/catalog">Каталог</Link>
            <Link href="/catalog">Аналоги</Link>
            <Link href="/checkout">Рецепт</Link>
            <Link href="/#delivery-info">Доставка</Link>
            <Link href="/#about-iapteca">Про нас</Link>
          </nav>
        </div>

        <div className={styles.actions}>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={styles.iconButton} type="button" aria-label="Меню профілю">
                  <Image src="/images/home/profile.svg" alt="" width={28} height={28} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center"><User className="mr-2 h-4 w-4" /> Профіль</Link>
                </DropdownMenuItem>
                {user.role === 'ADMIN' && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center"><LayoutDashboard className="mr-2 h-4 w-4" /> Адмін</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={async () => {
                  try { await logout(); router.refresh(); }
                  catch { toast.error('Не вдалося вийти. Спробуйте ще раз.'); }
                }} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Вийти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link className={styles.iconButton} href="/login" aria-label="Увійти або створити акаунт">
              <Image src="/images/home/profile.svg" alt="" width={28} height={28} aria-hidden="true" />
            </Link>
          )}

          <Link className={styles.iconButton} href="/favorites" aria-label={`Обране, товарів: ${hydrated ? favoritesCount : 0}`}>
            <Image src="/images/home/heart-header.svg" alt="" width={28} height={28} aria-hidden="true" />
          </Link>

          <CartDrawer>
            <button className={styles.cartButton} type="button" aria-label={`Кошик, товарів: ${displayedCount}`}>
              <Image src="/images/home/cart-header.svg" alt="" width={32} height={32} aria-hidden="true" />
              <span>Кошик</span>
              <span className={styles.cartCount} aria-hidden="true">{displayedCount}</span>
            </button>
          </CartDrawer>

          <button className={styles.languageButton} type="button" aria-label="Мова інтерфейсу: українська">
            <span>UA</span>
            <Image src="/images/home/language-chevron.svg" alt="" width={24} height={24} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

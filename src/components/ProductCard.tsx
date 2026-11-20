'use client';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCartStore } from '@/lib/store/cartStore';
import { Medication } from '@/lib/types';
import Image from 'next/image';
import { ShoppingCart, Eye } from 'lucide-react';
import { productHref } from '@/lib/bundles';
import styles from './ProductCard.module.css';
import type { ReactNode } from 'react';
import { useFavoritesStore } from '@/lib/store/favoritesStore';
import { useHydrated } from '@/lib/useHydrated';
import { notifyCartAdded, notifyFavorite } from './ProductFeedback';

type ProductCardProps = {
  medication: Medication;
  variant?: 'default' | 'featured';
  imageOverride?: string;
  summary?: string;
  footerAction?: ReactNode;
};

export function ProductCard({ medication: m, variant = 'default', imageOverride, summary, footerAction }: ProductCardProps) {
  const addItem = useCartStore(s => s.addItem);
  const hydrated = useHydrated();
  const quantityInCart = useCartStore(state => state.items.find(item => item._id === m._id)?.quantity || 0);
  const canAdd = m.stock > (hydrated ? quantityInCart : 0);
  const saved = useFavoritesStore((state) => state.items.some((item) => item.medication._id === m._id));
  const toggleFavorite = useFavoritesStore((state) => state.toggle);
  const isFavorite = hydrated && saved;
  const favoriteButton = (
    <button
      className={`${styles.favoriteButton} ${isFavorite ? styles.favoriteActive : ''}`}
      type="button"
      aria-label={isFavorite ? `Вилучити ${m.name} з обраного` : `Додати ${m.name} до обраного`}
      aria-pressed={isFavorite}
      onClick={() => { toggleFavorite({ medication: m, imageOverride, summary }); notifyFavorite(m.name, isFavorite); }}
    >
      <Image src={isFavorite ? '/images/home/heart-favorite-filled.svg' : '/images/home/heart-favorite.svg'} alt="" width={22} height={22} aria-hidden="true" />
    </button>
  );
  const stock = m.stock <= 0 ? { l: 'Немає', v: 'destructive' } : m.stock < 5 ? { l: 'Закінчується', v: 'outline' } : { l: 'В наявності', v: 'secondary' };

  if (variant === 'featured') {
    const image = imageOverride || m.image;

    return (
      <article className={styles.featuredCard}>
        <Link className={styles.featuredImageLink} href={productHref(m)} aria-label={`Переглянути ${m.kind === 'bundle' ? 'аптечку' : 'препарат'}: ${m.name}`}>
          <span className={m.requiresPrescription === true ? styles.prescriptionMedia : undefined}>
            {m.requiresPrescription === true && <span className={styles.prescriptionBadge}><span aria-hidden="true" />Потрібен рецепт</span>}
            <span className={styles.featuredImage}>
              {image ? <Image src={image} alt="" fill sizes="(min-width: 1280px) 255px, 22vw" /> : null}
            </span>
          </span>
          <span className={styles.srOnly}>Відкрити сторінку {m.kind === 'bundle' ? 'аптечки' : 'препарату'}</span>
        </Link>

        {favoriteButton}

        <Link className={styles.featuredTitle} href={productHref(m)}>{m.name}</Link>
        <p className={styles.featuredSummary}>{summary || m.description}</p>
        <p className={`${styles.featuredAvailability} ${m.stock <= 0 ? styles.featuredOutOfStock : ''}`}>
          <Image src="/images/home/availability-dot.svg" alt="" width={8} height={8} aria-hidden="true" />
          {m.stock > 0 ? 'В наявності' : 'Немає в наявності'}
        </p>
        <div className={styles.featuredFooter}>
          <strong>{m.price} грн</strong>
          {footerAction || <Button
            className={styles.featuredCartButton}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Додати ${m.name} до кошика`}
            disabled={!canAdd}
            onClick={() => {
              addItem(m);
              notifyCartAdded(m.name);
            }}
          >
            <Image src="/images/home/cart-add.svg" alt="" width={20} height={20} aria-hidden="true" />
          </Button>}
        </div>
      </article>
    );
  }

  return (
    <Card className="relative flex flex-col h-full overflow-hidden hover:shadow-md transition-shadow group">
      {favoriteButton}
      <Link href={productHref(m)} className="flex-1">
        <div className="aspect-square relative bg-muted flex items-center justify-center text-xs overflow-hidden">
          {m.image ? <Image src={m.image} alt={m.name} fill className="object-cover group-hover:scale-105 transition-transform" /> : 'Немає фото'}
          <Badge className="absolute top-2 left-2" variant={stock.v as "default" | "destructive" | "outline" | "secondary"}>{stock.l}</Badge>
          <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
             <Eye className="w-8 h-8 text-white drop-shadow-md" />
          </div>
        </div>
        <CardHeader className="p-3 pb-0"><CardTitle className="text-sm line-clamp-1">{m.name}</CardTitle></CardHeader>
        <CardContent className="p-3"><div className="font-bold text-lg">{m.price} ₴</div></CardContent>
      </Link>
      <CardFooter className="p-3 pt-0">
        <Button size="sm" className="w-full" disabled={!canAdd} onClick={() => { addItem(m); notifyCartAdded(m.name); }}>
          <ShoppingCart className="w-4 h-4 mr-2" /> В кошик
        </Button>
      </CardFooter>
    </Card>
  );
}

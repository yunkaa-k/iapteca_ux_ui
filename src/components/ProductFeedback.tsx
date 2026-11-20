'use client';
import Link from 'next/link';
import { toast } from 'sonner';
export function notifyCartAdded(name: string) {
  toast.success('Додано до кошика', { description: <><span>{name}</span><Link href="/cart">Перейти до кошика</Link></> });
}
export function notifyFavorite(name: string, wasSaved: boolean) {
  toast.success(wasSaved ? 'Вилучено з обраного' : 'Додано до обраного', { description: name });
}

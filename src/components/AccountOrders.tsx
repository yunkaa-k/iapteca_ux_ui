'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useHydrated } from '@/lib/useHydrated';
import { money } from '@/lib/product';
import { requestStatus, usePrescriptionRequestStore, type PrescriptionRequest } from '@/lib/store/prescriptionRequestStore';
import type { CartItem } from '@/lib/store/cartStore';
import type { Order } from '@/lib/types';
import styles from './AccountOrders.module.css';
import { OrderProducts as ProductRows } from './OrderProducts';
import { OrderDetails } from './OrderDetails';
import { CancelOrderDialog } from './CancelOrderDialog';
import { orderDisplay } from '@/lib/order-display';
import { orderNumber } from '@/lib/checkout';

export type AccountOrder = Omit<Order, 'items' | 'createdAt'> & { items: CartItem[]; createdAt: string };
const date = (time: number | string) => new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' }).format(new Date(time));
const labels = { reviewing: 'Очікує перевірки рецепта', approved: 'Рецепт підтверджено', 'needs-new-photo': 'Потрібне нове фото', cancelled: 'Скасовано', completed: 'Оформлено' };
const descriptions = {
  reviewing: ['Рецепт перевіряє фармацевт', 'Заявку збережено. Ви можете повернутися до каталогу та робити інші покупки, поки триває перевірка.'],
  approved: ['Рецепт підтверджено', 'Перевірку завершено. Продовжіть оформлення цієї заявки, щоб обрати отримання та спосіб оплати.'],
  'needs-new-photo': ['Потрібне нове фото рецепта', 'На фото нечіткий текст рецепта. Завантажте чіткіше фото або скан, щоб фармацевт міг прочитати дані.'],
  cancelled: ['Заявку скасовано', 'Перевірку рецепта та оформлення цієї заявки припинено.'],
  completed: ['Замовлення оформлено', 'Заявку перенесено до оформлених замовлень.'],
};
const total = (items: CartItem[]) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export function AccountOrders({ ownerId, orders, requestId, orderId }: { ownerId: string; orders: AccountOrder[]; requestId?: string; orderId?: string }) {
  const { requests, settle, cancel } = usePrescriptionRequestStore();
  const hydrated = useHydrated();
  const router = useRouter();
  const mine = requests.filter(r => r.ownerId === ownerId);
  const pending = mine.some(r => r.state === 'active' && Object.values(r.entries).some(e => e.status === 'reviewing'));
  useEffect(() => {
    settle();
    if (!pending) return;
    const timer = setInterval(settle, 250); return () => clearInterval(timer);
  }, [settle, pending]);
  if (!hydrated) return <p role="status">Завантажуємо замовлення…</p>;
  if (orderId) {
    const order = orders.find(item => item._id === orderId && item.user === ownerId);
    return order ? <OrderDetails key={JSON.stringify([order._id, order.status, order.checkout])} order={order} /> : <section className={styles.panel}><h2>Замовлення недоступне</h2><p>У цьому акаунті такого замовлення немає.</p><Link className={styles.back} href="/profile?tab=orders">← До моїх замовлень</Link></section>;
  }
  const request = mine.find(r => r.id === requestId);
  if (requestId && !request) return <section className={styles.panel}><h2>Заявка недоступна</h2><p>У цьому акаунті та поточній браузерній сесії такої заявки немає.</p><Link className={styles.textLink} href="/profile?tab=orders">← До моїх замовлень</Link></section>;
  if (request) {
    const status = requestStatus(request);
    const [title, description] = descriptions[status];
    return <>
      <Link className={styles.back} href="/profile?tab=orders">← До моїх замовлень</Link>
      <section className={styles.panel} aria-label="Деталі заявки">
        <div className={styles.heading}><div><h2>Заявка № {request.number}</h2><p>{date(request.createdAt)}</p></div><span className={`${styles.badge} ${styles[status]}`}>{labels[status]}</span></div>
        <div className={`${styles.explanation} ${styles[status]}`} role="status"><strong>{title}</strong><p>{description}</p></div>
        <h2>Товари в заявці</h2><ProductRows items={request.items} />
        <div className={styles.total}><span>Вартість товарів</span><strong>{money(total(request.items))}</strong></div><p>Отримання та оплату ви оберете під час оформлення.</p>
      </section>
      <section className={styles.panel} aria-label="Рецепти заявки"><h2>Рецепт</h2>
        {request.items.filter(item => item.requiresPrescription).map(item => <div className={styles.file} key={item._id}><span className={styles.receipt}><Image src="/images/prescription/receipt.svg" alt="" width={24} height={24} /></span><div><strong>{request.entries[item._id]?.fileName || 'Рецепт ще не додано'}</strong><p>До препарату: {item.name}</p></div></div>)}
        <p>{status === 'approved' ? 'Підтвердження стосується рецептурного препарату в цій заявці.' : status === 'needs-new-photo' ? 'Нове фото замінить попередній файл. Після завантаження надішліть його на перевірку.' : 'Після перевірки результат з’явиться в «Мої замовлення».'}</p>
        {request.state === 'active' && <Link className={status === 'reviewing' ? styles.secondary : styles.primary} href={status === 'approved' ? `/checkout?request=${request.id}` : status === 'needs-new-photo' ? `/cart/prescription?request=${request.id}&from=details` : '/catalog'}>{status === 'approved' ? 'Продовжити оформлення' : status === 'needs-new-photo' ? 'Замінити фото' : 'Перейти до каталогу'}</Link>}
      </section>
      {request.state === 'active' && <Dialog><DialogTrigger asChild><button className={styles.cancel}>Скасувати заявку</button></DialogTrigger><DialogPortal><DialogOverlay className={styles.overlay} /><DialogPrimitive.Content className={styles.dialog}>
        <DialogTitle className={styles.dialogTitle}>Скасувати заявку?</DialogTitle><DialogDescription className={styles.dialogDescription}>Заявку № {request.number} буде скасовано. Перевірку рецепта та оформлення цієї заявки буде припинено.</DialogDescription>
        <div className={styles.dialogActions}><DialogClose asChild><button className={styles.secondary}>Залишити заявку</button></DialogClose><DialogClose asChild><button className={styles.confirm} onClick={() => { cancel(request.id, ownerId); router.replace('/profile?tab=orders'); }}>Скасувати заявку</button></DialogClose></div>
      </DialogPrimitive.Content></DialogPortal></Dialog>}
    </>;
  }
  const active = mine.filter(r => r.state === 'active');
  return <>
    {active.length > 0 && <section className={styles.requests} aria-label="Заявки на замовлення"><h2>Заявки на замовлення · {active.length}</h2><p>Тут можна перевірити рецепт і продовжити оформлення. Інші покупки можна робити окремо.</p>{active.map(r => <RequestCard request={r} key={r.id} />)}</section>}
    <h2 className={styles.sectionHeading}>Оформлені замовлення · {orders.length}</h2>
    {orders.length === 0 ? <section className={styles.panel}><h2>Замовлень ще немає</h2><p>Оформлені замовлення з’являться тут.</p><Link className={styles.secondary} href="/catalog">Перейти до каталогу</Link></section> : orders.map(order => <OrderCard order={order} key={JSON.stringify([order._id, order.status, order.checkout])} />)}
  </>;
}

const productPlural = new Intl.PluralRules('uk-UA');
const productCount = (count: number) => `${count} ${productPlural.select(count) === 'one' ? 'товар' : productPlural.select(count) === 'few' ? 'товари' : 'товарів'}`;

function OrderCard({ order: initialOrder }: { order: AccountOrder }) {
  const [override, setOverride] = useState<AccountOrder>();
  const order = override || initialOrder;
  const display = orderDisplay(order);
  const receiving = order.checkout?.delivery.method === 'courier' ? 'Кур’єрська доставка' : order.checkout?.delivery.method === 'pickup' ? 'Самовивіз з аптеки' : 'Спосіб отримання не вказано';
  return <section className={styles.orderCard} aria-label={`Замовлення № ${orderNumber(order._id, order.createdAt)}`}>
    <div className={styles.heading}><div><h2>№ {orderNumber(order._id, order.createdAt)}</h2><p>{date(order.createdAt)}</p></div><span className={`${styles.badge} ${styles[display.badgeState]}`} role="status">{display.badge}</span></div>
    <div className={styles.cardSummary}><Thumbnails items={order.items} /><div className={styles.cardText}><strong>{productCount(order.items.length)} · {receiving}</strong><p>{display.payment === 'При отриманні' ? 'Оплата при отриманні' : display.payment}</p></div><strong>{money(order.total)}</strong></div>
    <div className={styles.cardActions}>
      <Link className={styles.textLink} href={'/profile?tab=orders&order=' + encodeURIComponent(order._id)}>Переглянути замовлення<Image src="/images/account/arrow-right.svg" alt="" width={16} height={16} /></Link>
      <CancelOrderDialog order={order} onCancelled={setOverride} className={styles.cancelLink} />
    </div>
  </section>;
}

function Thumbnails({ items }: { items: CartItem[] }) {
  return <div className={styles.thumbnails}>{items.slice(0, 3).map(item => <div key={item._id}>{item.image && <Image src={item.image} alt="" fill sizes="80px" />}</div>)}{items.length > 3 && <span>+{items.length - 3}</span>}</div>;
}
function RequestCard({ request }: { request: PrescriptionRequest }) {
  const status = requestStatus(request);
  return <Link href={`/profile?tab=orders&request=${request.id}`} className={styles.orderCard}>
    <div className={styles.heading}><div><h3>Заявка № {request.number}</h3><p>{date(request.createdAt)}</p></div><span className={`${styles.badge} ${styles[status]}`}>{labels[status]}</span></div>
    <div className={styles.cardSummary}><Thumbnails items={request.items} /><div className={styles.cardText}><strong>{productCount(request.items.length)} · Оформлення не завершено</strong><p>{status === 'approved' ? 'Рецепт підтверджено. Можна продовжити оформлення.' : status === 'needs-new-photo' ? 'Потрібно замінити фото рецепта.' : 'Рецепт надіслано на перевірку.'}</p></div><strong>{money(total(request.items))}</strong></div>
    <span className={styles.textLink}>Переглянути статус<Image src="/images/account/arrow-right.svg" alt="" width={16} height={16} /></span>
  </Link>;
}

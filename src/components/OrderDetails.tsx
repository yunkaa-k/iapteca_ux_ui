'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CancelOrderDialog } from './CancelOrderDialog';
import { OrderProducts } from './OrderProducts';
import { DemoPaymentNotice } from './DemoPaymentNotice';
import type { AccountOrder } from './AccountOrders';
import { money } from '@/lib/product';
import { orderNumber } from '@/lib/checkout';
import { orderDisplay } from '@/lib/order-display';
import styles from './AccountOrders.module.css';

export function OrderDetails({ order: initialOrder }: { order: AccountOrder }) {
  const [override, setOverride] = useState<AccountOrder>();
  const router = useRouter();
  const order = override || initialOrder;
  const display = orderDisplay(order);
  const checkout = order.checkout;
  const number = orderNumber(order._id, order.createdAt);
  return <>
    <Link className={styles.back} href="/profile?tab=orders">← До моїх замовлень</Link>
    <section className={styles.panel + ' ' + styles.orderDetails} aria-label="Деталі замовлення">
      <div className={styles.heading}><div><div className={styles.orderIdentity}><h2>№ {number}</h2><span className={`${styles.badge} ${styles[display.badgeState]}`}>{display.badge}</span></div><p>{new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Kyiv' }).format(new Date(order.createdAt))}</p></div>
        <CancelOrderDialog order={order} onCancelled={setOverride} />
      </div>
      {display.failed && checkout ? <DemoPaymentNotice orderId={order._id} checkout={checkout} onPaid={value => { setOverride({ ...order, checkout: value }); router.refresh(); }} /> : <div className={`${styles.explanation} ${styles[display.state]}`} role="status"><strong>{display.title}</strong><p>{display.description}</p></div>}
      <h2>Товари в замовленні</h2><OrderProducts items={order.items} />
      <div className={styles.orderTotals}><div><span>Доставка</span><span>{checkout ? checkout.delivery.fee ? money(checkout.delivery.fee) : 'Безкоштовно' : 'Не вказано'}</span></div><div><strong>{display.totalLabel}</strong><strong>{money(order.total)}</strong></div></div>
      {(display.refund || display.paid) && <p className={styles.demoCaption}>Демонстраційна оплата та повернення — реальні кошти не переказуються.</p>}
    </section>
    <section className={styles.panel} aria-label="Отримання та оплата"><h2>Отримання та оплата</h2>
      <dl className={styles.receivingDetails}>
        <div><dt>Спосіб отримання</dt><dd>{checkout?.delivery.method === 'courier' ? 'Кур’єрська доставка' : checkout?.delivery.method === 'pickup' ? 'Самовивіз з аптеки' : 'Не вказано'}</dd></div>
        <div><dt>Оплата</dt><dd>{display.payment}</dd></div>
        <div className={styles.fullWidth}><dt>{checkout?.delivery.method === 'courier' ? 'Адреса доставки' : 'Аптека'}</dt><dd>{checkout?.delivery.method === 'courier' ? [checkout.delivery.city, checkout.delivery.address].filter(Boolean).join(', ') || 'Не вказано' : [checkout?.delivery.pharmacyName, checkout?.delivery.address].filter(Boolean).join(', ') || 'Не вказано'}</dd></div>
        <div className={styles.contactRow}><div><dt>Отримувач</dt><dd>{checkout?.contact.name || 'Не вказано'}</dd></div><div><dt>Номер телефону</dt><dd>{checkout?.contact.phone || 'Не вказано'}</dd></div></div>
      </dl>
    </section>
  </>;
}

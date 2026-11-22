'use client';
import { useId, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCheckoutStore } from '@/lib/store/checkoutStore';
import { useAuthStore } from '@/lib/store/authStore';
import { useHydrated } from '@/lib/useHydrated';
import { orderNumber } from '@/lib/checkout';
import { money } from '@/lib/product';
import styles from './OrderResult.module.css';
import { DemoPaymentNotice } from './DemoPaymentNotice';

function Icon({ name }: { name: string }) { return <Image src={'/images/checkout/' + name + '.svg'} alt="" width={24} height={24} />; }
export function OrderResult({ orderId }: { orderId?: string }) {
  const receipt = useCheckoutStore(state => orderId ? state.receipts[orderId] : undefined);
  const { user, isLoading } = useAuthStore();
  const hydrated = useHydrated();
  const [copyState, setCopyState] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string>();
  const productsId = useId();
  if (!hydrated || (receipt?.ownerId && isLoading && !user)) return <div className={styles.page} role="status">Завантажуємо підтвердження…</div>;
  if (!receipt || (receipt.ownerId && receipt.ownerId !== user?._id)) return <div className={styles.page}><section className={styles.receipt}><h1>Підтвердження недоступне</h1><p>У цій браузерній сесії немає даних цього замовлення.</p><Link href="/catalog" className={styles.primary}>Перейти до каталогу</Link></section></div>;
  const { contact, delivery, payment } = receipt.checkout;
  const number = orderNumber(receipt.id, receipt.createdAt);
  const expanded = expandedOrder === receipt.id;
  const displayedItems = expanded ? receipt.items : receipt.items.slice(0, 3);
  const paid = receipt.checkout.paymentMode === 'demo' && receipt.checkout.demoPaymentStatus === 'paid';
  const failed = receipt.checkout.paymentMode === 'demo' && receipt.checkout.demoPaymentStatus === 'failed';
  return <div className={styles.page}><section className={styles.receipt + (paid ? ' ' + styles.paid : '')} aria-labelledby="order-success-title">
    <header className={styles.heading}>{!failed && <span className={styles.success}><Image src="/images/checkout/success.svg" alt="" width={32} height={32} /></span>}<h1 id="order-success-title">{paid ? 'Замовлення оформлено та оплачено!' : failed ? 'Замовлення збережено' : 'Замовлення оформлено!'}</h1><p>{paid ? 'Оплату успішно підтверджено. Перевіряйте статус у «Мої замовлення».' : failed ? 'Оплату ще не підтверджено.' : delivery.method === 'courier' ? 'Ми повідомимо про передачу замовлення кур’єру.' : 'Ми повідомимо, коли замовлення буде готове до отримання.'}</p></header>
    <DemoPaymentNotice orderId={receipt.id} checkout={receipt.checkout} guestToken={receipt.guestPaymentToken} onPaid={checkout => useCheckoutStore.getState().updateReceiptCheckout(receipt.id, checkout)} />
    <div className={styles.digitalReceipt}>
      <table id={productsId} className={styles.table}><thead><tr><th>Товар</th><th>Кількість</th><th>Сума</th></tr></thead><tbody>{displayedItems.map(item => <tr key={item._id}><td><div className={styles.product}><div className={styles.image}>{item.image && <Image src={item.image} alt="" fill sizes="144px" />}</div><div><strong>{item.name}</strong><p>{item.description}</p></div></div></td><td>{item.quantity} шт.</td><td>{money(item.price * item.quantity)}</td></tr>)}</tbody></table>
      {receipt.items.length > 3 && <div className={styles.listControls}><span aria-live="polite">{expanded ? `Усі ${receipt.items.length} товарів` : `Показано 3 з ${receipt.items.length} товарів`}</span><button type="button" aria-expanded={expanded} aria-controls={productsId} onClick={() => setExpandedOrder(expanded ? undefined : receipt.id)}>{expanded ? 'Згорнути' : `Показати ще ${receipt.items.length - 3}`}<Image src={'/images/faq/chevron-' + (expanded ? 'up' : 'down') + '.svg'} alt="" width={16} height={16} aria-hidden="true" /></button></div>}
      {delivery.fee > 0 && <div className={styles.deliveryFee}><span>Доставка</span><span>{money(delivery.fee)}</span></div>}
      <div className={styles.total}><span>{paid ? 'Сплачено' : failed ? 'До сплати' : 'Разом'}</span><strong>{money(receipt.total)}</strong></div>
      <div className={styles.details}>
        <section><h2><Icon name="store" />Отримання</h2><div className={styles.detail}><Icon name="address" /><div><strong>{delivery.method === 'courier' ? 'Кур’єрська доставка' : 'Самовивіз з аптеки'}</strong><p>{delivery.method === 'courier' ? delivery.city + ', ' + delivery.address : delivery.pharmacyName + (delivery.address ? ', ' + delivery.address : '')}</p></div></div><div className={styles.detail}><Icon name="payment" /><div><strong>{paid ? 'Оплачено онлайн' : payment === 'online' ? 'Онлайн — повторна спроба оплати' : payment === 'on-receipt' ? 'При отриманні' : 'Онлайн після підтвердження'}</strong><p>{paid ? 'Оплату карткою успішно підтверджено.' : payment === 'online' ? 'Оплату ще не підтверджено.' : payment === 'online-after-confirmation' ? 'Посилання для оплати після перевірки' : delivery.method === 'courier' ? 'Оплата під час доставки' : 'Готівкою або карткою в аптеці'}</p></div></div></section>
        <section><h2><span className={styles.profileIcon}><Image src="/images/account/profile.svg" width={22} height={22} alt="" /></span>Контактні дані</h2><div className={styles.detail}><span className={styles.profileIcon}><Image src="/images/account/profile.svg" width={22} height={22} alt="" /></span><div><strong>{contact.name}</strong><p>Отримувач замовлення</p></div></div><div className={styles.detail}><Icon name="phone" /><div><strong>{contact.phone}</strong><p>Номер телефону</p></div></div></section>
      </div>
      <footer className={styles.footer}><div className={styles.number}><Image src="/images/prescription/receipt.svg" width={24} height={24} alt="" /><div><p>Номер замовлення</p><div>{number}<button aria-label="Копіювати номер замовлення" onClick={async () => { try { await navigator.clipboard.writeText(number); setCopyState('Номер скопійовано'); } catch { setCopyState('Не вдалося скопіювати номер. Виділіть і скопіюйте його вручну.'); } }}><Image src="/images/checkout/copy.svg" width={16} height={16} alt="" /></button></div></div></div><nav className={styles.actions} aria-label="Подальші дії">{paid ? <><Link href="/profile?tab=orders" className={styles.primary}>До моїх замовлень</Link><Link href="/catalog" className={styles.secondary}>Перейти до каталогу</Link></> : <><Link href="/catalog" className={styles.primary}>Перейти до каталогу</Link><Link href="/profile?tab=orders" className={styles.secondary}>Мої замовлення</Link></>}</nav></footer>
      {copyState && <p role="status" className={styles.copyState}>{copyState}</p>}
    </div>
  </section></div>;
}

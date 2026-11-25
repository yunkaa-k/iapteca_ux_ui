import Image from 'next/image';
import type { CartItem } from '@/lib/store/cartStore';
import { money } from '@/lib/product';
import styles from './AccountOrders.module.css';

export function OrderProducts({ items }: { items: CartItem[] }) {
  return <div className={styles.products}>{items.map(item => <div className={styles.product} key={item._id}>
    <div className={styles.productImage}>{item.image && <Image src={item.image} alt="" fill sizes="104px" />}</div>
    <div className={styles.productText}><strong>{item.name}</strong><p>{item.description}</p></div><span className={styles.quantity}>{item.quantity} шт.</span><strong className={styles.price}>{money(item.price * item.quantity)}</strong>
  </div>)}</div>;
}

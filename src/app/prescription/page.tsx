import Image from 'next/image';
import Link from 'next/link';
import styles from '@/components/Prescription.module.css';

const steps = [
  ['Оберіть препарат', 'Знайдіть потрібний товар у каталозі. Позначка «Потрібен рецепт» підкаже, що для покупки необхідна перевірка.'],
  ['Додайте товар до кошика', 'Перевірте препарати та їх кількість. У кошику з рецептурним товаром натисніть «Перейти до перевірки рецепта».'],
  ['Прикріпіть фото рецепта', 'Завантажте чітке фото або скан у формі перевірки. Рецепт має бути повністю видимим, а текст — читабельним.'],
  ['Дочекайтеся перевірки', 'Статус збережеться в «Мої замовлення». Якщо фото нечитабельне, ви зможете замінити його та надіслати повторно.'],
  ['Оформіть замовлення', 'Після підтвердження рецепта перейдіть до оформлення: заповніть контактні дані, оберіть отримання й спосіб оплати.'],
];

export const metadata = { title: 'Як придбати ліки за рецептом — iApteca' };
export default function PrescriptionGuidePage() {
  return <div className={`${styles.page} ${styles.guide}`}>
    <div className={styles.introduction}>
      <nav className={styles.breadcrumbs} aria-label="Навігаційний шлях"><Link href="/">Головна</Link> / Рецепт</nav>
      <h1>Як придбати ліки за рецептом</h1>
      <p>Від вибору препарату до оформлення замовлення — п’ять простих кроків.</p>
    </div>
    <div className={styles.guideLayout}>
      <ol className={styles.steps}>{steps.map(([title, description], index) => <li className={styles.step} key={title}>
        <span className={styles.number} aria-hidden="true">{index + 1}</span><div><h2>{title}</h2><p>{description}</p></div>
      </li>)}</ol>
      <aside className={styles.guidance} aria-labelledby="before-check-title">
        <span className={styles.receiptIcon}><Image src="/images/prescription/receipt.svg" alt="" width={24} height={24} /></span>
        <h2 id="before-check-title">Перед перевіркою</h2>
        <div className={styles.checklist}><p>Зробіть фото при достатньому освітленні, без відблисків і розмиття.</p><p>Переконайтеся, що краї документа та всі необхідні дані потрапили в кадр.</p></div>
        <div className={styles.hint}><h3>Рецепт додається в кошику</h3><p>Спочатку оберіть препарат — тоді ми покажемо, для якого товару потрібен рецепт.</p></div>
        <Link href="/catalog" className={styles.primary}>Перейти до каталогу</Link>
      </aside>
    </div>
  </div>;
}

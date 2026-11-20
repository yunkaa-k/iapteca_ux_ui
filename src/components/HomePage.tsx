import Image from 'next/image';
import Link from 'next/link';
import { ProductCard } from '@/components/ProductCard';
import type { Medication, BundleProduct } from '@/lib/types';
import styles from './HomePage.module.css';

export type FeaturedMedication = {
  medication: Medication;
  imageOverride?: string;
  summary: string;
};

const popularSearches = ['ібупрофен', 'парацетамол', 'амоксицилін', 'дексаметазон', 'бісептол'];



const categories = [
  { label: <>Застуда<br />та грип</>, query: 'Застуда та грип', image: '/images/home/category-cold.png', tone: 'cold' },
  { label: <>Біль і<br />запалення</>, query: 'Біль і запалення', image: '/images/home/category-pain.png', tone: 'pain' },
  { label: <>Шлунково-<br />кишковий тракт</>, query: 'Шлунково-кишковий тракт', image: '/images/home/category-digestive.png', tone: 'digestive' },
  { label: <>Серцево-<br />судинні</>, query: 'Серцево-судинні', image: '/images/home/category-cardiovascular.png', tone: 'cardiovascular' },
  { label: <>Вітаміни<br />та мінерали</>, query: 'Вітаміни та мінерали', image: '/images/home/category-vitamins.png', tone: 'vitamins' },
  { label: <>Дерматологія<br />та догляд</>, query: 'Дерматологія та догляд', image: '/images/home/category-dermatology.png', tone: 'dermatology' },
];

const benefits = [
  { title: 'Швидка доставка', detail: 'по всій Україні', image: '/images/home/service-delivery.svg' },
  { title: 'Сертифіковані препарати', detail: 'Перевірена якість', image: '/images/home/service-certified.svg' },
  { title: 'Вигідні ціни', detail: 'та аналоги', image: '/images/home/service-discount.svg' },
  { title: 'Професійна консультація', detail: 'Допоможемо з вибором', image: '/images/home/service-support.svg' },
];

function SectionHeading({ title, href, linkText, id }: { title: string; href: string; linkText: string; id: string }) {
  return (
    <div className={styles.sectionHeading}>
      <h2 id={id}>{title}</h2>
      <Link className={styles.sectionLink} href={href}>
        {linkText}
        <Image src="/images/home/arrow-right.svg" alt="" width={16} height={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function HomePage({ featuredMedications, kits = [] }: { featuredMedications: FeaturedMedication[]; kits?: BundleProduct[] }) {
  return (
    <div className={styles.homePage}>
      <section className={styles.hero} aria-labelledby="home-heading">
        <div className={styles.heroVisual} aria-hidden="true">
          <Image src="/images/home/hero.png" alt="" fill priority sizes="(min-width: 1440px) 900px, 62vw" />
        </div>
        <div className={styles.heroFade} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroContent}>
            <div className={styles.heroIntro}>
              <h1 id="home-heading" className={styles.heroTitle}>
                <span>Ліки поруч,</span>
                <span>коли вони потрібні</span>
              </h1>
              <p className={styles.heroDescription}>
                <span>Швидкий пошук, вигідні аналоги та зручне отримання —</span>
                <span>все для вашого здоров’я.</span>
              </p>
            </div>

            <div className={styles.heroSearchGroup}>
              <form className={styles.searchForm} action="/catalog" method="get" role="search">
                <Image src="/images/home/search.svg" alt="" width={20} height={20} aria-hidden="true" />
                <label className="sr-only" htmlFor="home-search">Пошук препаратів</label>
                <input
                  id="home-search"
                  name="search"
                  type="search"
                  placeholder="Шукайте за симптомами, назвою чи діючою речовиною..."
                />
                <button className={styles.searchButton} type="submit">Знайти</button>
              </form>
              <div className={styles.popularSearches}>
                <span>Популярні запити:</span>
                <div className={styles.searchChips}>
                  {popularSearches.map((query) => (
                    <Link key={query} href={`/catalog?search=${encodeURIComponent(query)}`}>
                      {query}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.content}>
        <section className={styles.section} id="popular-products" aria-labelledby="popular-products-heading">
          <SectionHeading id="popular-products-heading" title="Популярні препарати" href="/catalog" linkText="Усі препарати" />
          {featuredMedications.length > 0 ? (
            <div className={styles.productGrid}>
              {featuredMedications.map((item) => (
                <ProductCard
                  key={item.medication._id}
                  medication={item.medication}
                  variant="featured"
                  imageOverride={item.imageOverride}
                  summary={item.summary}
                />
              ))}
            </div>
          ) : (
            <div className={styles.emptyProducts}>
              <p>Популярні препарати з’являться після наповнення каталогу.</p>
              <Link href="/catalog">Перейти до каталогу</Link>
            </div>
          )}
        </section>

        <section className={styles.section} id="featured-kits" aria-labelledby="featured-kits-heading">
          <SectionHeading id="featured-kits-heading" title="Готові аптечки" href="/kits" linkText="Усі аптечки" />
          <div className={styles.kitGrid}>
            {kits.map((kit) => (
              <article className={styles.kitCard} key={kit.slug}>
                <Link className={styles.kitImageLink} href={`/kits/${kit.slug}`} aria-label={`Переглянути: ${kit.name}`} prefetch={false}>
                  <Image src={kit.image!} alt={kit.name} fill sizes="(min-width: 1280px) 255px, 22vw" />
                </Link>
                <div className={styles.kitDetails}>
                  <Link className={styles.kitName} href={`/kits/${kit.slug}`} prefetch={false}>{kit.name}</Link>
                  <p className={styles.kitSummary}>{kit.description}</p>
                  <p className={styles.availability}><Image src="/images/home/availability-dot.svg" alt="" width={8} height={8} aria-hidden="true" />{kit.stock > 0 ? 'В наявності' : 'Немає в наявності'}</p>
                </div>
                <div className={styles.kitFooter}>
                  <strong>{kit.price} грн</strong>
                  <Link className={styles.kitAction} href={`/kits/${kit.slug}`} aria-label={`Переглянути аптечку: ${kit.name}`} prefetch={false}>
                    <Image src="/images/home/cart-add.svg" alt="" width={20} height={20} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="popular-categories-heading">
          <div className={styles.sectionHeading}>
            <h2 id="popular-categories-heading">Популярні категорії</h2>
          </div>
          <div className={styles.categoryGrid}>
            {categories.map((category) => (
              <Link
                className={`${styles.categoryCard} ${styles[category.tone]}`}
                href={`/catalog?category=${encodeURIComponent(category.query)}`}
                key={category.query}
              >
                <Image src={category.image} alt="" width={40} height={40} aria-hidden="true" />
                <span>{category.label}</span>
                <Image className={styles.categoryArrow} src="/images/home/category-arrow.svg" alt="" width={16} height={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.benefitsSection}`} id="delivery-info" aria-labelledby="benefits-heading">
          <div className={styles.sectionHeading}>
            <h2 id="benefits-heading">Чому обирають iApteca</h2>
          </div>
          <div className={styles.benefitStrip}>
            {benefits.map((benefit) => (
              <div className={styles.benefit} key={benefit.title}>
                <span className={styles.benefitIcon}>
                  <Image src={benefit.image} alt="" width={28} height={28} aria-hidden="true" />
                </span>
                <span className={styles.benefitText}>
                  <strong>{benefit.title}</strong>
                  <span>{benefit.detail}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

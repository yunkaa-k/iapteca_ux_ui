import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import type { PipelineStage } from 'mongoose';
import { connectDB, MedicationModel, CategoryModel } from '@/lib/db';
import { ProductCard } from '@/components/ProductCard';
import { SearchAndFilters } from '@/components/SearchAndFilters';
import { Pagination } from '@/components/Pagination';
import { catalogQuery, facetKeys, toSearchParams, type CatalogFacets, type CatalogParams } from '@/lib/catalog';
import type { Category, Medication } from '@/lib/types';
import styles from '@/components/Catalog.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Каталог товарів | iApteca' };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<CatalogParams> }) {
  const params = toSearchParams(await searchParams);
  const query = catalogQuery(params);
  await connectDB();

  const facetPipeline: Record<string, PipelineStage.FacetPipelineStage[]> = {};
  for (const key of facetKeys) facetPipeline[key] = [{ $match: { [key]: { $ne: null } } }, { $group: { _id: `$${key}` } }, { $sort: { _id: 1 } }];
  facetPipeline.forms = [{ $group: { _id: '$dosageForm', count: { $sum: 1 } } }];
  facetPipeline.priceBounds = [{ $group: { _id: null, max: { $max: '$price' } } }];

  const [total, categories, aggregated] = await Promise.all([
    MedicationModel.countDocuments(query.filter),
    CategoryModel.find().sort({ name: 1 }).lean(),
    MedicationModel.aggregate([{ $match: { isDeleted: { $ne: true } } }, { $facet: facetPipeline }]),
  ]);
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.limit)));
  const medications = await MedicationModel.find(query.filter).sort(query.sort).skip((page - 1) * query.limit).limit(query.limit).lean();
  const raw = (aggregated[0] || {}) as Record<string, { _id: string | number | null; count?: number; max?: number }[]>;
  const values = Object.fromEntries(facetKeys.map((key) => [key, (raw[key] || []).filter((row) => typeof row._id === 'string' || typeof row._id === 'number').map((row) => String(row._id)).filter(Boolean)]));
  const facets = {
    ...values,
    forms: Object.fromEntries((raw.forms || []).filter((row) => typeof row._id === 'string').map((row) => [row._id, row.count || 0])),
    maxPrice: Math.max(10000, Math.ceil((raw.priceBounds?.[0]?.max || 0) / 100) * 100),
  } as CatalogFacets;

  return (
    <Suspense>
      <SearchAndFilters facets={facets} categories={JSON.parse(JSON.stringify(categories)) as Category[]} total={total}>
        {medications.length ? (
          <>
            <div className={styles.products}>
              {medications.map((medication) => <ProductCard key={String(medication._id)} medication={JSON.parse(JSON.stringify(medication)) as Medication} variant="featured" />)}
            </div>
            <Pagination currentPage={page} totalPages={Math.ceil(total / query.limit)} />
          </>
        ) : (
          <div className={styles.empty} role="status">
            <span className={styles.emptyIcon}><Image src="/images/home/search.svg" alt="" width={20} height={20} /></span>
            <h2>{query.search ? 'За запитом нічого не знайдено' : query.hasFilters ? 'За вибраними фільтрами товарів не знайдено' : 'У каталозі поки немає товарів'}</h2>
            <p>{query.search ? 'Перевірте написання або спробуйте інший запит.' : query.hasFilters ? 'Скиньте фільтри або оберіть іншу лікарську форму.' : 'Товари з’являться після наповнення каталогу.'}</p>
            {(query.search || query.hasFilters) && <Link className={styles.primaryButton} href={query.hasFilters && query.search ? `/catalog?search=${encodeURIComponent(query.search)}` : '/catalog'}>{query.hasFilters ? 'Скинути фільтри' : 'Переглянути всі товари'}</Link>}
          </div>
        )}
        {medications.length > 0 && <p className={styles.disclaimer}>Перед застосуванням ознайомтеся з інструкцією та проконсультуйтеся з лікарем або фармацевтом.</p>}
      </SearchAndFilters>
    </Suspense>
  );
}

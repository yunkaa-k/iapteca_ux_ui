import { getBundles } from '@/lib/bundle-data';
import { HomePage, type FeaturedMedication } from '@/components/HomePage';
import { connectDB, MedicationModel } from '@/lib/db';
import type { Medication } from '@/lib/types';

export const dynamic = 'force-dynamic';

const featuredProducts = [
  { match: /nurofen|нурофен/i, image: '/images/home/product-nurofen-200.png', summary: '200 мг · 24 табл.' },
  { match: /ibuprofen.?darn|ібупрофен.?дарн|ибупрофен.?дарн/i, image: '/images/home/product-ibuprofen-darnytsia.png', summary: '200 мг · 20 табл.' },
  { match: /paracetamol|парацетамол/i, image: '/images/home/product-paracetamol-500.png', summary: '500 мг · 10 табл.' },
  { match: /citramon.?darn|цитрамон.?дарн/i, image: '/images/home/product-citramon-darnytsia.png', summary: '10 табл.' },
];

export default async function Home() {
  await connectDB();

  const names = featuredProducts.map(({ match }) => ({ name: { $regex: match } }));
  const matching = await MedicationModel.find({ isDeleted: { $ne: true }, $or: names }).lean();
  const fallback = await MedicationModel.find({ isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();

  const selected: Array<{
    medication: (typeof matching)[number];
    imageOverride?: string;
    summary: string;
  }> = featuredProducts.flatMap((spec) => {
    const medication = matching.find((item) => spec.match.test(item.name));
    return medication ? [{ medication, imageOverride: spec.image, summary: spec.summary }] : [];
  });

  for (const medication of fallback) {
    if (selected.length >= 4) break;
    if (selected.some((item) => item.medication._id.toString() === medication._id.toString())) continue;
    selected.push({
      medication,
      summary: medication.description,
    });
  }

  const serializable = selected.map((item) => ({
    ...item,
    medication: JSON.parse(JSON.stringify(item.medication)) as Medication,
  })) satisfies FeaturedMedication[];

  return <HomePage featuredMedications={serializable} kits={(await getBundles()).slice(0, 4)} />;
}

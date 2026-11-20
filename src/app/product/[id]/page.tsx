import { connectDB, MedicationModel } from '@/lib/db';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ProductDetails } from '@/components/ProductDetails';
import type { Medication } from '@/lib/types';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';
const getMedication = cache(async (id: string): Promise<Medication | null> => {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  await connectDB();
  const med = await MedicationModel.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
  return med ? JSON.parse(JSON.stringify(med)) : null;
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const med = await getMedication((await params).id);
  if (!med) return { title: 'Препарат не знайдено' };
  return {
    title: `${med.name} | iApteca`,
    description: med.description.slice(0, 160),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const med = await getMedication((await params).id);
  if (!med) notFound();
  let alternatives: Medication[] = [];
  if (med.activeIngredient?.trim()) {
    const ingredient = med.activeIngredient.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = await MedicationModel.find({ _id: { $ne: med._id }, isDeleted: { $ne: true }, activeIngredient: { $regex: `^${ingredient}$`, $options: 'i' }, ...(med.stock <= 0 ? { stock: { $gt: 0 } } : {}) }).sort({ price: 1, _id: 1 }).limit(3).lean();
    alternatives = JSON.parse(JSON.stringify(matches));
  }
  return <ProductDetails medication={med} alternatives={alternatives} />;
}

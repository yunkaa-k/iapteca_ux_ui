import { BundleModel, MedicationModel, connectDB } from './db';
import { bundleProduct } from './bundles';
import type { Bundle, Medication } from './types';

export async function getBundles() {
  await connectDB();
  const bundles = await BundleModel.find({ isDeleted: { $ne: true } }).sort({ createdAt: 1, _id: 1 }).lean() as unknown as Bundle[];
  const ids = [...new Set(bundles.flatMap(b => b.components.map(c => c.medication)))];
  const medications = ids.length ? await MedicationModel.find({ _id: { $in: ids } }).lean() as unknown as Medication[] : [];
  return bundles.map(bundle => bundleProduct(JSON.parse(JSON.stringify(bundle)), medications));
}

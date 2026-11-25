import { NextResponse } from 'next/server';
import { connectDB, MedicationModel } from '@/lib/db';
import { catalogQuery } from '@/lib/catalog';
import { findSpellingCorrection, type SearchProduct } from '@/lib/searchSuggestions';

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 150);
  if (query.length < 2) return NextResponse.json({ products: [], ingredients: [], correction: null }, { headers });
  try {
    await connectDB();
    const { filter } = catalogQuery(new URLSearchParams({ search: query }));
    const rows = await MedicationModel.find(filter).select('_id name description price stock category manufacturer image activeIngredient dosage packSize requiresPrescription').sort({ stock: -1, name: 1, _id: 1 }).limit(5).lean();
    const products = rows.map((row) => ({ _id: String(row._id), name: row.name, description: row.description, price: row.price, stock: row.stock, category: row.category, manufacturer: row.manufacturer, image: row.image, activeIngredient: row.activeIngredient, dosage: row.dosage, packSize: row.packSize, requiresPrescription: row.requiresPrescription })) as SearchProduct[];
    const ingredients = [...new Set(products.map((product) => product.activeIngredient).filter((value): value is string => !!value && value.toLocaleLowerCase('uk-UA').includes(query.toLocaleLowerCase('uk-UA'))))].slice(0, 5);
    let correction: string | null = null;
    if (!products.length && query.length <= 32) {
      // The local teaching catalog is small. Keep the dictionary lookup bounded;
      // do not derive corrections from deleted products or an external drug list.
      const dictionary = await MedicationModel.find({ isDeleted: { $ne: true }, inventoryOnly: { $ne: true } }).select('name activeIngredient').sort({ _id: 1 }).limit(300).lean();
      correction = findSpellingCorrection(query, dictionary.flatMap((item) => [String(item.name || ''), String(item.activeIngredient || '')]));
    }
    return NextResponse.json({ products, ingredients, correction }, { headers });
  } catch {
    return NextResponse.json({ error: 'Не вдалося завантажити підказки.' }, { status: 503, headers });
  }
}

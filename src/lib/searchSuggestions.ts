export interface SearchProduct {
  _id: string;
  name: string;
  price: number;
  stock: number;
  image?: string;
  activeIngredient?: string;
}

export interface SearchSuggestions {
  products: SearchProduct[];
  ingredients: string[];
  correction: string | null;
}

export const popularQueries = ['ібупрофен', 'парацетамол', 'амокислав', 'дексаметазон', 'бісептол'];
export const symptomCategories = [
  { title: 'Біль', detail: 'Голова, зуби, м’язи', category: 'Біль і запалення' },
  { title: 'Застуда та грип', detail: 'Температура, кашель', category: 'Застуда та грип' },
  { title: 'Травлення', detail: 'Шлунок, кишечник', category: 'Шлунково-кишковий тракт' },
  { title: 'Серце і тиск', detail: 'Серцево-судинні', category: 'Серцево-судинні' },
];

const normalized = (text: string) => text.normalize('NFKC').toLocaleLowerCase('uk-UA').trim();

// Optimal-string-alignment distance also counts a swapped adjacent pair as one typo.
export function spellingDistance(a: string, b: string) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

export function findSpellingCorrection(query: string, source: string[]): string | null {
  const word = normalized(query);
  if (!/^[\p{L}]{3,32}$/u.test(word)) return null;
  const candidates = new Set(source.flatMap((value) => normalized(value).match(/[\p{L}]{3,32}/gu) || []));
  if (candidates.has(word)) return null;
  const threshold = word.length >= 7 ? 2 : 1;
  let best: string | null = null;
  let distance = threshold + 1;
  let ambiguous = false;
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - word.length) > threshold) continue;
    const next = spellingDistance(word, candidate);
    if (next < distance) { best = candidate; distance = next; ambiguous = false; }
    else if (next === distance && candidate !== best) ambiguous = true;
  }
  return best && distance <= threshold && !ambiguous ? best : null;
}

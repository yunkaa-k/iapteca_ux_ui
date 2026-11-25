import type { Medication } from './types';
import catalogFacts from './data/catalog-facts.json';

// Exact catalog matches and verified sources; never infer medical details from a partial name.
export function productInstruction(medication: Medication) {
  if (medication.kind === 'bundle' || !Object.hasOwn(catalogFacts, medication.name)) return undefined;
  const instruction = catalogFacts[medication.name as keyof typeof catalogFacts];
  if (instruction.facts.dosage !== medication.dosage) return undefined;
  return { url: instruction.sourceUrl, summary: instruction.summary };
}

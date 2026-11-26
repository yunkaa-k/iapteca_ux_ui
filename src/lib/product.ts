import type { Medication } from './types';
import { dosageForms } from './catalog';
export const money = (value: number) => `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 }).format(value)} грн`;
export const unitPrice = (med: Medication, minimumFractionDigits: 0 | 2 = 0) => med.packSize && med.packSize > 0 ? `${new Intl.NumberFormat('uk-UA', { minimumFractionDigits, maximumFractionDigits: 2 }).format(med.price / med.packSize)} грн / ${med.dosageForm === 'tablets' ? 'табл.' : med.dosageForm === 'capsules' ? 'капс.' : 'од.'}` : 'Не вказано';
export const prescriptionLabel = (med: Medication) => med.requiresPrescription === true ? 'Потрібен рецепт' : med.requiresPrescription === false ? 'Без рецепта' : 'Не вказано';
export function productFacts(med: Medication): [string, string][] {
  return [['Діючі речовини', med.activeIngredient || 'Не вказано'], ['Дозування', med.dosage || 'Не вказано'], ['Лікарська форма', med.dosageFormDetails || dosageForms.find(form => form.value === med.dosageForm)?.label || 'Не вказано'], ['Кількість в упаковці', med.packageDescription || (med.packSize ? String(med.packSize) : 'Не вказано')], ['Виробник', med.manufacturer || 'Не вказано'], ['Країна виробництва', med.country || 'Не вказано'], ['Категорія відпуску', prescriptionLabel(med)], ['Вікові та вагові обмеження', med.ageGroup || 'Не вказано'], ['Код АТХ', med.atcCode || 'Не вказано']];
}

export type MealId = 'colazione' | 'spuntino' | 'pranzo' | 'merenda' | 'cena'

export const MEALS: { id: MealId; label: string; icon: string }[] = [
  { id: 'colazione', label: 'Colazione', icon: '☕' },
  { id: 'spuntino', label: 'Spuntino', icon: '🍎' },
  { id: 'pranzo', label: 'Pranzo', icon: '🍝' },
  { id: 'merenda', label: 'Merenda', icon: '🥜' },
  { id: 'cena', label: 'Cena', icon: '🍽️' },
]

export interface Macros {
  kcal: number
  p: number
  c: number
  f: number
}

/** Alimento in rubrica ("I miei alimenti"). I valori sono sempre per 100 g. */
export interface Food {
  id?: number
  name: string
  brand?: string
  barcode?: string
  per100: Macros
  /** grammi della porzione abituale (ultima usata) */
  portion: number
  useCount: number
  lastUsed: number
}

/** Una riga del diario. I valori sono i totali già calcolati per i grammi mangiati. */
export interface Entry extends Macros {
  id?: number
  date: string
  meal: MealId
  name: string
  grams: number
  foodId?: number
  /** presente se la riga nasce dalla spunta di un elemento della dieta */
  dietKey?: string
  createdAt: number
}

export interface WeightLog {
  date: string
  kg: number
}

export interface DietAlt extends Macros {
  alimento: string
  g: number
}

export interface DietItem extends DietAlt {
  alternative?: DietAlt[]
}

export interface Diet {
  nome: string
  giorni: Record<string, Partial<Record<MealId, DietItem[]>>>
}

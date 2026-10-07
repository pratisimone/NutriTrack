import Dexie, { type EntityTable } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Entry, Food, Macros, WeightLog } from './types'

interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('nutritrack') as Dexie & {
  foods: EntityTable<Food, 'id'>
  entries: EntityTable<Entry, 'id'>
  weights: EntityTable<WeightLog, 'date'>
  settings: EntityTable<Setting, 'key'>
}

db.version(1).stores({
  foods: '++id, name, barcode, lastUsed',
  entries: '++id, date, dietKey',
  weights: 'date',
  settings: 'key',
})

export const DEFAULT_TARGETS: Macros = { kcal: 2000, p: 120, c: 220, f: 65 }

/** undefined = in caricamento, null = non impostato */
export function useSetting<T>(key: string): T | null | undefined {
  return useLiveQuery(async () => ((await db.settings.get(key))?.value as T | undefined) ?? null, [key])
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value })
}

export function useTargets(): Macros {
  return useSetting<Macros>('targets') ?? DEFAULT_TARGETS
}

import { db } from '../db'
import type { Food, Macros } from '../types'
import { saveJsonFile } from './backup'
import { today } from './dates'
import { kcalFromMacros } from './macros'

export const FOODS_EXAMPLE = `{
  "app": "nutritrack-foods",
  "version": 1,
  "alimenti": [
    { "nome": "Petto di pollo", "kcal": 110, "p": 23, "c": 0, "f": 1.5, "porzione": 150 },
    { "nome": "Riso basmati (crudo)", "kcal": 350, "p": 8.5, "c": 77, "f": 0.8, "porzione": 80 },
    { "nome": "Barretta proteica", "marca": "Esempio", "barcode": "8000000000000", "kcal": 360, "p": 33, "c": 30, "f": 11, "porzione": 45 }
  ]
}`

export const FOODS_PROMPT = `Crea un JSON con la lista degli alimenti che ti indico (oppure quelli presenti nella dieta che ti allego), con i valori nutrizionali, usando questa struttura e restituendomi SOLO il JSON.

Regole:
- Il file ha "app": "nutritrack-foods", "version": 1 e una lista "alimenti".
- Ogni alimento ha: "nome", "kcal", "p" (proteine g), "c" (carboidrati g), "f" (grassi g).
- Tutti i valori sono riferiti a 100 g di prodotto (NON alla porzione).
- "porzione" (opzionale) è la quantità in grammi che di solito mangio.
- "marca" e "barcode" sono opzionali.
- Se non conosci i valori, stimali con le tabelle CREA / USDA e dimmi quali sono stime.
- Specifica "crudo" o "cotto" nel nome quando fa differenza.

Esempio:
${FOODS_EXAMPLE}`

export interface ParsedFood {
  name: string
  brand?: string
  barcode?: string
  per100: Macros
  /** assente se il file non la indica: in aggiornamento resta quella già salvata */
  portion?: number
}

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(',', '.'))
  return NaN
}

const optStr = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() || undefined : undefined)

export function parseFoods(text: string): { foods: ParsedFood[]; errors: string[] } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { foods: [], errors: [`JSON non valido: ${(e as Error).message}`] }
  }
  const list = Array.isArray(raw) ? raw : isObj(raw) ? raw.alimenti : undefined
  if (!Array.isArray(list)) return { foods: [], errors: ['Manca la lista "alimenti"'] }

  const errors: string[] = []
  const foods: ParsedFood[] = []
  list.forEach((it, i) => {
    const where = `alimento ${i + 1}`
    if (!isObj(it)) {
      errors.push(`${where}: non è un oggetto`)
      return
    }
    const name = optStr(it.nome)
    if (!name) {
      errors.push(`${where}: manca "nome"`)
      return
    }
    const label = `${where} (${name})`
    const p = it.p === undefined ? 0 : toNum(it.p)
    const c = it.c === undefined ? 0 : toNum(it.c)
    const f = it.f === undefined ? 0 : toNum(it.f)
    if (![p, c, f].every((n) => Number.isFinite(n) && n >= 0)) {
      errors.push(`${label}: "p", "c", "f" devono essere numeri`)
      return
    }
    let kcal = it.kcal === undefined ? NaN : toNum(it.kcal)
    if (!Number.isFinite(kcal)) {
      if (it.kcal !== undefined) {
        errors.push(`${label}: "kcal" non valido`)
        return
      }
      if (p + c + f === 0) {
        errors.push(`${label}: servono almeno "kcal" o i macro`)
        return
      }
      kcal = kcalFromMacros({ kcal: 0, p, c, f })
    }
    if (kcal < 0) {
      errors.push(`${label}: "kcal" non può essere negativo`)
      return
    }
    const portion = it.porzione === undefined ? undefined : toNum(it.porzione)
    if (portion !== undefined && !(portion > 0)) {
      errors.push(`${label}: "porzione" deve essere maggiore di 0`)
      return
    }
    foods.push({ name, brand: optStr(it.marca), barcode: optStr(it.barcode), per100: { kcal, p, c, f }, portion })
  })
  if (!errors.length && foods.length === 0) errors.push('La lista è vuota')
  return { foods, errors }
}

const nameKey = (name: string, brand?: string) => `${name.trim().toLowerCase()}|${(brand ?? '').trim().toLowerCase()}`

const sameValues = (a: Macros, b: Macros) =>
  Math.abs(a.kcal - b.kcal) < 0.5 && Math.abs(a.p - b.p) < 0.05 && Math.abs(a.c - b.c) < 0.05 && Math.abs(a.f - b.f) < 0.05

export interface ImportResult {
  added: number
  updated: number
  same: number
  kept: number
}

/** Unisce la lista alla rubrica: riconosce i doppioni per barcode o per nome+marca. */
export async function importFoods(list: ParsedFood[], overwrite: boolean): Promise<ImportResult> {
  const res: ImportResult = { added: 0, updated: 0, same: 0, kept: 0 }
  await db.transaction('rw', db.foods, async () => {
    const byBarcode = new Map<string, Food>()
    const byName = new Map<string, Food>()
    const register = (f: Food) => {
      if (f.barcode) byBarcode.set(f.barcode, f)
      byName.set(nameKey(f.name, f.brand), f)
    }
    for (const f of await db.foods.toArray()) register(f)

    const toAdd: Food[] = []
    for (const p of list) {
      const found = (p.barcode ? byBarcode.get(p.barcode) : undefined) ?? byName.get(nameKey(p.name, p.brand))
      if (!found) {
        // lastUsed = 0: gli alimenti importati non invadono la lista "Usati di recente"
        const food: Food = { name: p.name, brand: p.brand, barcode: p.barcode, per100: p.per100, portion: p.portion ?? 100, useCount: 0, lastUsed: 0 }
        toAdd.push(food)
        register(food)
      } else if (sameValues(found.per100, p.per100)) {
        res.same++
      } else if (overwrite && found.id !== undefined) {
        await db.foods.update(found.id, { per100: p.per100, portion: p.portion ?? found.portion, brand: p.brand ?? found.brand, barcode: p.barcode ?? found.barcode })
        found.per100 = p.per100
        res.updated++
      } else {
        res.kept++
      }
    }
    if (toAdd.length) await db.foods.bulkAdd(toAdd)
    res.added = toAdd.length
  })
  return res
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Esporta la rubrica. Restituisce quanti alimenti sono stati esportati. */
export async function exportFoods(): Promise<number> {
  const foods = await db.foods.orderBy('name').toArray()
  if (!foods.length) return 0
  const data = {
    app: 'nutritrack-foods',
    version: 1,
    alimenti: foods.map((f) => ({
      nome: f.name,
      ...(f.brand ? { marca: f.brand } : {}),
      ...(f.barcode ? { barcode: f.barcode } : {}),
      kcal: Math.round(f.per100.kcal),
      p: r1(f.per100.p),
      c: r1(f.per100.c),
      f: r1(f.per100.f),
      porzione: f.portion,
    })),
  }
  await saveJsonFile(`nutritrack-alimenti-${today()}.json`, JSON.stringify(data, null, 2), 'Alimenti NutriTrack')
  return foods.length
}

import type { Macros } from '../types'

/** Prodotto trovato su Open Food Facts, già normalizzato. */
export interface Candidate {
  name: string
  brand?: string
  barcode?: string
  per100: Macros
  portion: number
}

interface OffProduct {
  code?: string
  product_name?: string
  product_name_it?: string
  brands?: string
  serving_quantity?: string | number
  nutriments?: Record<string, number | string | undefined>
}

const FIELDS = 'code,product_name,product_name_it,brands,nutriments,serving_quantity'

function num(v: number | string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function toCandidate(p: OffProduct): Candidate | null {
  const name = (p.product_name_it || p.product_name || '').trim()
  const n = p.nutriments
  if (!name || !n) return null
  let kcal = num(n['energy-kcal_100g'])
  if (kcal === undefined) {
    const kj = num(n['energy_100g'])
    if (kj !== undefined) kcal = Math.round(kj / 4.184)
  }
  if (kcal === undefined) return null
  const serving = num(p.serving_quantity)
  return {
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code || undefined,
    per100: {
      kcal: Math.round(kcal),
      p: num(n['proteins_100g']) ?? 0,
      c: num(n['carbohydrates_100g']) ?? 0,
      f: num(n['fat_100g']) ?? 0,
    },
    portion: serving && serving > 0 ? Math.round(serving) : 100,
  }
}

export async function searchOff(query: string, signal?: AbortSignal): Promise<Candidate[]> {
  const url =
    'https://it.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=25' +
    `&fields=${FIELDS}&search_terms=${encodeURIComponent(query)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`)
  const data = (await res.json()) as { products?: OffProduct[] }
  return (data.products ?? []).map(toCandidate).filter((c): c is Candidate => c !== null)
}

export async function lookupBarcode(code: string): Promise<Candidate | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Open Food Facts: HTTP ${res.status}`)
  const data = (await res.json()) as { status?: number; product?: OffProduct }
  if (data.status !== 1 || !data.product) return null
  return toCandidate({ ...data.product, code })
}

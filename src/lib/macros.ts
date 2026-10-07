import type { Macros } from '../types'

export const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0 }

const r1 = (n: number) => Math.round(n * 10) / 10

export function scale(per100: Macros, grams: number): Macros {
  const k = grams / 100
  return { kcal: Math.round(per100.kcal * k), p: r1(per100.p * k), c: r1(per100.c * k), f: r1(per100.f * k) }
}

/** Converte valori riferiti a `grams` grammi in valori per 100 g. */
export function per100From(m: Macros, grams: number): Macros {
  const k = 100 / grams
  // 3 decimali: con un solo decimale la porzione originale non si ricostruisce esatta (100 -> 99.9)
  const r3 = (n: number) => Math.round(n * 1000) / 1000
  return { kcal: r3(m.kcal * k), p: r3(m.p * k), c: r3(m.c * k), f: r3(m.f * k) }
}

export function sum(list: Macros[]): Macros {
  const t = list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }), ZERO)
  return { kcal: Math.round(t.kcal), p: r1(t.p), c: r1(t.c), f: r1(t.f) }
}

export const kcalFromMacros = (m: Macros) => Math.round(m.p * 4 + m.c * 4 + m.f * 9)

/** Numero senza decimali inutili: 12 -> "12", 12.5 -> "12.5" */
export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** Accetta la virgola decimale. Restituisce NaN se non valido. */
export function parseNum(s: string): number {
  const n = parseFloat(s.trim().replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

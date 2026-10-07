import { MEALS, type Diet, type DietAlt, type DietItem, type MealId } from '../types'
import { DAYS } from './dates'
import { kcalFromMacros } from './macros'

const MEAL_IDS = MEALS.map((m) => m.id) as string[]
const VALID_DAYS = [...DAYS, 'tutti'] as string[]

export const DIET_EXAMPLE = `{
  "nome": "Dieta esempio",
  "giorni": {
    "lun": {
      "colazione": [
        {
          "alimento": "Yogurt greco 0%",
          "g": 170, "kcal": 100, "p": 17, "c": 6, "f": 0.5,
          "alternative": [
            { "alimento": "Skyr", "g": 170, "kcal": 105, "p": 19, "c": 6, "f": 0.3 }
          ]
        },
        { "alimento": "Fette biscottate integrali", "g": 30, "kcal": 115, "p": 4, "c": 21, "f": 2 }
      ],
      "pranzo": [
        { "alimento": "Pasta di semola (peso a crudo)", "g": 80, "kcal": 282, "p": 9.6, "c": 57, "f": 1.2 },
        { "alimento": "Petto di pollo", "g": 150, "kcal": 165, "p": 34, "c": 0, "f": 2.4 }
      ],
      "cena": [
        { "alimento": "Merluzzo", "g": 200, "kcal": 164, "p": 36, "c": 0, "f": 1.4 },
        { "alimento": "Insalata mista", "g": 150, "kcal": 25, "p": 2, "c": 4, "f": 0.3 }
      ]
    },
    "mar": {
      "colazione": [{ "alimento": "Latte parzialmente scremato", "g": 200, "kcal": 92, "p": 6.6, "c": 9.6, "f": 3.2 }]
    }
  }
}`

export const DIET_PROMPT = `Convertimi la dieta che ti allego in un JSON con questa struttura esatta e restituiscimi SOLO il JSON.

Regole:
- "giorni" ha come chiavi: lun, mar, mer, gio, ven, sab, dom (usa "tutti" se un pasto è uguale ogni giorno).
- Ogni giorno ha i pasti: colazione, spuntino, pranzo, merenda, cena (solo quelli previsti).
- Ogni pasto è una lista di alimenti: { "alimento": nome, "g": grammi, "kcal": numero, "p": proteine g, "c": carboidrati g, "f": grassi g } riferiti ALLA QUANTITÀ indicata (non per 100 g).
- Se la dieta prevede alternative/sostituzioni, mettile in "alternative" (stessi campi) dentro l'alimento.
- Se mancano i valori nutrizionali, stimali con le tabelle CREA / USDA.

Esempio:
${DIET_EXAMPLE}`

type Raw = Record<string, unknown>
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

function toNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(',', '.'))
  return NaN
}

function parseAlt(raw: unknown, path: string, errors: string[]): DietAlt | null {
  if (!isObj(raw)) {
    errors.push(`${path}: non è un oggetto`)
    return null
  }
  const name = typeof raw.alimento === 'string' ? raw.alimento.trim() : ''
  const g = toNum(raw.g)
  const p = raw.p === undefined ? 0 : toNum(raw.p)
  const c = raw.c === undefined ? 0 : toNum(raw.c)
  const f = raw.f === undefined ? 0 : toNum(raw.f)
  let kcal = raw.kcal === undefined ? NaN : toNum(raw.kcal)
  if (!name) errors.push(`${path}: manca "alimento"`)
  if (!(g > 0)) errors.push(`${path} (${name || '?'}): "g" deve essere un numero maggiore di 0`)
  if ([p, c, f].some((n) => !Number.isFinite(n) || n < 0)) errors.push(`${path} (${name || '?'}): "p", "c", "f" devono essere numeri`)
  if (!Number.isFinite(kcal)) {
    if (raw.kcal === undefined && [p, c, f].every(Number.isFinite)) kcal = kcalFromMacros({ kcal: 0, p, c, f })
    else errors.push(`${path} (${name || '?'}): "kcal" non valido`)
  }
  if (!name || !(g > 0) || !Number.isFinite(kcal) || ![p, c, f].every(Number.isFinite)) return null
  return { alimento: name, g, kcal: Math.round(kcal), p, c, f }
}

export function parseDiet(text: string): { diet?: Diet; errors: string[] } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { errors: [`JSON non valido: ${(e as Error).message}`] }
  }
  if (!isObj(raw) || !isObj(raw.giorni)) return { errors: ['Manca l\'oggetto "giorni" al primo livello'] }

  const errors: string[] = []
  const giorni: Diet['giorni'] = {}
  for (const [dayRaw, dayVal] of Object.entries(raw.giorni)) {
    const day = dayRaw.trim().toLowerCase().slice(0, 3) === 'tut' ? 'tutti' : dayRaw.trim().toLowerCase().slice(0, 3)
    if (!VALID_DAYS.includes(day)) {
      errors.push(`Giorno "${dayRaw}" non riconosciuto (usa lun, mar, mer, gio, ven, sab, dom, tutti)`)
      continue
    }
    if (!isObj(dayVal)) {
      errors.push(`${dayRaw}: non è un oggetto di pasti`)
      continue
    }
    const meals: Diet['giorni'][string] = {}
    for (const [mealKey, items] of Object.entries(dayVal)) {
      if (!MEAL_IDS.includes(mealKey)) {
        errors.push(`${dayRaw}: pasto "${mealKey}" sconosciuto (usa ${MEAL_IDS.join(', ')})`)
        continue
      }
      if (!Array.isArray(items)) {
        errors.push(`${dayRaw}/${mealKey}: deve essere una lista`)
        continue
      }
      const parsed: DietItem[] = []
      items.forEach((it, i) => {
        const path = `${dayRaw}/${mealKey}[${i + 1}]`
        const item = parseAlt(it, path, errors)
        if (!item) return
        const out: DietItem = item
        const alts = isObj(it) ? it.alternative : undefined
        if (Array.isArray(alts)) {
          const list = alts.map((a, j) => parseAlt(a, `${path}/alternative[${j + 1}]`, errors)).filter((a): a is DietAlt => a !== null)
          if (list.length) out.alternative = list
        }
        parsed.push(out)
      })
      meals[mealKey as MealId] = parsed
    }
    giorni[day] = meals
  }
  if (errors.length) return { errors }
  if (Object.keys(giorni).length === 0) return { errors: ['La dieta non contiene nessun giorno'] }
  return { diet: { nome: typeof raw.nome === 'string' && raw.nome.trim() ? raw.nome.trim() : 'La mia dieta', giorni }, errors: [] }
}

/** Pasti previsti per una data (con fallback su "tutti"). */
export function dietForDay(diet: Diet | null | undefined, day: string): Diet['giorni'][string] | undefined {
  if (!diet) return undefined
  return diet.giorni[day] ?? diet.giorni.tutti
}

export function dietKey(date: string, meal: MealId, index: number): string {
  return `${date}|${meal}|${index}`
}

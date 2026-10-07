import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AddFood } from '../components/AddFood'
import { MacroBars, MacroLine, Ring, Sheet } from '../components/ui'
import { db, useSetting, useTargets } from '../db'
import { addDays, dateLong, dayKey, dayLabel, today } from '../lib/dates'
import { dietForDay, dietKey } from '../lib/diet'
import { fmt, parseNum, sum } from '../lib/macros'
import { MEALS, type Diet, type DietAlt, type Entry, type MealId } from '../types'

export function Today() {
  const [date, setDate] = useState(today())
  const [adding, setAdding] = useState<MealId | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [picking, setPicking] = useState<{ meal: MealId; index: number; options: DietAlt[] } | null>(null)

  const entries = useLiveQuery(() => db.entries.where('date').equals(date).toArray(), [date]) ?? []
  const diet = useSetting<Diet>('diet')
  const targets = useTargets()
  const dayDiet = dietForDay(diet, dayKey(date))

  const total = sum(entries)

  async function tick(meal: MealId, index: number, item: DietAlt, existing?: Entry) {
    const key = dietKey(date, meal, index)
    if (existing?.id !== undefined) {
      await db.entries.delete(existing.id)
      return
    }
    await db.entries.add({ date, meal, name: item.alimento, grams: item.g, kcal: item.kcal, p: item.p, c: item.c, f: item.f, dietKey: key, createdAt: Date.now() })
  }

  async function chooseVariant(meal: MealId, index: number, item: DietAlt) {
    const key = dietKey(date, meal, index)
    await db.transaction('rw', db.entries, async () => {
      await db.entries.where('dietKey').equals(key).delete()
      await db.entries.add({ date, meal, name: item.alimento, grams: item.g, kcal: item.kcal, p: item.p, c: item.c, f: item.f, dietKey: key, createdAt: Date.now() })
    })
    setPicking(null)
  }

  async function tickAll(meal: MealId) {
    const items = dayDiet?.[meal] ?? []
    await db.transaction('rw', db.entries, async () => {
      for (let i = 0; i < items.length; i++) {
        const key = dietKey(date, meal, i)
        if (entries.some((e) => e.dietKey === key)) continue
        const it = items[i]
        await db.entries.add({ date, meal, name: it.alimento, grams: it.g, kcal: it.kcal, p: it.p, c: it.c, f: it.f, dietKey: key, createdAt: Date.now() })
      }
    })
  }

  const dietKeys = new Set<string>()
  if (dayDiet) for (const m of MEALS) (dayDiet[m.id] ?? []).forEach((_, i) => dietKeys.add(dietKey(date, m.id, i)))

  return (
    <div className="screen">
      <header className="day-nav">
        <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Giorno precedente">
          ‹
        </button>
        <button className="day-title" onClick={() => setDate(today())}>
          <b>{dayLabel(date)}</b>
          <small>{dateLong(date)}</small>
        </button>
        <button className="icon-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Giorno successivo">
          ›
        </button>
      </header>

      <section className="card summary">
        <Ring eaten={total.kcal} target={targets.kcal} />
        <MacroBars eaten={total} target={targets} />
      </section>

      <WeightRow date={date} />

      {MEALS.map((meal) => {
        const items = dayDiet?.[meal.id] ?? []
        const mealEntries = entries.filter((e) => e.meal === meal.id)
        const extras = mealEntries.filter((e) => !e.dietKey || !dietKeys.has(e.dietKey))
        const eaten = sum(mealEntries)
        const planned = sum(items)
        const allTicked = items.length > 0 && items.every((_, i) => mealEntries.some((e) => e.dietKey === dietKey(date, meal.id, i)))
        const empty = items.length === 0 && extras.length === 0

        return (
          <section key={meal.id} className="card meal">
            <div className="meal-head">
              <h3>
                <span>{meal.icon}</span> {meal.label}
              </h3>
              <span className="meal-kcal">
                {eaten.kcal}
                {items.length > 0 && <small> / {planned.kcal}</small>} kcal
              </span>
            </div>

            {items.map((item, i) => {
              const existing = mealEntries.find((e) => e.dietKey === dietKey(date, meal.id, i))
              // se ho scelto un'alternativa mostro quella, altrimenti il valore di dieta
              const label = existing ? existing.name : item.alimento
              const grams = existing ? existing.grams : item.g
              const shown = existing ?? item
              const options = [item, ...(item.alternative ?? [])]
              return (
                <div key={i} className={existing ? 'row-item done' : 'row-item'}>
                  <button className="check" onClick={() => tick(meal.id, i, item, existing)} aria-label={existing ? 'Togli la spunta' : 'Segna come mangiato'} aria-pressed={!!existing}>
                    {existing ? '✓' : ''}
                  </button>
                  <button className="item-main" onClick={() => tick(meal.id, i, item, existing)}>
                    <b>{label}</b>
                    <small>
                      {fmt(grams)} g · {shown.kcal} kcal · <MacroLine m={shown} />
                    </small>
                  </button>
                  {options.length > 1 && (
                    <button className="icon-btn small" onClick={() => setPicking({ meal: meal.id, index: i, options })} aria-label="Scegli alternativa">
                      ⇄
                    </button>
                  )}
                </div>
              )
            })}

            {extras.map((e) => (
              <button key={e.id} className="row-item extra" onClick={() => setEditing(e)}>
                <span className="dot" />
                <span className="item-main">
                  <b>{e.name}</b>
                  <small>
                    {fmt(e.grams)} g · {e.kcal} kcal · <MacroLine m={e} />
                  </small>
                </span>
              </button>
            ))}

            <div className="meal-actions">
              <button className="add-btn" onClick={() => setAdding(meal.id)}>
                ＋ {empty ? 'Aggiungi' : 'Aggiungi altro'}
              </button>
              {items.length > 0 && !allTicked && (
                <button className="add-btn soft" onClick={() => tickAll(meal.id)}>
                  ✓ Tutto il pasto
                </button>
              )}
            </div>
          </section>
        )
      })}

      {!diet && (
        <p className="muted center small pad">Hai una dieta da seguire? Importala dalla tab “Dieta” e potrai spuntare i pasti con un tap.</p>
      )}

      {adding && <AddFood date={date} meal={adding} onClose={() => setAdding(null)} />}
      {editing && <EditEntry entry={editing} onClose={() => setEditing(null)} />}
      {picking && (
        <Sheet title="Scegli cosa hai mangiato" onClose={() => setPicking(null)}>
          {picking.options.map((o, i) => (
            <button key={i} className="list-row" onClick={() => chooseVariant(picking.meal, picking.index, o)}>
              <span className="grow">
                <b>{o.alimento}</b>
                <small>
                  {fmt(o.g)} g · {o.kcal} kcal · <MacroLine m={o} />
                </small>
              </span>
              {i === 0 && <span className="tag">dieta</span>}
            </button>
          ))}
        </Sheet>
      )}
    </div>
  )
}

function WeightRow({ date }: { date: string }) {
  // null = nessun peso per quel giorno, undefined = ancora in caricamento
  const saved = useLiveQuery(async () => (await db.weights.get(date)) ?? null, [date])
  const last = useLiveQuery(async () => (await db.weights.where('date').below(date).last()) ?? null, [date])
  if (saved === undefined || last === undefined) return <section className="card weight-row" />
  return <WeightInput key={`${date}:${saved?.kg ?? ''}`} date={date} savedKg={saved?.kg} lastKg={last?.kg} />
}

function WeightInput({ date, savedKg, lastKg }: { date: string; savedKg?: number; lastKg?: number }) {
  const [text, setText] = useState(savedKg !== undefined ? String(savedKg) : '')
  const kg = parseNum(text)
  const dirty = Number.isFinite(kg) && kg > 20 && kg < 400 && kg !== savedKg

  async function save() {
    if (!dirty) return
    await db.weights.put({ date, kg: Math.round(kg * 10) / 10 })
  }

  return (
    <section className="card weight-row">
      <label className="grow">
        <span>⚖️ Peso</span>
        <div className="weight-input">
          <input inputMode="decimal" placeholder={lastKg !== undefined ? String(lastKg) : '0.0'} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <em>kg</em>
        </div>
      </label>
      {dirty ? (
        <button className="btn primary" onClick={save}>
          Salva
        </button>
      ) : savedKg !== undefined ? (
        <span className="tag ok">salvato ✓</span>
      ) : lastKg !== undefined ? (
        <span className="muted small">ultimo {lastKg} kg</span>
      ) : null}
    </section>
  )
}

function EditEntry({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [grams, setGrams] = useState(fmt(entry.grams))
  const [meal, setMeal] = useState<MealId>(entry.meal)
  const g = parseNum(grams)
  const valid = g > 0
  const k = valid ? g / entry.grams : 1
  const r1 = (n: number) => Math.round(n * 10) / 10
  const preview = { kcal: Math.round(entry.kcal * k), p: r1(entry.p * k), c: r1(entry.c * k), f: r1(entry.f * k) }

  async function save() {
    if (!valid || entry.id === undefined) return
    await db.entries.update(entry.id, { grams: g, meal, ...preview })
    onClose()
  }
  async function remove() {
    if (entry.id !== undefined) await db.entries.delete(entry.id)
    onClose()
  }

  return (
    <Sheet title={entry.name} onClose={onClose}>
      <div className="form">
        <label>
          Grammi
          <input className="big-input" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <div className="preview">
          <div className="preview-kcal">
            {preview.kcal}
            <small> kcal</small>
          </div>
          <MacroLine m={preview} />
        </div>
        <div className="chips">
          {MEALS.map((x) => (
            <button key={x.id} className={meal === x.id ? 'chip on' : 'chip'} onClick={() => setMeal(x.id)}>
              {x.icon} {x.label}
            </button>
          ))}
        </div>
        <button className="btn primary big" disabled={!valid} onClick={save}>
          Salva
        </button>
        <button className="btn danger" onClick={remove}>
          Elimina dal diario
        </button>
      </div>
    </Sheet>
  )
}

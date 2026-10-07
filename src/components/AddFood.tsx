import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { lookupBarcode, searchOff, type Candidate } from '../lib/off'
import { fmt, parseNum, scale } from '../lib/macros'
import { MEALS, type Food, type MealId } from '../types'
import { BarcodeScanner } from './BarcodeScanner'
import { FoodForm } from './FoodForm'
import { MacroLine, Sheet } from './ui'

type Step = { kind: 'search' } | { kind: 'scan' } | { kind: 'new'; name: string } | { kind: 'portion'; food: Food }

async function saveCandidate(c: Candidate): Promise<Food> {
  if (c.barcode) {
    const existing = await db.foods.where('barcode').equals(c.barcode).first()
    if (existing) return existing
  }
  const food: Food = { name: c.name, brand: c.brand, barcode: c.barcode, per100: c.per100, portion: c.portion, useCount: 0, lastUsed: Date.now() }
  const id = await db.foods.add(food)
  return { ...food, id }
}

export function AddFood({ date, meal, onClose }: { date: string; meal: MealId; onClose: () => void }) {
  const [step, setStep] = useState<Step>({ kind: 'search' })
  const title = step.kind === 'scan' ? 'Scansiona' : step.kind === 'new' ? 'Nuovo alimento' : step.kind === 'portion' ? 'Quanto?' : 'Aggiungi'

  return (
    <Sheet title={title} onClose={onClose} full>
      {step.kind === 'search' && <SearchStep onPick={(food) => setStep({ kind: 'portion', food })} onScan={() => setStep({ kind: 'scan' })} onNew={(name) => setStep({ kind: 'new', name })} />}
      {step.kind === 'scan' && <ScanStep onFound={(food) => setStep({ kind: 'portion', food })} onBack={() => setStep({ kind: 'search' })} onNew={() => setStep({ kind: 'new', name: '' })} />}
      {step.kind === 'new' && <FoodForm defaultName={step.name} submitLabel="Salva e continua" onSaved={(food) => setStep({ kind: 'portion', food })} />}
      {step.kind === 'portion' && <PortionStep food={step.food} date={date} meal={meal} onDone={onClose} />}
    </Sheet>
  )
}

function SearchStep({ onPick, onScan, onNew }: { onPick: (f: Food) => void; onScan: () => void; onNew: (name: string) => void }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const [online, setOnline] = useState<Candidate[] | 'loading' | 'error' | null>(null)

  const local = useLiveQuery(async () => {
    const all = await db.foods.toArray()
    const list = q ? all.filter((f) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(q)) : all
    return list.sort((a, b) => (q ? b.useCount - a.useCount : b.lastUsed - a.lastUsed)).slice(0, 30)
  }, [q])

  useEffect(() => {
    if (q.length < 3) return
    setOnline('loading')
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      searchOff(q, ctrl.signal)
        .then((r) => setOnline(r))
        .catch((e) => {
          if ((e as Error).name !== 'AbortError') setOnline('error')
        })
    }, 500)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q])

  return (
    <div>
      <div className="row">
        <input className="search" type="search" placeholder="Cerca un alimento…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <button className="btn icon" onClick={onScan} aria-label="Scansiona codice a barre">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8M18 8v8" />
          </svg>
        </button>
      </div>

      <button className="list-row accent" onClick={() => onNew(query.trim())}>
        <span className="plus">＋</span>
        <span className="grow">
          <b>{q ? `Crea "${query.trim()}"` : 'Nuovo alimento'}</b>
          <small>Inserisci tu kcal e macro</small>
        </span>
      </button>

      <h3 className="section">{q ? 'I miei alimenti' : 'Usati di recente'}</h3>
      {local && local.length === 0 && <p className="muted small pad">{q ? 'Nessuno nella tua rubrica.' : 'La rubrica è vuota: ogni alimento che aggiungi comparirà qui.'}</p>}
      {local?.map((f) => (
        <button key={f.id} className="list-row" onClick={() => onPick(f)}>
          <span className="grow">
            <b>{f.name}</b>
            <small>
              {f.brand ? `${f.brand} · ` : ''}
              {Math.round(f.per100.kcal)} kcal/100 g · porz. {fmt(f.portion)} g
            </small>
          </span>
        </button>
      ))}

      {q.length >= 3 && (
        <>
          <h3 className="section">Open Food Facts</h3>
          {online === 'loading' && <p className="muted small pad">Cerco online…</p>}
          {online === 'error' && <p className="muted small pad">Ricerca online non disponibile. Puoi comunque creare l'alimento a mano.</p>}
          {Array.isArray(online) && online.length === 0 && <p className="muted small pad">Nessun risultato online.</p>}
          {Array.isArray(online) &&
            online.map((c, i) => (
              <button key={`${c.barcode}-${i}`} className="list-row" onClick={async () => onPick(await saveCandidate(c))}>
                <span className="grow">
                  <b>{c.name}</b>
                  <small>
                    {c.brand ? `${c.brand} · ` : ''}
                    {c.per100.kcal} kcal/100 g
                  </small>
                </span>
              </button>
            ))}
        </>
      )}
    </div>
  )
}

function ScanStep({ onFound, onBack, onNew }: { onFound: (f: Food) => void; onBack: () => void; onNew: () => void }) {
  const [state, setState] = useState<'scan' | 'loading' | 'missing' | 'error'>('scan')
  const [code, setCode] = useState('')

  const onDetected = useCallback(
    async (c: string) => {
      setCode(c)
      setState('loading')
      try {
        const local = await db.foods.where('barcode').equals(c).first()
        if (local) return onFound(local)
        const cand = await lookupBarcode(c)
        if (!cand) return setState('missing')
        onFound(await saveCandidate(cand))
      } catch {
        setState('error')
      }
    },
    [onFound],
  )

  if (state === 'scan') return <BarcodeScanner onDetected={onDetected} />
  if (state === 'loading') return <p className="muted center pad">Cerco il codice {code}…</p>
  return (
    <div className="center pad">
      <p>{state === 'missing' ? `Il codice ${code} non è nel database.` : 'Ricerca non riuscita (sei online?).'}</p>
      <div className="row">
        <button className="btn" onClick={() => setState('scan')}>
          Riprova
        </button>
        <button className="btn primary" onClick={onNew}>
          Inserisci a mano
        </button>
      </div>
      <button className="btn ghost" onClick={onBack}>
        Torna alla ricerca
      </button>
    </div>
  )
}

function PortionStep({ food, date, meal: initialMeal, onDone }: { food: Food; date: string; meal: MealId; onDone: () => void }) {
  const [grams, setGrams] = useState(fmt(food.portion))
  const [meal, setMeal] = useState(initialMeal)
  const g = parseNum(grams)
  const valid = g > 0
  const m = valid ? scale(food.per100, g) : { kcal: 0, p: 0, c: 0, f: 0 }

  async function add() {
    if (!valid) return
    await db.transaction('rw', db.entries, db.foods, async () => {
      await db.entries.add({ date, meal, name: food.name, grams: g, ...m, foodId: food.id, createdAt: Date.now() })
      if (food.id !== undefined) await db.foods.update(food.id, { useCount: food.useCount + 1, lastUsed: Date.now(), portion: g })
    })
    onDone()
  }

  return (
    <div className="form">
      <div className="food-title">
        <b>{food.name}</b>
        {food.brand && <small>{food.brand}</small>}
      </div>

      <label>
        Grammi
        <input className="big-input" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
      </label>
      <div className="chips">
        {[0.5, 1, 1.5, 2].map((k) => (
          <button key={k} className="chip" onClick={() => setGrams(fmt(Math.round(food.portion * k * 10) / 10))}>
            {fmt(Math.round(food.portion * k * 10) / 10)} g
          </button>
        ))}
      </div>

      <div className="preview">
        <div className="preview-kcal">
          {m.kcal}
          <small> kcal</small>
        </div>
        <MacroLine m={m} />
      </div>

      <div className="chips">
        {MEALS.map((x) => (
          <button key={x.id} className={meal === x.id ? 'chip on' : 'chip'} onClick={() => setMeal(x.id)}>
            {x.icon} {x.label}
          </button>
        ))}
      </div>

      <button className="btn primary big" disabled={!valid} onClick={add}>
        Aggiungi
      </button>
    </div>
  )
}

import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { FoodForm } from '../components/FoodForm'
import { ImportFoods } from '../components/ImportFoods'
import { Sheet } from '../components/ui'
import { DEFAULT_TARGETS, db, setSetting, useSetting, useTargets } from '../db'
import { exportBackup, importBackup, wipeAll } from '../lib/backup'
import { exportFoods } from '../lib/foods-io'
import { DAYS } from '../lib/dates'
import { dietForDay } from '../lib/diet'
import { fmt, parseNum, sum } from '../lib/macros'
import { MEALS, type Diet, type Food, type Macros } from '../types'

export function More() {
  return (
    <div className="screen">
      <h1 className="page-title">Altro</h1>
      <Targets />
      <Foods />
      <Backup />
    </div>
  )
}

function Targets() {
  const targets = useTargets()
  const diet = useSetting<Diet>('diet')
  return <TargetsForm key={JSON.stringify(targets)} targets={targets} diet={diet ?? null} />
}

function TargetsForm({ targets, diet }: { targets: Macros; diet: Diet | null }) {
  const [v, setV] = useState({ kcal: String(targets.kcal), p: String(targets.p), c: String(targets.c), f: String(targets.f) })
  const parsed: Macros = { kcal: parseNum(v.kcal), p: parseNum(v.p), c: parseNum(v.c), f: parseNum(v.f) }
  const valid = Object.values(parsed).every((n) => Number.isFinite(n) && n >= 0)
  const dirty = valid && (Object.keys(parsed) as (keyof Macros)[]).some((k) => parsed[k] !== targets[k])

  async function fromDiet() {
    if (!diet) return
    const totals = DAYS.map((d) => {
      const meals = dietForDay(diet, d)
      return meals ? sum(MEALS.flatMap((m) => meals[m.id] ?? [])) : null
    }).filter((t): t is Macros => t !== null && t.kcal > 0)
    if (!totals.length) return
    const avg = (k: keyof Macros) => Math.round(totals.reduce((a, t) => a + t[k], 0) / totals.length)
    await setSetting('targets', { kcal: avg('kcal'), p: avg('p'), c: avg('c'), f: avg('f') })
  }

  const field = (k: keyof Macros, label: string, color?: string) => (
    <label style={color ? { color } : undefined}>
      {label}
      <input inputMode="decimal" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </label>
  )

  return (
    <section className="card">
      <h3>Obiettivo giornaliero</h3>
      <div className="grid4">
        {field('kcal', 'kcal')}
        {field('p', 'Prot. g', 'var(--p)')}
        {field('c', 'Carb. g', 'var(--c)')}
        {field('f', 'Grassi g', 'var(--f)')}
      </div>
      <div className="row wrap">
        <button className="btn primary" disabled={!dirty} onClick={() => setSetting('targets', parsed)}>
          Salva
        </button>
        {diet && (
          <button className="btn" onClick={fromDiet}>
            Usa la media della dieta
          </button>
        )}
        {targets !== DEFAULT_TARGETS && (
          <button className="btn ghost" onClick={() => setSetting('targets', DEFAULT_TARGETS)}>
            Ripristina
          </button>
        )}
      </div>
    </section>
  )
}

function Foods() {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Food | null>(null)
  const [importing, setImporting] = useState(false)
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray(), []) ?? []
  const q = query.trim().toLowerCase()
  const list = q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods

  async function remove(f: Food) {
    if (f.id !== undefined && confirm(`Eliminare "${f.name}" dalla rubrica? Il diario non cambia.`)) {
      await db.foods.delete(f.id)
      setEditing(null)
    }
  }

  return (
    <section className="card">
      <h3>I miei alimenti ({foods.length})</h3>
      <div className="row wrap">
        <button className="btn" onClick={() => setImporting(true)}>
          ⬇ Importa lista
        </button>
        <button className="btn" disabled={foods.length === 0} onClick={() => void exportFoods()}>
          ⬆ Esporta / condividi
        </button>
      </div>
      {foods.length > 5 && <input type="search" className="search" placeholder="Filtra…" value={query} onChange={(e) => setQuery(e.target.value)} />}
      {foods.length === 0 && <p className="muted small">Qui compaiono gli alimenti che inserisci o scansioni.</p>}
      {list.map((f) => (
        <button key={f.id} className="list-row" onClick={() => setEditing(f)}>
          <span className="grow">
            <b>{f.name}</b>
            <small>
              {Math.round(f.per100.kcal)} kcal · P {fmt(f.per100.p)} · C {fmt(f.per100.c)} · G {fmt(f.per100.f)} (per 100 g)
            </small>
          </span>
        </button>
      ))}
      {importing && <ImportFoods onClose={() => setImporting(false)} />}
      {editing && (
        <Sheet title="Modifica alimento" onClose={() => setEditing(null)}>
          <FoodForm initial={editing} submitLabel="Salva" onSaved={() => setEditing(null)} />
          <button className="btn danger" onClick={() => remove(editing)}>
            Elimina alimento
          </button>
        </Sheet>
      )}
    </section>
  )
}

function Backup() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState('')

  async function restore(file: File) {
    if (!confirm('Il ripristino SOSTITUISCE tutti i dati attuali con quelli del backup. Continuare?')) return
    try {
      await importBackup(await file.text())
      setMsg('Backup ripristinato ✓')
    } catch (e) {
      setMsg(`Errore: ${(e as Error).message}`)
    }
  }

  async function wipe() {
    if (confirm('Cancellare TUTTI i dati (diario, peso, alimenti, dieta)? Non si può annullare.')) {
      await wipeAll()
      setMsg('Dati cancellati')
    }
  }

  return (
    <section className="card">
      <h3>Backup</h3>
      <p className="muted small">
        I dati stanno solo su questo telefono. Fai ogni tanto un backup e salvalo su File/iCloud: se disinstalli l'app o cancelli i dati di Safari altrimenti li perdi.
      </p>
      <div className="row wrap">
        <button className="btn primary" onClick={exportBackup}>
          ⬆ Esporta backup
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          ⬇ Ripristina
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void restore(f)
            e.target.value = ''
          }}
        />
      </div>
      {msg && <p className="muted small">{msg}</p>}
      <button className="btn danger" onClick={wipe}>
        Cancella tutti i dati
      </button>
    </section>
  )
}

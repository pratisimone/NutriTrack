import { useState } from 'react'
import { db } from '../db'
import { kcalFromMacros, parseNum, per100From } from '../lib/macros'
import type { Food } from '../types'

/** Crea o modifica un alimento in rubrica. Si inseriscono kcal e macro a mano. */
export function FoodForm({
  initial,
  defaultName,
  submitLabel,
  onSaved,
}: {
  initial?: Food
  defaultName?: string
  submitLabel: string
  onSaved: (food: Food) => void
}) {
  const [name, setName] = useState(initial?.name ?? defaultName ?? '')
  const [basis, setBasis] = useState<'100' | 'portion'>('100')
  const [grams, setGrams] = useState(String(initial?.portion ?? 100))
  const show = (n: number) => String(Math.round(n * 10) / 10)
  const [kcal, setKcal] = useState(initial ? show(initial.per100.kcal) : '')
  const [p, setP] = useState(initial ? show(initial.per100.p) : '')
  const [c, setC] = useState(initial ? show(initial.per100.c) : '')
  const [f, setF] = useState(initial ? show(initial.per100.f) : '')
  const [error, setError] = useState('')

  async function save() {
    const g = parseNum(grams)
    const vp = p.trim() ? parseNum(p) : 0
    const vc = c.trim() ? parseNum(c) : 0
    const vf = f.trim() ? parseNum(f) : 0
    if (!name.trim()) return setError('Scrivi il nome dell\'alimento')
    if (!(g > 0)) return setError('I grammi devono essere maggiori di 0')
    if ([vp, vc, vf].some((n) => Number.isNaN(n) || n < 0)) return setError('Controlla i valori di proteine, carboidrati e grassi')
    let vk = kcal.trim() ? parseNum(kcal) : NaN
    if (Number.isNaN(vk)) {
      if (kcal.trim()) return setError('Le kcal non sono un numero valido')
      if (vp + vc + vf === 0) return setError('Inserisci almeno le kcal')
      vk = kcalFromMacros({ kcal: 0, p: vp, c: vc, f: vf })
    }
    const entered = { kcal: vk, p: vp, c: vc, f: vf }
    const per100 = basis === '100' ? entered : per100From(entered, g)
    const food: Food = {
      name: name.trim(),
      brand: initial?.brand,
      barcode: initial?.barcode,
      per100,
      portion: g,
      useCount: initial?.useCount ?? 0,
      lastUsed: initial?.lastUsed ?? Date.now(),
    }
    if (initial?.id !== undefined) {
      await db.foods.update(initial.id, food)
      onSaved({ ...food, id: initial.id })
    } else {
      const id = await db.foods.add(food)
      onSaved({ ...food, id })
    }
  }

  const unit = basis === '100' ? 'per 100 g' : `per ${grams || '?'} g`

  return (
    <div className="form">
      <label>
        Nome
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Pizza margherita" autoFocus={!initial} />
      </label>

      {!initial && (
        <div className="seg">
          <button className={basis === '100' ? 'on' : ''} onClick={() => setBasis('100')}>
            Valori per 100 g
          </button>
          <button className={basis === 'portion' ? 'on' : ''} onClick={() => setBasis('portion')}>
            Valori per porzione
          </button>
        </div>
      )}

      <label>
        {basis === 'portion' ? 'Grammi della porzione' : 'Porzione abituale (g)'}
        <input inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
      </label>

      <div className="grid4">
        <label>
          kcal
          <input inputMode="decimal" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="auto" />
        </label>
        <label style={{ color: 'var(--p)' }}>
          Prot.
          <input inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} placeholder="0" />
        </label>
        <label style={{ color: 'var(--c)' }}>
          Carb.
          <input inputMode="decimal" value={c} onChange={(e) => setC(e.target.value)} placeholder="0" />
        </label>
        <label style={{ color: 'var(--f)' }}>
          Grassi
          <input inputMode="decimal" value={f} onChange={(e) => setF(e.target.value)} placeholder="0" />
        </label>
      </div>
      <p className="muted small">
        Valori {initial ? 'per 100 g' : unit}. Se lasci vuote le kcal le calcolo dai macro.
      </p>

      {error && <p className="error">{error}</p>}
      <button className="btn primary big" onClick={save}>
        {submitLabel}
      </button>
    </div>
  )
}

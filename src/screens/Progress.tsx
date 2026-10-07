import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db, useTargets } from '../db'
import { addDays, fromISO, shortDate, today } from '../lib/dates'
import { fmt, sum } from '../lib/macros'

const RANGES = [
  { id: 30, label: '30 g' },
  { id: 90, label: '90 g' },
  { id: 0, label: 'Tutto' },
]

const tooltipStyle = { background: 'var(--card2)', border: '1px solid var(--line)', borderRadius: 12, color: 'var(--text)', fontSize: 13 }

export function Progress() {
  const [range, setRange] = useState(30)
  const targets = useTargets()
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), []) ?? []

  const from = range ? addDays(today(), -range) : '0000-00-00'
  const shown = weights.filter((w) => w.date >= from)
  const data = shown.map((w) => {
    // media mobile sugli ultimi 7 giorni di calendario
    const start = addDays(w.date, -6)
    const win = weights.filter((x) => x.date >= start && x.date <= w.date)
    const avg = win.reduce((a, x) => a + x.kg, 0) / win.length
    return { label: shortDate(w.date), kg: w.kg, media: Math.round(avg * 10) / 10 }
  })
  const first = shown[0]
  const lastW = shown[shown.length - 1]
  const delta = first && lastW ? Math.round((lastW.kg - first.kg) * 10) / 10 : 0

  const weekStart = addDays(today(), -6)
  const weekEntries = useLiveQuery(() => db.entries.where('date').aboveOrEqual(weekStart).toArray(), [weekStart]) ?? []
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const perDay = days.map((d) => {
    const s = sum(weekEntries.filter((e) => e.date === d))
    const dow = fromISO(d).toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3)
    return { date: d, label: dow, ...s }
  })
  const logged = perDay.filter((d) => d.kcal > 0)
  const avgOf = (k: 'kcal' | 'p' | 'c' | 'f') => (logged.length ? Math.round(logged.reduce((a, d) => a + d[k], 0) / logged.length) : 0)

  return (
    <div className="screen">
      <h1 className="page-title">Progressi</h1>

      <section className="card">
        <div className="card-head">
          <h3>Peso</h3>
          <div className="seg small">
            {RANGES.map((r) => (
              <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {data.length === 0 ? (
          <p className="muted center pad">Nessun peso registrato. Inseriscilo dalla schermata “Oggi”.</p>
        ) : (
          <>
            <div className="stats">
              <div>
                <b>{lastW.kg}</b>
                <small>attuale (kg)</small>
              </div>
              <div>
                <b>{data[data.length - 1].media}</b>
                <small>media 7 g</small>
              </div>
              <div>
                <b className={delta > 0 ? 'up' : delta < 0 ? 'down' : ''}>
                  {delta > 0 ? '+' : ''}
                  {delta}
                </b>
                <small>nel periodo</small>
              </div>
            </div>
            <div className="chart">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v.toFixed(1)} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="kg" name="Peso" stroke="var(--muted)" strokeWidth={1.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="media" name="Media 7 g" stroke="var(--accent)" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Ultimi 7 giorni</h3>
          <small className="muted">media {avgOf('kcal')} kcal</small>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={perDay} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--line)', opacity: 0.4 }} />
              <ReferenceLine y={targets.kcal} stroke="var(--c)" strokeDasharray="4 4" />
              <Bar dataKey="kcal" name="kcal" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="stats">
          <div>
            <b style={{ color: 'var(--p)' }}>{fmt(avgOf('p'))} g</b>
            <small>proteine / giorno</small>
          </div>
          <div>
            <b style={{ color: 'var(--c)' }}>{fmt(avgOf('c'))} g</b>
            <small>carboidrati</small>
          </div>
          <div>
            <b style={{ color: 'var(--f)' }}>{fmt(avgOf('f'))} g</b>
            <small>grassi</small>
          </div>
        </div>
        <p className="muted small">Le medie considerano solo i giorni con almeno un alimento registrato.</p>
      </section>
    </div>
  )
}

import { useRef, useState } from 'react'
import { MacroLine } from '../components/ui'
import { setSetting, useSetting } from '../db'
import { DAYS, DAY_NAMES, dayKey, today } from '../lib/dates'
import { DIET_EXAMPLE, DIET_PROMPT, dietForDay, parseDiet } from '../lib/diet'
import { fmt, sum } from '../lib/macros'
import { MEALS, type Diet } from '../types'

export function DietScreen() {
  const diet = useSetting<Diet>('diet')
  if (diet === undefined) return <div className="screen" />
  return <div className="screen">{diet ? <DietView diet={diet} /> : <DietImport />}</div>
}

function DietImport() {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function doImport(source: string) {
    const { diet, errors } = parseDiet(source)
    setErrors(errors)
    if (diet) await setSetting('diet', diet)
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(DIET_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setText(DIET_PROMPT)
    }
  }

  return (
    <>
      <h1 className="page-title">Dieta</h1>
      <section className="card">
        <p>
          Importa la tua dieta in formato JSON: nella schermata “Oggi” i pasti compariranno già pronti e basterà <b>spuntare</b> quello che mangi. I valori usati sono quelli scritti nella dieta.
        </p>
        <div className="row wrap">
          <button className="btn primary" onClick={() => fileRef.current?.click()}>
            📂 Scegli file .json
          </button>
          <button className="btn" onClick={() => doImport(DIET_EXAMPLE)}>
            Prova con l'esempio
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) await doImport(await file.text())
            e.target.value = ''
          }}
        />
      </section>

      <section className="card">
        <h3>Oppure incolla il JSON</h3>
        <textarea rows={7} placeholder='{ "nome": "…", "giorni": { … } }' value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <button className="btn primary" disabled={!text.trim()} onClick={() => doImport(text)}>
          Importa
        </button>
        {errors.length > 0 && (
          <div className="error-box">
            <b>Non riesco a importare la dieta:</b>
            <ul>
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {errors.length > 8 && <small>…e altri {errors.length - 8} errori.</small>}
          </div>
        )}
      </section>

      <section className="card">
        <h3>Hai la dieta in PDF o foto?</h3>
        <p className="muted small">
          Copia questo prompt, incollalo in una chat con un assistente AI (ad es. Claude) insieme alla tua dieta, poi incolla qui sopra il JSON che ti restituisce.
        </p>
        <button className="btn" onClick={copyPrompt}>
          {copied ? 'Copiato ✓' : '📋 Copia il prompt'}
        </button>
        <details>
          <summary>Mostra il formato</summary>
          <pre>{DIET_EXAMPLE}</pre>
        </details>
      </section>
    </>
  )
}

function DietView({ diet }: { diet: Diet }) {
  const [day, setDay] = useState(dayKey(today()))
  const meals = dietForDay(diet, day)
  const flat = meals ? MEALS.flatMap((m) => meals[m.id] ?? []) : []
  const total = sum(flat)

  async function remove() {
    if (confirm('Rimuovere la dieta? Le spunte già fatte nel diario restano.')) {
      await setSetting('diet', null)
    }
  }

  return (
    <>
      <h1 className="page-title">{diet.nome}</h1>
      <div className="day-chips">
        {DAYS.map((d) => (
          <button key={d} className={day === d ? 'chip on' : 'chip'} onClick={() => setDay(d)}>
            {d}
          </button>
        ))}
      </div>

      <section className="card summary-line">
        <b>{DAY_NAMES[day]}</b>
        {meals ? (
          <span>
            {total.kcal} kcal · <MacroLine m={total} />
          </span>
        ) : (
          <span className="muted">nessun pasto previsto</span>
        )}
      </section>

      {meals &&
        MEALS.filter((m) => (meals[m.id] ?? []).length > 0).map((m) => (
          <section key={m.id} className="card meal">
            <div className="meal-head">
              <h3>
                {m.icon} {m.label}
              </h3>
              <span className="meal-kcal">{sum(meals[m.id] ?? []).kcal} kcal</span>
            </div>
            {(meals[m.id] ?? []).map((it, i) => (
              <div key={i} className="row-item static">
                <span className="item-main">
                  <b>{it.alimento}</b>
                  <small>
                    {fmt(it.g)} g · {it.kcal} kcal · <MacroLine m={it} />
                  </small>
                  {it.alternative?.map((a, j) => (
                    <small key={j} className="alt">
                      ⇄ {a.alimento} · {fmt(a.g)} g · {a.kcal} kcal
                    </small>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}

      <button className="btn danger" onClick={remove}>
        Rimuovi dieta
      </button>
    </>
  )
}

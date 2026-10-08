import { useRef, useState } from 'react'
import { FOODS_EXAMPLE, FOODS_PROMPT, importFoods, parseFoods, type ImportResult } from '../lib/foods-io'
import { Sheet } from './ui'

/** Importa una lista di alimenti (JSON) nella rubrica, da file o incollando il testo. */
export function ImportFoods({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function run(source: string) {
    const { foods, errors } = parseFoods(source)
    setErrors(errors)
    setResult(null)
    if (errors.length) return
    setResult(await importFoods(foods, overwrite))
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(FOODS_PROMPT)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setText(FOODS_PROMPT)
    }
  }

  return (
    <Sheet title="Importa alimenti" onClose={onClose}>
      <div className="form">
        <p className="muted small">Aggiungo alla rubrica gli alimenti nuovi e salto quelli che hai già (stesso codice a barre, oppure stesso nome e marca).</p>

        <label className="check-line">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          <span>Se un alimento esiste già con valori diversi, sostituisci i miei</span>
        </label>

        <button className="btn primary" onClick={() => fileRef.current?.click()}>
          📂 Scegli file .json
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) await run(await file.text())
            e.target.value = ''
          }}
        />

        <textarea rows={5} placeholder="…oppure incolla qui il JSON" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <button className="btn" disabled={!text.trim()} onClick={() => run(text)}>
          Importa il testo incollato
        </button>

        {result && (
          <div className="ok-box">
            <b>Fatto ✓</b>
            <ul>
              <li>{result.added} nuovi aggiunti</li>
              {result.updated > 0 && <li>{result.updated} aggiornati</li>}
              {result.same > 0 && <li>{result.same} già presenti, uguali</li>}
              {result.kept > 0 && <li>{result.kept} già presenti con valori diversi: ho tenuto i tuoi</li>}
            </ul>
          </div>
        )}

        {errors.length > 0 && (
          <div className="error-box">
            <b>Non riesco a importare la lista:</b>
            <ul>
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
            {errors.length > 8 && <small>…e altri {errors.length - 8} errori.</small>}
          </div>
        )}

        <details>
          <summary>Come creo la lista con un'AI?</summary>
          <p className="small">Copia il prompt, incollalo in una chat con un assistente AI insieme alla tua dieta (o ai nomi degli alimenti) e importa qui il JSON che ti restituisce.</p>
          <button className="btn" onClick={copyPrompt}>
            {copied ? 'Copiato ✓' : '📋 Copia il prompt'}
          </button>
          <pre>{FOODS_EXAMPLE}</pre>
        </details>
      </div>
    </Sheet>
  )
}

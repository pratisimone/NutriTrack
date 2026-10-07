import { useEffect, useRef, useState } from 'react'

/** Scanner basato su ZXing (funziona anche su Safari/iPhone, dove BarcodeDetector non esiste). */
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const doneRef = useRef(false)
  const [error, setError] = useState('')
  const [manual, setManual] = useState('')

  useEffect(() => {
    let cancelled = false
    let controls: { stop: () => void } | undefined

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('La fotocamera richiede una connessione HTTPS.')
        return
      }
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E])
        hints.set(DecodeHintType.TRY_HARDER, true)
        const reader = new BrowserMultiFormatReader(hints)
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current!,
          (result) => {
            if (result && !doneRef.current) {
              doneRef.current = true
              navigator.vibrate?.(60)
              onDetected(result.getText())
            }
          },
        )
        if (cancelled) c.stop()
        else controls = c
      } catch (e) {
        const name = (e as Error).name
        setError(
          name === 'NotAllowedError'
            ? 'Accesso alla fotocamera negato. Abilitalo da Impostazioni → Safari → Fotocamera.'
            : `Impossibile avviare la fotocamera (${(e as Error).message}).`,
        )
      }
    }
    start()
    return () => {
      cancelled = true
      controls?.stop()
    }
  }, [onDetected])

  return (
    <div className="scanner">
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <div className="scanner-view">
          <video ref={videoRef} playsInline muted autoPlay />
          <div className="scanner-frame" />
        </div>
      )}
      <p className="muted center">Inquadra il codice a barre del prodotto</p>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (manual.trim() && !doneRef.current) {
            doneRef.current = true
            onDetected(manual.trim())
          }
        }}
      >
        <input inputMode="numeric" placeholder="…oppure scrivi il codice" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} />
        <button className="btn" type="submit" disabled={manual.length < 6}>
          Cerca
        </button>
      </form>
    </div>
  )
}

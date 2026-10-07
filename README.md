# NutriTrack

PWA personale per calorie, macro e peso. Dati solo in locale (IndexedDB), nessun backend.

## Sviluppo

```bash
npm install
npm run dev        # http://localhost:5173 (con --host è raggiungibile anche dalla rete locale)
npm run build      # build di produzione in dist/ (include service worker + manifest)
npm run lint
node scripts/make-icons.mjs   # rigenera le icone PWA in public/
```

## Funzioni

- **Oggi**: anello kcal + barre macro, pasti, peso del giorno, navigazione tra i giorni.
- **Aggiungi**: ricerca nella rubrica personale + Open Food Facts, scanner codice a barre (ZXing),
  alimento nuovo con kcal/macro inseriti a mano (per 100 g o per porzione).
- **Dieta**: import JSON (per giorno → pasto → alimenti, con `alternative`). Gli elementi della
  dieta si spuntano e valgono esattamente i valori scritti nel JSON.
- **Progressi**: peso con media mobile 7 giorni, kcal e macro degli ultimi 7 giorni.
- **Altro**: obiettivi, rubrica alimenti, backup/ripristino JSON.

## Formato dieta

Vedi `DIET_EXAMPLE` in `src/lib/diet.ts` (nella schermata Dieta c'è anche un prompt pronto da
dare a un assistente AI per convertire un PDF/foto della dieta in questo JSON).

## Installazione su iPhone

La fotocamera (scanner) e il service worker richiedono **HTTPS**: pubblica `dist/` su un hosting
statico gratuito (Cloudflare Pages, GitHub Pages, Netlify), poi da Safari: Condividi →
"Aggiungi a Home". Dopo l'installazione, usa ogni tanto *Altro → Esporta backup*.

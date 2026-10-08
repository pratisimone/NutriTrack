import { db } from '../db'
import { today } from './dates'

interface BackupFile {
  app: 'nutritrack'
  version: 1
  exportedAt: string
  foods: unknown[]
  entries: unknown[]
  weights: unknown[]
  settings: unknown[]
}

export async function exportBackup(): Promise<void> {
  const data: BackupFile = {
    app: 'nutritrack',
    version: 1,
    exportedAt: new Date().toISOString(),
    foods: await db.foods.toArray(),
    entries: await db.entries.toArray(),
    weights: await db.weights.toArray(),
    settings: await db.settings.toArray(),
  }
  await saveJsonFile(`nutritrack-backup-${today()}.json`, JSON.stringify(data), 'Backup NutriTrack')
}

/** Su iPhone apre il foglio di condivisione (File, AirDrop, WhatsApp…), altrove scarica il file. */
export async function saveJsonFile(fileName: string, json: string, title: string): Promise<void> {
  const blob = new Blob([json], { type: 'application/json' })
  const file = new File([blob], fileName, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function importBackup(text: string): Promise<void> {
  const data = JSON.parse(text) as Partial<BackupFile>
  if (data.app !== 'nutritrack' || !Array.isArray(data.entries)) throw new Error('Non è un backup di NutriTrack')
  await db.transaction('rw', db.foods, db.entries, db.weights, db.settings, async () => {
    await Promise.all([db.foods.clear(), db.entries.clear(), db.weights.clear(), db.settings.clear()])
    await db.foods.bulkAdd((data.foods ?? []) as never[])
    await db.entries.bulkAdd(data.entries as never[])
    await db.weights.bulkAdd((data.weights ?? []) as never[])
    await db.settings.bulkAdd((data.settings ?? []) as never[])
  })
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', db.foods, db.entries, db.weights, db.settings, async () => {
    await Promise.all([db.foods.clear(), db.entries.clear(), db.weights.clear(), db.settings.clear()])
  })
}

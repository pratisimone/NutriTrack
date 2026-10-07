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
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const file = new File([blob], `nutritrack-backup-${today()}.json`, { type: 'application/json' })
  // Su iPhone il foglio di condivisione permette "Salva su File" / AirDrop / Drive
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup NutriTrack' })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
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

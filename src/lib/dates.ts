const DAY_KEYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'] as const

export const DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const

export const DAY_NAMES: Record<string, string> = {
  lun: 'Lunedì',
  mar: 'Martedì',
  mer: 'Mercoledì',
  gio: 'Giovedì',
  ven: 'Venerdì',
  sab: 'Sabato',
  dom: 'Domenica',
}

export function toISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toISO(new Date())

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function dayKey(iso: string): string {
  return DAY_KEYS[fromISO(iso).getDay()]
}

export function dayLabel(iso: string): string {
  const t = today()
  if (iso === t) return 'Oggi'
  if (iso === addDays(t, -1)) return 'Ieri'
  if (iso === addDays(t, 1)) return 'Domani'
  return DAY_NAMES[dayKey(iso)]
}

export function dateLong(iso: string): string {
  return fromISO(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

export function shortDate(iso: string): string {
  return fromISO(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

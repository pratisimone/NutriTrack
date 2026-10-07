import type { ReactNode } from 'react'
import type { Macros } from '../types'
import { fmt } from '../lib/macros'

export function Sheet({ title, onClose, children, full }: { title: string; onClose: () => void; children: ReactNode; full?: boolean }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={full ? 'sheet full' : 'sheet'} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function Ring({ eaten, target }: { eaten: number; target: number }) {
  const size = 200
  const stroke = 16
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  const over = eaten > target
  const left = Math.round(target - eaten)
  return (
    <div className="ring">
      <svg viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
          <linearGradient id="rg-over" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f87171" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'url(#rg-over)' : 'url(#rg)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circ * pct} ${circ}`}
          opacity={pct > 0 ? 1 : 0}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray .4s ease' }}
        />
      </svg>
      <div className="ring-center">
        <div className={over ? 'ring-num over' : 'ring-num'}>{Math.abs(left)}</div>
        <div className="ring-label">{over ? 'kcal oltre' : 'kcal rimaste'}</div>
        <div className="ring-sub">
          {Math.round(eaten)} / {Math.round(target)}
        </div>
      </div>
    </div>
  )
}

const BARS: { key: 'p' | 'c' | 'f'; label: string; color: string }[] = [
  { key: 'p', label: 'Proteine', color: 'var(--p)' },
  { key: 'c', label: 'Carboidrati', color: 'var(--c)' },
  { key: 'f', label: 'Grassi', color: 'var(--f)' },
]

export function MacroBars({ eaten, target }: { eaten: Macros; target: Macros }) {
  return (
    <div className="macro-bars">
      {BARS.map((b) => {
        const pct = target[b.key] > 0 ? Math.min((eaten[b.key] / target[b.key]) * 100, 100) : 0
        return (
          <div key={b.key} className="macro-bar">
            <div className="macro-bar-top">
              <span>{b.label}</span>
              <b>
                {fmt(Math.round(eaten[b.key]))}
                <small> / {fmt(Math.round(target[b.key]))} g</small>
              </b>
            </div>
            <div className="track">
              <div className="fill" style={{ width: `${pct}%`, background: b.color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function MacroLine({ m }: { m: Macros }) {
  return (
    <span className="macro-line">
      <i style={{ color: 'var(--p)' }}>P {fmt(m.p)}</i>
      <i style={{ color: 'var(--c)' }}>C {fmt(m.c)}</i>
      <i style={{ color: 'var(--f)' }}>G {fmt(m.f)}</i>
    </span>
  )
}

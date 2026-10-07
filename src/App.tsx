import { lazy, Suspense, useState, type ReactNode } from 'react'
import { DietScreen } from './screens/DietScreen'
import { More } from './screens/More'
import { Today } from './screens/Today'

// i grafici pesano: si caricano solo quando apri "Progressi"
const Progress = lazy(() => import('./screens/Progress').then((m) => ({ default: m.Progress })))

type Tab = 'today' | 'progress' | 'diet' | 'more'

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'today',
    label: 'Oggi',
    icon: (
      <Icon>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </Icon>
    ),
  },
  {
    id: 'progress',
    label: 'Progressi',
    icon: (
      <Icon>
        <path d="M3 17l5-6 4 3 8-9" />
        <path d="M15 5h5v5" />
      </Icon>
    ),
  },
  {
    id: 'diet',
    label: 'Dieta',
    icon: (
      <Icon>
        <rect x="5" y="4" width="14" height="17" rx="3" />
        <path d="M9 4h6v3H9zM9 12h6M9 16h4" />
      </Icon>
    ),
  },
  {
    id: 'more',
    label: 'Altro',
    icon: (
      <Icon>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </Icon>
    ),
  },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  return (
    <div className="app">
      <main>
        {tab === 'today' && <Today />}
        {tab === 'progress' && (
          <Suspense fallback={<div className="screen" />}>
            <Progress />
          </Suspense>
        )}
        {tab === 'diet' && <DietScreen />}
        {tab === 'more' && <More />}
      </main>
      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

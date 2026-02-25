import { useState, ReactNode } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

interface Props {
  title: string
  count: number
  children: ReactNode
  icon?: ReactNode
  defaultOpen?: boolean
}

export function LogAccordion({ title, count, children, icon, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="log-accordion">
      <button
        className={`accordion-header ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="accordion-chevron">
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        {icon && <span style={{ color: 'var(--zinc-500)', display: 'flex', alignItems: 'center' }}>{icon}</span>}
        <span className="accordion-title">{title}</span>
        <span className="accordion-count">{count}</span>
      </button>
      {isOpen && (
        <div className="accordion-content">
          {children}
        </div>
      )}
    </div>
  )
}

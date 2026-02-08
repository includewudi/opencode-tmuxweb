import { useState } from 'react'

interface Props {
  title: string
  count: number
  children: React.ReactNode
  defaultOpen?: boolean
}

export function LogAccordion({ title, count, children, defaultOpen = false }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="log-accordion">
      <button
        className={`accordion-header ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        <span className="accordion-chevron">{isOpen ? '▼' : '▶'}</span>
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

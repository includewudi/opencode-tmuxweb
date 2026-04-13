import { Component, ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?(error: Error, errorInfo: ErrorInfo): void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{
          padding: '12px 16px',
          margin: 8,
          borderRadius: 8,
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          fontSize: 12,
          fontFamily: 'monospace',
          maxWidth: 480,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ 组件渲染错误</div>
          <div style={{ opacity: 0.7, wordBreak: 'break-all' }}>{this.state.error?.message}</div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8,
              padding: '2px 10px',
              borderRadius: 4,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: 'transparent',
              color: '#fca5a5',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

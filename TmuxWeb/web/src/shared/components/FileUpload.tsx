import { useState, useCallback, useRef } from 'react'
import { Upload, X, Copy, Check, FileText, File, TerminalSquare } from 'lucide-react'

interface UploadResult {
  filename: string
  originalname: string
  size: number
  mimetype: string
  url: string
  path: string
}

interface FileUploadProps {
  onUploaded?: (result: UploadResult) => void
  onSend?: (text: string) => void
  compact?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function isImage(mimetype: string): boolean {
  return mimetype.startsWith('image/')
}

export function FileUpload({ onUploaded, onSend, compact }: FileUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UploadResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [sentIdx, setSentIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCountRef = useRef(0)

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      if (fileArray.length === 1) {
        formData.append('file', fileArray[0])
        const res = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message || `Upload failed (${res.status})`)
        }
        const data = await res.json()
        setResults(prev => [data, ...prev])
        onUploaded?.(data)
      } else {
        for (const f of fileArray) formData.append('files', f)
        const res = await fetch('/api/upload/multi', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.message || `Upload failed (${res.status})`)
        }
        const data = await res.json()
        setResults(prev => [...data.files, ...prev])
        data.files.forEach((f: UploadResult) => onUploaded?.(f))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [onUploaded])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current++
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current--
    if (dragCountRef.current === 0) setDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCountRef.current = 0
    setDragging(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }, [uploadFiles])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
      e.target.value = ''
    }
  }, [uploadFiles])

  const copyPath = useCallback((path: string, idx: number) => {
    navigator.clipboard.writeText(path).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
    })
  }, [])

  const removeResult = useCallback((idx: number) => {
    setResults(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const sendPath = useCallback((serverPath: string, idx: number) => {
    onSend?.(serverPath)
    setSentIdx(idx)
    setTimeout(() => setSentIdx(null), 1500)
  }, [onSend])

  return (
    <div className="file-upload">
      <div
        className={`file-upload-zone${dragging ? ' dragging' : ''}${uploading ? ' uploading' : ''}${compact ? ' compact' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        {uploading ? (
          <div className="file-upload-status">
            <div className="file-upload-spinner" />
            <span>Uploading...</span>
          </div>
        ) : (
          <div className="file-upload-status">
            <Upload size={compact ? 16 : 20} />
            <span>{dragging ? 'Drop files here' : 'Drop files or click to browse'}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="file-upload-error">
          {error}
          <button onClick={() => setError(null)}><X size={12} /></button>
        </div>
      )}

      {results.length > 0 && (
        <div className="file-upload-results">
          {results.map((r, i) => {
            const imgUrl = r.url
            const label = isImage(r.mimetype)
              ? `image ${results.length - i}`
              : r.originalname
            return (
              <div key={`${r.filename}-${i}`} className={`file-upload-card${isImage(r.mimetype) ? ' is-image' : ''}`}>
                {isImage(r.mimetype) ? (
                  <div className="file-upload-thumb">
                    <img src={imgUrl} alt={label} />
                  </div>
                ) : (
                  <div className="file-upload-file-icon">
                    {r.mimetype.includes('pdf') || r.mimetype.includes('text')
                      ? <FileText size={24} />
                      : <File size={24} />}
                  </div>
                )}
                <div className="file-upload-card-body">
                  <div className="file-upload-card-label">
                    <span className="file-upload-card-name" title={r.originalname}>{label}</span>
                    <span className="file-upload-card-size">{formatSize(r.size)}</span>
                  </div>
                  <div className="file-upload-card-actions">
                    {onSend && (
                      <button
                        className="file-upload-send"
                        onClick={() => sendPath(r.path, i)}
                        title={r.path}
                      >
                        {sentIdx === i ? <Check size={12} /> : <TerminalSquare size={12} />}
                        <span>终端</span>
                      </button>
                    )}
                    <button
                      className="file-upload-copy"
                      onClick={() => copyPath(r.path, i)}
                      title={r.path}
                    >
                      {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />}
                      <span>路径</span>
                    </button>
                    <button
                      className="file-upload-copy"
                      onClick={() => copyPath(r.url, i + 1000)}
                      title={r.url}
                    >
                      {copiedIdx === i + 1000 ? <Check size={12} /> : <Copy size={12} />}
                      <span>URL</span>
                    </button>
                    <button
                      className="file-upload-remove"
                      onClick={() => removeResult(i)}
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

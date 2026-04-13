export interface FileEntry {
  name: string
  type: 'file' | 'dir'
  size?: number
  mtime?: string
  git?: 'modified' | 'staged' | 'untracked' | 'conflicted' | 'ignored'
}

export interface ContextMenuState {
  x: number
  y: number
  entry: FileEntry
  dirPath: string
}

export function formatSize(bytes?: number): string {
  if (bytes == null) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

export function sortByFoldersFirst(entries: FileEntry[]): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function joinPath(base: string, name: string): string {
  if (base === '/') return '/' + name
  if (base === '~') return '~/' + name
  return base + '/' + name
}

export function getFileExtension(filePath: string): string {
  const dotIndex = filePath.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return filePath.slice(dotIndex + 1).toLowerCase()
}

const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const videoExts = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv'])
const docExts = new Set(['pdf'])

export function isImageFile(filePath: string): boolean {
  return imageExts.has(getFileExtension(filePath))
}

export function isVideoFile(filePath: string): boolean {
  return videoExts.has(getFileExtension(filePath))
}

export function isDocFile(filePath: string): boolean {
  return docExts.has(getFileExtension(filePath))
}

export function isMediaFile(filePath: string): boolean {
  return isImageFile(filePath) || isVideoFile(filePath) || isDocFile(filePath)
}

export interface FileEntry {
  name: string
  type: 'file' | 'dir'
  size?: number
  mtime?: string
  git?: 'modified' | 'staged' | 'untracked'
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
  return base === '/' ? '/' + name : base + '/' + name
}

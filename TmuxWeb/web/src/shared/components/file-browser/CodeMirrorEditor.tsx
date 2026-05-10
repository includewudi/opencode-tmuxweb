import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, highlightSpecialChars } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput, foldKeymap } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { php } from '@codemirror/lang-php'

interface Props {
  value: string
  filePath: string
  onChange: (value: string) => void
  onSave?: () => void
  readOnly?: boolean
}

const langMap: Record<string, ReturnType<typeof javascript> | null> = {
  '.js': javascript({ jsx: true }),
  '.jsx': javascript({ jsx: true }),
  '.ts': javascript({ jsx: true, typescript: true }),
  '.tsx': javascript({ jsx: true, typescript: true }),
  '.mjs': javascript({ jsx: false }),
  '.cjs': javascript({ jsx: false }),
  '.py': python(),
  '.css': css(),
  '.scss': css(),
  '.html': html(),
  '.htm': html(),
  '.json': json(),
  '.md': markdown(),
  '.php': php(),
  '.sh': null,
  '.bash': null,
  '.yml': null,
  '.yaml': null,
  '.toml': null,
  '.sql': null,
  '.txt': null,
  '.log': null,
}

function getLangExtension(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return langMap['.' + ext] || null
}

const readOnlyCompartment = new Compartment()
const langCompartment = new Compartment()

export function CodeMirrorEditor({ value, filePath, onChange, onSave, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)

  onChangeRef.current = onChange
  onSaveRef.current = onSave

  const valueRef = useRef(value)
  if (value !== valueRef.current) {
    valueRef.current = value
    if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value }
      })
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    const langExt = getLangExtension(filePath)
    const langExtensions = langExt ? [langCompartment.of(langExt)] : [langCompartment.of([])]

    const saveKeymap = onSave ? keymap.of([
      {
        key: 'Mod-s',
        run: () => { onSaveRef.current?.(); return true }
      }
    ]) : []

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        saveKeymap,
        readOnlyCompartment.of(readOnly ? [EditorState.readOnly.of(true)] : []),
        ...langExtensions,
        oneDark,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-content': { fontFamily: 'var(--wfb-font-mono, "SF Mono", Menlo, monospace)', padding: '4px 0' },
          '.cm-gutters': { borderRight: '1px solid rgba(255,255,255,0.06)', background: 'transparent' },
          '.cm-activeLineGutter': { background: 'rgba(255,255,255,0.03)' },
          '.cm-gutter-lint': { width: '0' },
          '.cm-panel.cm-search': {
            background: 'rgba(30,30,35,0.97)',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '4px 8px',
            fontSize: '12px',
          },
          '.cm-panel.cm-search input': {
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '3px',
            color: '#e4e4e7',
            padding: '2px 6px',
            fontSize: '12px',
          },
          '.cm-panel.cm-search button, .cm-panel.cm-search label': {
            color: '#a1a1aa',
            fontSize: '12px',
          },
          '.cm-panel.cm-search button:hover': { background: 'rgba(255,255,255,0.08)' },
          '.cm-searchMatch': { background: 'rgba(250,204,21,0.2)' },
          '.cm-searchMatch-selected': { background: 'rgba(250,204,21,0.4)' },
          '&.cm-focused .cm-cursor': { borderLeftColor: '#60a5fa' },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
            background: 'rgba(96,165,250,0.2) !important',
          },
          '.cm-panels': { backgroundColor: 'transparent' },
          '.cm-panels input': { color: '#e4e4e7' },
        }),
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, readOnly])

  return <div ref={containerRef} className="wfb-cm-editor" />
}

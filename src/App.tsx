
import { useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import './App.css'
import { ExecutionWorkerClient } from './engine/worker/ExecutionWorkerClient'
import type { ProgramExecutionResult } from './engine/execution/types'
import { ExecutionTimeline } from './components/ExecutionTimeline'
import type {
  ExecutionSnapshot,
  RuntimeValueSnapshot,
} from './engine/trace/types'

const initialCode = `let score = 10
let bonus = 5

function calculateTotal(a, b) {
  let total = a + b
  return total
}

let result = calculateTotal(score, bonus)
console.log(result)`

type CodeEditorPanelProps = {
  code: string
  onCodeChange: (value: string) => void
  highlightedLine: number | null
}

type HeaderProps = {
  isRunning: boolean
  onRun: () => void
  onReset: () => void
}

function Header({ isRunning, onRun, onReset }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">T</div>
        <div>
          <h1>TraceFlow</h1>
          <p>JavaScript execution visualizer</p>
        </div>
      </div>

      <div className="header-actions">
        <span className="file-name">untitled.js</span>

        <button
          className="button button-secondary"
          type="button"
          onClick={onReset}
          disabled={isRunning}
        >
          Reset
        </button>

        <button
          className="button button-primary"
          type="button"
          onClick={onRun}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : '▶ Run'}
        </button>
      </div>
    </header>
  )
}


function CodeEditorPanel({
  code,
  onCodeChange,
  highlightedLine,
}: CodeEditorPanelProps) {
  const lineCount = code.split('\n').length

  const [editorInstance, setEditorInstance] =
    useState<editor.IStandaloneCodeEditor | null>(null)

  const decorationIdsRef = useRef<string[]>([])

  const handleEditorMount: OnMount = (editor) => {
    setEditorInstance(editor)
  }

useEffect(() => {
  if (!editorInstance) return

  const newDecorations: editor.IModelDeltaDecoration[] =
    highlightedLine === null
      ? []
      : [
          {
            range: {
              startLineNumber: highlightedLine,
              startColumn: 1,
              endLineNumber: highlightedLine,
              endColumn: 1,
            },
            options: {
              isWholeLine: true,
              className: 'execution-line-highlight',
              glyphMarginClassName: 'execution-line-glyph',
            },
          },
        ]

  decorationIdsRef.current = editorInstance.deltaDecorations(
    decorationIdsRef.current,
    newDecorations,
  )

  if (highlightedLine !== null) {
    editorInstance.revealLineInCenter(highlightedLine)
  }
}, [highlightedLine, editorInstance])

  return (
    <section className="panel editor-panel">
      <div className="panel-header">
        <h2>Code editor</h2>
        <span className="panel-label">JavaScript</span>
      </div>

      <div className="editor-content">
        <div className="monaco-container">
          <Editor
            height="100%"
            language="javascript"
            theme="vs-dark"
            value={code}
            onMount={handleEditorMount}
            onChange={(value) => onCodeChange(value ?? '')}
            options={{
              ariaLabel: 'JavaScript code editor',
              automaticLayout: true,
              fontSize: 13,
              fontFamily: "Consolas, 'Courier New', monospace",
              lineNumbers: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              tabSize: 2,
              wordWrap: 'off',
              padding: {
                top: 14,
                bottom: 14,
              },
              glyphMargin: true,
            }}
          />
        </div>
      </div>

      <div className="panel-footer">
        <span>JavaScript</span>
        <span>{lineCount} lines</span>
      </div>
    </section>
  )
}


type ExecutionPanelProps = {
  events: import('./engine/trace/types').ExecutionEvent[]
  selectedIndex: number
  onSelect: (index: number) => void
  onPrevious: () => void
  onNext: () => void
}

function ExecutionPanel({
  events,
  selectedIndex,
  onSelect,
  onPrevious,
  onNext,
}: ExecutionPanelProps) {
  return (
    <section className="panel execution-panel">
      <div className="panel-header">
        <h2>Execution trace</h2>
        <span className="status-badge">
          {events.length > 0 ? 'Completed' : 'Not started'}
        </span>
      </div>

      <ExecutionTimeline
        events={events}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
      />

      <div className="timeline-controls">
        <button
          type="button"
          onClick={onPrevious}
          disabled={selectedIndex <= 0 || events.length === 0}
          aria-label="Previous step"
        >
          ◀
        </button>

        <span>
          Step {events.length > 0 ? selectedIndex + 1 : 0} of {events.length}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={selectedIndex >= events.length - 1 || events.length === 0}
          aria-label="Next step"
        >
          ▶
        </button>
      </div>
    </section>
  )
}



type VariablesPanelProps = {
  snapshots: ExecutionSnapshot[]
  selectedEventIndex: number
}

function formatRuntimeValue(value: RuntimeValueSnapshot): string {
  switch (value.type) {
    case 'string':
      return `"${value.value}"`

    case 'number':
    case 'boolean':
      return String(value.value)

    case 'null':
      return 'null'

    case 'undefined':
      return 'undefined'

    case 'function':
      return `ƒ ${value.name}`
  }
}

function getScopeDepth(
  scopeId: number,
  scopes: ExecutionSnapshot['scopes'],
): number {
  const scope = scopes.find((item) => item.scopeId === scopeId)

  if (!scope) return 0

  let depth = 0
  let parentId = scope.parentScopeId

  while (parentId !== null) {
    depth += 1

    const parent = scopes.find(
      (item) => item.scopeId === parentId,
    )

    if (!parent) break

    parentId = parent.parentScopeId
  }

  return depth
}

function VariablesPanel({
  snapshots,
  selectedEventIndex,
}: VariablesPanelProps) {
  const currentSnapshot = snapshots.find(
    (snapshot) => snapshot.eventIndex === selectedEventIndex,
  )

  return (
    <section className="panel variables-panel">
      <div className="panel-header">
        <h2>Variables</h2>
        <span className="panel-label">
          {currentSnapshot ? 'Historical state' : 'No state'}
        </span>
      </div>

      {!currentSnapshot ? (
        <div className="empty-state compact">
          <p>
            Run your code and select an execution event
            to inspect variables.
          </p>
        </div>
      ) : (
        <div className="variables-content">
          {currentSnapshot.scopes.length === 0 ? (
            <div className="empty-state compact">
              <p>No variables in this execution state.</p>
            </div>
          ) : (
            currentSnapshot.scopes.map((scope) => (
              <div
                className="scope-group"
                key={scope.scopeId}
                style={{
                  '--scope-depth': getScopeDepth(
                    scope.scopeId,
                    currentSnapshot.scopes,
                  ),
                } as React.CSSProperties}
              >
                <div className="scope-heading">
                  {scope.type === 'global'
                    ? 'Global Scope'
                    : scope.type === 'function'
                      ? `Function Scope — ${scope.name}`
                      : scope.type === 'loop'
                        ? `Loop Scope — ${scope.name}`
                        : 'Block Scope'}
                </div>
                {scope.bindings.length === 0 ? (
                  <p className="scope-empty">No bindings</p>
                ) : (
                  scope.bindings.map((binding) => (
                    <div
                      className="variable-row"
                      key={`${scope.scopeId}-${binding.name}`}
                    >
                      <div className="variable-info">
                        <span className="variable-name">
                          {binding.name}
                        </span>

                        <span className="variable-kind">
                          {binding.kind}
                        </span>
                      </div>

                      <span className="variable-value">
                        {!binding.initialized
                          ? '<uninitialized>'
                          : binding.value
                            ? formatRuntimeValue(binding.value)
                            : '<no value>'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      )}
    </section>
  )
}



type OutputPanelProps = {
  result: ProgramExecutionResult | null
}


function formatOutputValue(value: {
  type: string
  value?: string | number | boolean | null
}): string {
  if (value.type === 'undefined') {
    return 'undefined'
  }

  if (value.type === 'null') {
    return 'null'
  }

  if (value.type === 'string') {
    return String(value.value)
  }

  return String(value.value)
}

function OutputPanel({ result }: OutputPanelProps) {
  let status = 'Waiting for execution...'

  if (result?.ok === true) {
    status = 'Execution completed successfully.'
  } else if (result?.ok === false) {
    status = `Execution failed (${result.error.phase}): ${result.error.message}`
  }

  return (
    <section className="panel output-panel">
      <div className="panel-header">
        <h2>Output</h2>
        <span className="panel-label">Console</span>
      </div>

      <div className="output-content">
        {result === null ? (
          <span className="output-message">{status}</span>
        ) : (
          <>
            {result.output.map((entry) => (
              <div className="output-line" key={entry.index}>
                <span className="output-prompt">&gt;</span>

                <span>
                  {entry.values
                    .map(formatOutputValue)
                    .join(' ')}
                </span>
              </div>
            ))}

            <div className="output-status">
              {status}
            </div>
          </>
        )}
      </div>
    </section>
  )
}



function App() {
  const [code, setCode] = useState<string>(initialCode)
  const [executionResult, setExecutionResult] =
    useState<ProgramExecutionResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [selectedEventIndex, setSelectedEventIndex] = useState(0)

  const events = executionResult?.events ?? []

  const selectedEvent = events.find(
    (event) => event.index === selectedEventIndex,
  )

  const highlightedLine = selectedEvent?.location?.line ?? null

  const workerClient = useMemo(
    () => new ExecutionWorkerClient(),
    [],
  )

  useEffect(() => {
    return () => {
      workerClient.terminate()
    }
  }, [workerClient])


  const handleRun = async () => {
    setIsRunning(true)
    setExecutionResult(null)
    setSelectedEventIndex(0)

    try {
      const result = await workerClient.run(code)
      setExecutionResult(result)
    } catch (error: unknown) {
      console.error('Worker execution failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const handleReset = () => {
    workerClient.terminate()
    setCode(initialCode)
    setExecutionResult(null)
    setSelectedEventIndex(0)
    setIsRunning(false)
  }

  const handlePreviousStep = () => {
  setSelectedEventIndex((current) => Math.max(0, current - 1))
}

const handleNextStep = () => {
  setSelectedEventIndex((current) =>
    Math.min(events.length - 1, current + 1),
  )
}

  return (
    <div className="app-shell">
      <Header
        isRunning={isRunning}
        onRun={handleRun}
        onReset={handleReset}
      />

      <main className="workspace">
        <div className="left-column">
          <CodeEditorPanel
            code={code}
            onCodeChange={setCode}
            highlightedLine={highlightedLine}
          />
          <OutputPanel result={executionResult} />
        </div>

        <div className="right-column">
          <ExecutionPanel
            events={events}
            selectedIndex={selectedEventIndex}
            onSelect={setSelectedEventIndex}
            onPrevious={handlePreviousStep}
            onNext={handleNextStep}
          />

          <VariablesPanel
            snapshots={executionResult?.snapshots ?? []}
            selectedEventIndex={selectedEventIndex}
          />
        </div>
      </main>

      <footer className="app-footer">
        <span>TraceFlow</span>
        <span>JavaScript visualizer · Early development</span>
      </footer>
    </div>
  )
}

export default App


import { useState } from 'react'
import Editor from '@monaco-editor/react'
import './App.css'

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
}

function Header() {
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
        <button className="button button-secondary" type="button" disabled>
          Reset
        </button>
        <button className="button button-primary" type="button" disabled>
          ▶ Run
        </button>
      </div>
    </header>
  )
}

function CodeEditorPanel({ code, onCodeChange }: CodeEditorPanelProps) {
  const lineCount = code.split('\n').length

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

function ExecutionPanel() {
  return (
    <section className="panel execution-panel">
      <div className="panel-header">
        <h2>Execution trace</h2>
        <span className="status-badge">Not started</span>
      </div>

      <div className="empty-state">
        <div className="empty-icon">▷</div>
        <h3>No execution yet</h3>
        <p>Run your JavaScript code to see its execution step by step.</p>
      </div>

      <div className="timeline-controls">
        <button type="button" disabled aria-label="Previous step">◀</button>
        <span>Step 0 of 0</span>
        <button type="button" disabled aria-label="Next step">▶</button>
      </div>
    </section>
  )
}

function VariablesPanel() {
  return (
    <section className="panel variables-panel">
      <div className="panel-header">
        <h2>Variables</h2>
        <span className="panel-label">Current state</span>
      </div>

      <div className="empty-state compact">
        <p>Variables will appear here during execution.</p>
      </div>
    </section>
  )
}

function OutputPanel() {
  return (
    <section className="panel output-panel">
      <div className="panel-header">
        <h2>Output</h2>
        <span className="panel-label">Console</span>
      </div>

      <div className="output-content">
        <span className="output-prompt">&gt;</span>
        <span>Waiting for execution...</span>
      </div>
    </section>
  )
}

function App() {
  const [code, setCode] = useState<string>(initialCode)

  return (
    <div className="app-shell">
      <Header />

      <main className="workspace">
        <div className="left-column">
          <CodeEditorPanel
            code={code}
            onCodeChange={setCode}
          />
          <OutputPanel />
        </div>

        <div className="right-column">
          <ExecutionPanel />
          <VariablesPanel />
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

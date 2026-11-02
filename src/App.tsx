
import './App.css'

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

function CodeEditorPanel() {
  const sampleCode = [
    'let score = 10',
    'let bonus = 5',
    '',
    'function calculateTotal(a, b) {',
    '  let total = a + b',
    '  return total',
    '}',
    '',
    'let result = calculateTotal(score, bonus)',
    'console.log(result)',
  ]

  return (
    <section className="panel editor-panel">
      <div className="panel-header">
        <h2>Code editor</h2>
        <span className="panel-label">JavaScript</span>
      </div>

      <div className="editor-content">
        <div className="line-numbers" aria-hidden="true">
          {sampleCode.map((_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>

        <pre className="code-content">
          <code>{sampleCode.join('\n')}</code>
        </pre>
      </div>

      <div className="panel-footer">
        <span>JavaScript</span>
        <span>10 lines</span>
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
  return (
    <div className="app-shell">
      <Header />

      <main className="workspace">
        <div className="left-column">
          <CodeEditorPanel />
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

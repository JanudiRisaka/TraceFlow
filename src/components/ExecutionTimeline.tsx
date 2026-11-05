
import type { ExecutionEvent, RuntimeValueSnapshot } from '../engine/trace/types'

type ExecutionTimelineProps = {
  events: ExecutionEvent[]
  selectedIndex: number
  onSelect: (index: number) => void
}

function formatValue(value: RuntimeValueSnapshot): string {
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
      return `Function: ${value.name}`
  }
}

function describeEvent(event: ExecutionEvent): string {
  switch (event.type) {
    case 'program-start':
      return 'Program started'

    case 'variable-declared':
      return `Variable declared: ${event.kind} ${event.name}`

    case 'variable-initialized':
      return `Variable initialized: ${event.name} = ${formatValue(event.value)}`

    case 'variable-assigned':
      return `${event.name} changed from ${formatValue(event.previousValue)} to ${formatValue(event.newValue)}`

    case 'branch-taken':
      return `Branch taken: ${event.branch}`

    case 'loop-iteration':
      return `Loop iteration: ${event.iteration}`

    case 'function-call':
      return `Function called: ${event.functionName}`

    case 'function-return':
      return `Function returned: ${formatValue(event.value)}`

    case 'console-output':
      return `Console output: ${event.values.map(formatValue).join(' ')}`

    case 'execution-error':
      return `Execution error: ${event.message}`

    case 'program-complete':
      return 'Program completed'
  }
}

export function ExecutionTimeline({
  events,
  selectedIndex,
  onSelect,
}: ExecutionTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">▷</div>
        <h3>No execution yet</h3>
        <p>Run your JavaScript code to see its execution step by step.</p>
      </div>
    )
  }

  return (
    <div className="execution-timeline">
      {events.map((event) => (
        <button
          key={event.index}
          type="button"
          className={`timeline-event ${
            event.index === selectedIndex ? 'selected' : ''
          }`}
          onClick={() => onSelect(event.index)}
        >
          <span className="timeline-marker" />
          <span className="timeline-event-content">
            <span className="timeline-event-title">
              {describeEvent(event)}
            </span>
            <span className="timeline-event-meta">
              Step {event.index + 1}
              {event.location
                ? ` · Line ${event.location.line}`
                : ''}
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

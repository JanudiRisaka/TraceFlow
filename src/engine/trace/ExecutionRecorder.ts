
import type {
  ExecutionEvent,
} from './types'

import type { RuntimeValue } from '../runtime/value'

import type { RuntimeValueSnapshot } from './types'

// Remove the index from event inputs.
// The recorder assigns the index automatically.
export type ExecutionEventInput =
  ExecutionEvent extends infer Event
    ? Event extends ExecutionEvent
      ? Omit<Event, 'index'>
      : never
    : never


function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  Object.freeze(value)

  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue)
  }

  return value
}

export class ExecutionRecorder {
  private events: ExecutionEvent[] = []

    record(event: ExecutionEventInput): ExecutionEvent {
  const recordedEvent = deepFreeze({
    ...event,
    location:
      event.location === null
        ? null
        : { ...event.location },
    index: this.events.length,
  }) as ExecutionEvent

  this.events.push(recordedEvent)

  return recordedEvent
}

  getEvents(): ExecutionEvent[] {
    return [...this.events]
  }

  clear(): void {
    this.events = []
  }
}

// Convert interpreter values into serializable trace values.
export function toRuntimeValueSnapshot(
  value: RuntimeValue,
): RuntimeValueSnapshot {
  switch (value.type) {
    case 'number':
      return { type: 'number', value: value.value }

    case 'string':
      return { type: 'string', value: value.value }

    case 'boolean':
      return { type: 'boolean', value: value.value }

    case 'null':
      return { type: 'null' }

    case 'undefined':
      return { type: 'undefined' }

    case 'function':
      return {
        type: 'function',
        name: value.declaration.id?.name ?? '<anonymous>',
      }
  }
}

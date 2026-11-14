
import { describe, expect, it } from 'vitest'
import { createNumber, createString, createUndefined } from '../runtime/value'
import {
  ExecutionRecorder,
  toRuntimeValueSnapshot,
} from './ExecutionRecorder'
import { RESOURCE_LIMITS } from '../resourceLimits'
import { ResourceLimitError } from '../ResourceLimitError'

describe('ExecutionRecorder', () => {
  it('records an event with an automatically assigned index', () => {
    const recorder = new ExecutionRecorder()

    const event = recorder.record({
      type: 'program-start',
      location: null,
    })

    expect(event.index).toBe(0)
  })

  it('assigns sequential indices to events', () => {
    const recorder = new ExecutionRecorder()

    const first = recorder.record({
      type: 'program-start',
      location: null,
    })

    const second = recorder.record({
      type: 'program-complete',
      location: null,
    })

    expect(first.index).toBe(0)
    expect(second.index).toBe(1)
  })

  it('returns all recorded events', () => {
    const recorder = new ExecutionRecorder()

    recorder.record({
      type: 'program-start',
      location: null,
    })

    recorder.record({
      type: 'program-complete',
      location: null,
    })

    expect(recorder.getEvents()).toHaveLength(2)
  })

  it('returns a copy of the event array', () => {
    const recorder = new ExecutionRecorder()

    recorder.record({
      type: 'program-start',
      location: null,
    })

    const events = recorder.getEvents()
    events.pop()

    expect(recorder.getEvents()).toHaveLength(1)
  })

  it('clears recorded events and resets indexing', () => {
    const recorder = new ExecutionRecorder()

    recorder.record({
      type: 'program-start',
      location: null,
    })

    recorder.clear()

    const event = recorder.record({
      type: 'program-complete',
      location: null,
    })

    expect(event.index).toBe(0)
    expect(recorder.getEvents()).toHaveLength(1)
  })

  it('preserves source locations', () => {
    const recorder = new ExecutionRecorder()

    const event = recorder.record({
      type: 'program-start',
      location: {
        start: 0,
        end: 10,
        line: 1,
        column: 1,
      },
    })

    expect(event.location).toEqual({
      start: 0,
      end: 10,
      line: 1,
      column: 1,
    })
  })

  it('does not freeze or share caller-owned runtime snapshots', () => {
    const recorder = new ExecutionRecorder()

    const value = {
      type: 'number' as const,
      value: 10,
    }

    recorder.record({
      type: 'variable-initialized',
      name: 'score',
      value,
      location: null,
    })

    // The caller's object should remain mutable.
    expect(Object.isFrozen(value)).toBe(false)

    // Modify the caller's original object.
    value.value = 20

    // The recorded history must retain the original value.
    expect(recorder.getEvents()[0]).toMatchObject({
      type: 'variable-initialized',
      name: 'score',
      value: {
        type: 'number',
        value: 10,
      },
    })
  })

  it('isolates caller-owned snapshots in variable-assigned events', () => {
    const recorder = new ExecutionRecorder()

    const previousValue = {
      type: 'number' as const,
      value: 10,
    }

    const newValue = {
      type: 'number' as const,
      value: 20,
    }

    recorder.record({
      type: 'variable-assigned',
      name: 'score',
      previousValue,
      newValue,
      location: null,
    })

    expect(Object.isFrozen(previousValue)).toBe(false)
    expect(Object.isFrozen(newValue)).toBe(false)

    previousValue.value = 100
    newValue.value = 200

    const recordedEvent = recorder.getEvents()[0]

    expect(recordedEvent).toMatchObject({
      type: 'variable-assigned',
      previousValue: { type: 'number', value: 10 },
      newValue: { type: 'number', value: 20 },
    })
  })

  it('isolates caller-owned snapshots in function-return events', () => {
    const recorder = new ExecutionRecorder()

    const value = {
      type: 'number' as const,
      value: 42,
    }

    recorder.record({
      type: 'function-return',
      functionName: 'calculate',
      frameId: 1,
      value,
      location: null,
    })

    expect(Object.isFrozen(value)).toBe(false)

    value.value = 100

    expect(recorder.getEvents()[0]).toMatchObject({
      type: 'function-return',
      functionName: 'calculate',
      frameId: 1,
      value: { type: 'number', value: 42 },
    })
  })

  it('isolates caller-owned snapshots and arrays in console-output events', () => {
    const recorder = new ExecutionRecorder()

    const firstValue = {
      type: 'number' as const,
      value: 42,
    }

    const secondValue = {
      type: 'string' as const,
      value: 'TraceFlow',
    }

    const values = [firstValue, secondValue]

    recorder.record({
      type: 'console-output',
      values,
      location: null,
    })

    // Original array and snapshots must remain mutable.
    expect(Object.isFrozen(values)).toBe(false)
    expect(Object.isFrozen(firstValue)).toBe(false)
    expect(Object.isFrozen(secondValue)).toBe(false)

    // Modify the original data.
    firstValue.value = 100
    values.push({ type: 'number', value: 200 })

    // Recorded history must remain unchanged.
    expect(recorder.getEvents()[0]).toMatchObject({
      type: 'console-output',
      values: [
        { type: 'number', value: 42 },
        { type: 'string', value: 'TraceFlow' },
      ],
    })
  })

  it('does not share caller-owned source locations', () => {
    const recorder = new ExecutionRecorder()

    const location = {
      start: 0,
      end: 10,
      line: 1,
      column: 1,
    }

    recorder.record({
      type: 'program-start',
      location,
    })

    expect(Object.isFrozen(location)).toBe(false)

    location.start = 50
    location.line = 5

    expect(recorder.getEvents()[0].location).toEqual({
      start: 0,
      end: 10,
      line: 1,
      column: 1,
    })
  })
})

describe('toRuntimeValueSnapshot', () => {
  it('converts numbers', () => {
    expect(toRuntimeValueSnapshot(createNumber(42))).toEqual({
      type: 'number',
      value: 42,
    })
  })

  it('converts strings', () => {
    expect(toRuntimeValueSnapshot(createString('TraceFlow'))).toEqual({
      type: 'string',
      value: 'TraceFlow',
    })
  })

  it('converts undefined', () => {
    expect(toRuntimeValueSnapshot(createUndefined())).toEqual({
      type: 'undefined',
    })
  })

  it('freezes recorded event objects', () => {
    const recorder = new ExecutionRecorder()

    const event = recorder.record({
      type: 'program-start',
      location: null,
    })

    expect(Object.isFrozen(event)).toBe(true)
  })

  it('freezes nested runtime value snapshots', () => {
    const recorder = new ExecutionRecorder()

    const event = recorder.record({
      type: 'variable-initialized',
      name: 'score',
      value: {
        type: 'number',
        value: 10,
      },
      location: null,
    })

    if (event.type !== 'variable-initialized') {
      throw new Error('Unexpected event type')
    }

    expect(Object.isFrozen(event.value)).toBe(true)
  })

  it('enforces the maximum execution event limit', () => {
    const recorder = new ExecutionRecorder()

    for (let i = 0; i < RESOURCE_LIMITS.maxExecutionEvents; i++) {
      recorder.record({
        type: 'program-start',
        location: null,
      })
    }

    expect(recorder.getEvents()).toHaveLength(
      RESOURCE_LIMITS.maxExecutionEvents,
    )

    expect(() => {
      recorder.record({
        type: 'program-complete',
        location: null,
      })
    }).toThrow(ResourceLimitError)

    expect(recorder.getEvents()).toHaveLength(
      RESOURCE_LIMITS.maxExecutionEvents,
    )
  })
})
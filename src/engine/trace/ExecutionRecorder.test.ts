
import { describe, expect, it } from 'vitest'
import { createNumber, createString, createUndefined } from '../runtime/value'
import {
  ExecutionRecorder,
  toRuntimeValueSnapshot,
} from './ExecutionRecorder'

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
})

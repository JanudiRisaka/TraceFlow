
import { describe, expect, it } from 'vitest'
import { createNumber } from '../runtime/value'
import { RESOURCE_LIMITS } from '../resourceLimits'
import { ResourceLimitError } from '../ResourceLimitError'
import { ConsoleOutputRecorder } from './ConsoleOutputRecorder'

describe('ConsoleOutputRecorder', () => {
  it('records console output with an automatically assigned index', () => {
    const recorder = new ConsoleOutputRecorder()

    const entry = recorder.record([createNumber(42)], null)

    expect(entry.index).toBe(0)
    expect(entry.values).toEqual([
      { type: 'number', value: 42 },
    ])
  })

  it('enforces the maximum console output limit', () => {
    const recorder = new ConsoleOutputRecorder()

    for (let i = 0; i < RESOURCE_LIMITS.maxConsoleEntries; i++) {
      recorder.record([createNumber(i)], null)
    }

    expect(recorder.getEntries()).toHaveLength(
      RESOURCE_LIMITS.maxConsoleEntries,
    )

    expect(() => {
      recorder.record(
        [createNumber(RESOURCE_LIMITS.maxConsoleEntries + 1)],
        null,
      )
    }).toThrow(ResourceLimitError)

    expect(recorder.getEntries()).toHaveLength(
      RESOURCE_LIMITS.maxConsoleEntries,
    )
  })

  it('copies the source location when recording console output', () => {
    const recorder = new ConsoleOutputRecorder()

    const location = {
      start: 0,
      end: 10,
      line: 1,
      column: 0,
    }

    const entry = recorder.record([createNumber(42)], location)

    location.start = 5
    location.line = 2

    expect(entry.location).toEqual({
      start: 0,
      end: 10,
      line: 1,
      column: 0,
    })
  })

  it('does not allow returned entries to mutate recorded output', () => {
    const recorder = new ConsoleOutputRecorder()

    const entry = recorder.record([createNumber(42)], null)

    if (entry.values[0].type === 'number') {
      entry.values[0].value = 99
    }

    expect(recorder.getEntries()[0].values).toEqual([
      { type: 'number', value: 42 },
    ])
  })

  it('returns independent copies from getEntries', () => {
    const recorder = new ConsoleOutputRecorder()

    recorder.record([createNumber(42)], null)

    const entries = recorder.getEntries()
    if (entries[0].values[0].type === 'number') {
      entries[0].values[0].value = 99
    }

    expect(recorder.getEntries()[0].values).toEqual([
      { type: 'number', value: 42 },
    ])
  })
})
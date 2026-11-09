
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
})


import { describe, expect, it } from 'vitest'
import { runProgram } from './runProgram'

describe('runProgram', () => {
  it('executes valid JavaScript successfully', () => {
    const result = runProgram('let x = 10; x = 20;')

    expect(result.ok).toBe(true)

    if (result.ok === true) {
      expect(result.events.length).toBeGreaterThan(0)
      expect(result.snapshots.length).toBeGreaterThan(0)
    }
  })

  it('returns a parse error for invalid JavaScript', () => {
    const result = runProgram('let x = ;')

    expect(result.ok).toBe(false)

    if (result.ok === false) {
      expect(result.error.phase).toBe('parse')
      expect(result.events).toHaveLength(0)
      expect(result.snapshots).toHaveLength(0)
    }
  })

  it('rejects unsupported JavaScript syntax', () => {
    const result = runProgram('while (true) {}')

    expect(result.ok).toBe(false)

    if (result.ok === false) {
      expect(result.error.phase).toBe('validation')
      expect(result.events).toHaveLength(0)
    }
  })

  it('records program start and completion events', () => {
    const result = runProgram('let x = 10;')

    expect(result.ok).toBe(true)

    if (result.ok === true) {
      expect(result.events[0].type).toBe('program-start')
      expect(result.events[result.events.length - 1].type)
        .toBe('program-complete')
    }
  })

  it('returns a runtime error when assigning to a constant', () => {
    const result = runProgram('const x = 10; x = 20;')

    expect(result.ok).toBe(false)

    if (result.ok === false) {
      expect(result.error.phase).toBe('runtime')

    if (result.error.phase === 'runtime') {
      expect(result.error.code).toBe('CONST_ASSIGNMENT')
    } else {
      throw new Error('Expected a runtime error')
    }

      expect(result.events[result.events.length - 1].type)
        .toBe('execution-error')
      expect(result.snapshots[result.snapshots.length - 1].status)
        .toBe('error')
    }
  })

  it('records variable changes in execution snapshots', () => {
    const result = runProgram('let x = 10; x = 20;')

    expect(result.ok).toBe(true)

    if (result.ok === true) {
      const assignmentSnapshot = result.snapshots.find(
        (snapshot) =>
          result.events[snapshot.eventIndex]?.type === 'variable-assigned',
      )

      expect(assignmentSnapshot).toBeDefined()

      const xBinding = assignmentSnapshot?.scopes
        .flatMap((scope) => scope.bindings)
        .find((binding) => binding.name === 'x')

      expect(xBinding?.value).toEqual({
        type: 'number',
        value: 20,
      })
    }
  })
})

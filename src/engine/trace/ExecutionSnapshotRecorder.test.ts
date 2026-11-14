
import { describe, expect, it, vi } from 'vitest'
import { Environment } from '../runtime/Environment'
import { createNumber, createString } from '../runtime/value'
import { ExecutionSnapshotRecorder } from './ExecutionSnapshotRecorder'
import { RESOURCE_LIMITS } from '../resourceLimits'
import { ResourceLimitError } from '../ResourceLimitError'

describe('ExecutionSnapshotRecorder', () => {
  it('captures a global environment', () => {
    const environment = new Environment()
    environment.declare('count', 'let')
    environment.initialize('count', createNumber(10))

    const recorder = new ExecutionSnapshotRecorder()

    const snapshot = recorder.capture(
      0,
      'running',
      environment,
      [],
    )

    expect(snapshot.index).toBe(0)
    expect(snapshot.eventIndex).toBe(0)
    expect(snapshot.status).toBe('running')
    expect(snapshot.scopes).toHaveLength(1)
    expect(snapshot.scopes[0].bindings[0]).toMatchObject({
      name: 'count',
      kind: 'let',
      initialized: true,
      value: { type: 'number', value: 10 },
    })
  })

  it('captures nested environments and their parent relationships', () => {
    const global = new Environment()
    global.declare('count', 'let')
    global.initialize('count', createNumber(10))

    const local = new Environment(global)
    local.declare('name', 'const')
    local.initialize('name', createString('TraceFlow'))

    const recorder = new ExecutionSnapshotRecorder()

    const snapshot = recorder.capture(
      0,
      'running',
      local,
      [],
    )

    expect(snapshot.scopes).toHaveLength(2)

    const [globalScope, localScope] = snapshot.scopes

    expect(globalScope.parentScopeId).toBeNull()
    expect(localScope.parentScopeId).toBe(globalScope.scopeId)
  })

  it('preserves earlier variable values after reassignment', () => {
    const environment = new Environment()
    environment.declare('count', 'let')
    environment.initialize('count', createNumber(1))

    const recorder = new ExecutionSnapshotRecorder()

    const first = recorder.capture(0, 'running', environment, [])

    environment.assign('count', createNumber(2))

    const second = recorder.capture(1, 'running', environment, [])

    expect(first.scopes[0].bindings[0].value).toEqual({
      type: 'number',
      value: 1,
    })

    expect(second.scopes[0].bindings[0].value).toEqual({
      type: 'number',
      value: 2,
    })
  })

  it('does not include ended scopes in later snapshots', () => {
    const global = new Environment()
    const local = new Environment(global)

    const recorder = new ExecutionSnapshotRecorder()

    const first = recorder.capture(0, 'running', local, [])
    const second = recorder.capture(1, 'running', global, [])

    expect(first.scopes).toHaveLength(2)
    expect(second.scopes).toHaveLength(1)
  })

  it('preserves stable scope IDs across snapshots', () => {
    const global = new Environment()
    const local = new Environment(global)

    const recorder = new ExecutionSnapshotRecorder()

    const first = recorder.capture(0, 'running', global, [])
    const second = recorder.capture(1, 'running', local, [])
    const third = recorder.capture(2, 'running', global, [])

    expect(first.scopes[0].scopeId).toBe(
      third.scopes[0].scopeId,
    )

    expect(second.scopes[0].scopeId).toBe(
      first.scopes[0].scopeId,
    )
  })

  it('captures call stack information', () => {
    const environment = new Environment()

    const callStack = [
      {
        id: 1,
        functionName: 'calculate',
        source: null,
      },
    ]

    const recorder = new ExecutionSnapshotRecorder()

    const snapshot = recorder.capture(
      0,
      'running',
      environment,
      callStack,
    )

    expect(snapshot.callStack).toEqual(callStack)
  })

  it('does not allow returned snapshots to modify stored history', () => {
    const environment = new Environment()
    environment.declare('count', 'let')
    environment.initialize('count', createNumber(1))

    const recorder = new ExecutionSnapshotRecorder()

    const returnedSnapshot = recorder.capture(
      0,
      'running',
      environment,
      [],
    )

    returnedSnapshot.scopes[0].bindings[0].value = {
      type: 'number',
      value: 999,
    }

    const storedSnapshots = recorder.getSnapshots()

    expect(storedSnapshots[0].scopes[0].bindings[0].value).toEqual({
      type: 'number',
      value: 1,
    })
  })

  it('does not allow modifying history through getSnapshots', () => {
    const environment = new Environment()
    environment.declare('count', 'let')
    environment.initialize('count', createNumber(5))

    const recorder = new ExecutionSnapshotRecorder()

    recorder.capture(0, 'running', environment, [])

    const returnedSnapshots = recorder.getSnapshots()

    returnedSnapshots[0].scopes[0].bindings[0].name = 'changed'

    expect(
      recorder.getSnapshots()[0].scopes[0].bindings[0].name,
    ).toBe('count')
  })

  it('clears snapshots and resets snapshot indexing', () => {
    const environment = new Environment()
    const recorder = new ExecutionSnapshotRecorder()

    recorder.capture(0, 'running', environment, [])
    recorder.clear()

    expect(recorder.getSnapshots()).toHaveLength(0)

    const next = recorder.capture(0, 'completed', environment, [])

    expect(next.index).toBe(0)
    expect(next.scopes[0].scopeId).toBe(1)
  })


  it('enforces the maximum snapshot limit', () => {
    const environment = new Environment()
    const recorder = new ExecutionSnapshotRecorder()

    for (let i = 0; i < RESOURCE_LIMITS.maxSnapshots; i++) {
      recorder.capture(i, 'running', environment, [])
    }

    expect(recorder.getSnapshots()).toHaveLength(
      RESOURCE_LIMITS.maxSnapshots,
    )

    expect(() => {
      recorder.capture(
        RESOURCE_LIMITS.maxSnapshots,
        'running',
        environment,
        [],
      )
    }).toThrow(ResourceLimitError)

    expect(recorder.getSnapshots()).toHaveLength(
      RESOURCE_LIMITS.maxSnapshots,
    )
  })

  it('enforces the cumulative snapshot binding limit', () => {
    const environment = new Environment()
    const recorder = new ExecutionSnapshotRecorder()

    // Create 20 bindings.
    for (let i = 0; i < 20; i++) {
      environment.declare(`value${i}`, 'let')
    }

    // Record 4,999 snapshots: 99,980 binding entries.
    for (let i = 0; i < RESOURCE_LIMITS.maxSnapshots - 1; i++) {
      recorder.capture(i, 'running', environment, [])
    }

    // Add one more binding.
    environment.declare('extra', 'let')

    // 99,980 + 21 exceeds the 100,000 limit.
    expect(() => {
      recorder.capture(
        RESOURCE_LIMITS.maxSnapshots - 1,
        'running',
        environment,
        [],
      )
    }).toThrow(ResourceLimitError)

    // Previously recorded history must remain intact.
    expect(recorder.getSnapshots()).toHaveLength(
      RESOURCE_LIMITS.maxSnapshots - 1,
    )
  })

  it('includes additional environment bindings in the cumulative snapshot limit', () => {
    const environment = new Environment()
    const additionalEnvironment = new Environment()
    const recorder = new ExecutionSnapshotRecorder()

    // Create 20 bindings in the current environment.
    for (let i = 0; i < 20; i++) {
      environment.declare(`value${i}`, 'let')
    }

    // Record 4,999 snapshots: 99,980 binding entries.
    for (let i = 0; i < RESOURCE_LIMITS.maxSnapshots - 1; i++) {
      recorder.capture(i, 'running', environment, [])
    }

    // The additional environment contributes one more binding.
    additionalEnvironment.declare('additionalValue', 'let')

    // 99,980 + 20 + 1 exceeds the 100,000 limit.
    expect(() => {
      recorder.capture(
        RESOURCE_LIMITS.maxSnapshots - 1,
        'running',
        environment,
        [],
        [additionalEnvironment],
      )
    }).toThrow(ResourceLimitError)

    expect(recorder.getSnapshots()).toHaveLength(
      RESOURCE_LIMITS.maxSnapshots - 1,
    )
  })

  it('does not count shared parent bindings twice in one snapshot', () => {
    const parent = new Environment()
    parent.declare('parentValue', 'let')

    const environment = new Environment(parent)
    environment.declare('currentValue', 'let')

    const additionalEnvironment = new Environment(parent)
    additionalEnvironment.declare('additionalValue', 'let')

    const recorder = new ExecutionSnapshotRecorder()

    const getOwnBindingCountSpy = vi.spyOn(
      parent,
      'getOwnBindingCount',
    )

    const snapshot = recorder.capture(
      0,
      'running',
      environment,
      [],
      [additionalEnvironment],
    )

    expect(getOwnBindingCountSpy).toHaveBeenCalledTimes(1)

    // The shared parent should appear only once.
    expect(
      snapshot.scopes.filter((scope) => scope.name === 'Global'),
    ).toHaveLength(1)

    expect(
      snapshot.scopes.reduce(
        (total, scope) => total + scope.bindings.length,
        0,
      ),
    ).toBe(3)
  })

  it('resets the cumulative binding count when cleared', () => {
    const environment = new Environment()
    const recorder = new ExecutionSnapshotRecorder()

    for (let i = 0; i < 20; i++) {
      environment.declare(`value${i}`, 'let')
    }

    for (let i = 0; i < RESOURCE_LIMITS.maxSnapshots - 1; i++) {
      recorder.capture(i, 'running', environment, [])
    }

    environment.declare('extra', 'let')

    recorder.clear()

    // The new execution starts with a fresh binding budget.
    expect(() => {
      recorder.capture(0, 'running', environment, [])
    }).not.toThrow()

    expect(recorder.getSnapshots()).toHaveLength(1)
  })
})
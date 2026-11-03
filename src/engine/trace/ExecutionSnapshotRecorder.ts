
import type { Environment } from '../runtime/Environment'
import type { ExecutionSnapshot, CallFrameSnapshot, ExecutionStatus, ScopeSnapshot } from './types'
import { toRuntimeValueSnapshot } from './ExecutionRecorder'

function cloneSnapshot(
  snapshot: ExecutionSnapshot,
): ExecutionSnapshot {
  return {
    ...snapshot,
    scopes: snapshot.scopes.map((scope) => ({
      ...scope,
      bindings: scope.bindings.map((binding) => ({
        ...binding,
        value: binding.value ? { ...binding.value } : null,
      })),
    })),
    callStack: snapshot.callStack.map((frame) => ({ ...frame })),
  }
}

export class ExecutionSnapshotRecorder {
  private snapshots: ExecutionSnapshot[] = []
  private scopeIds = new WeakMap<Environment, number>()
  private nextScopeId = 1

  private getScopeId(environment: Environment): number {
    const existingId = this.scopeIds.get(environment)

    if (existingId !== undefined) {
      return existingId
    }

    const newId = this.nextScopeId++
    this.scopeIds.set(environment, newId)

    return newId
  }

  private captureScopes(currentEnvironment: Environment): ScopeSnapshot[] {
    const environments: Environment[] = []
    let environment: Environment | null = currentEnvironment

    while (environment !== null) {
      environments.push(environment)
      environment = environment.parent
    }

    // Present scopes from outermost to innermost.
    environments.reverse()

    return environments.map((current) => {
      const parent = current.parent

      return {
        scopeId: this.getScopeId(current),
        parentScopeId: parent ? this.getScopeId(parent) : null,
        bindings: current.getOwnBindings().map((binding) => ({
          name: binding.name,
          kind: binding.mutable ? 'let' : 'const',
          initialized: binding.initialized,
          value: binding.initialized
            ? toRuntimeValueSnapshot(binding.value)
            : null,
        })),
      }
    })
  }

  capture(
    eventIndex: number,
    status: ExecutionStatus,
    environment: Environment,
    callStack: CallFrameSnapshot[],
  ): ExecutionSnapshot {
    const snapshot: ExecutionSnapshot = {
      index: this.snapshots.length,
      eventIndex,
      status,
      scopes: this.captureScopes(environment),
      callStack: callStack.map((frame) => ({ ...frame })),
    }

    this.snapshots.push(snapshot)

    return cloneSnapshot(snapshot)
  }

  getSnapshots(): ExecutionSnapshot[] {
  return this.snapshots.map(cloneSnapshot)
}

  clear(): void {
    this.snapshots = []
    this.scopeIds = new WeakMap<Environment, number>()
    this.nextScopeId = 1
  }
}

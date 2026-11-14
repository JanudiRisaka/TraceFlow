
import type { Environment } from '../runtime/Environment'
import type {
  ExecutionSnapshot,
  CallFrameSnapshot,
  ExecutionStatus,
  ScopeSnapshot,
} from './types'
import { toRuntimeValueSnapshot } from './ExecutionRecorder'
import { RESOURCE_LIMITS } from '../resourceLimits'
import { ResourceLimitError } from '../ResourceLimitError'

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
  private snapshotBindingEntries = 0
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

  private countBindingEntries(
    currentEnvironment: Environment,
    additionalEnvironments: Environment[] = [],
  ): number {
    const environments = new Set<Environment>()

    const addEnvironmentChain = (start: Environment) => {
      let environment: Environment | null = start

      while (environment !== null) {
        environments.add(environment)
        environment = environment.parent
      }
    }

    addEnvironmentChain(currentEnvironment)

    for (const additionalEnvironment of additionalEnvironments) {
      addEnvironmentChain(additionalEnvironment)
    }

    let total = 0

    for (const environment of environments) {
      total += environment.getOwnBindingCount()
    }

    return total
  }

  private captureScopes(
    currentEnvironment: Environment,
    additionalEnvironments: Environment[] = [],
  ): ScopeSnapshot[] {
    const environments: Environment[] = []
    const seen = new Set<Environment>()

    const addEnvironmentChain = (start: Environment) => {
      const chain: Environment[] = []
      let environment: Environment | null = start

      while (environment !== null) {
        chain.push(environment)
        environment = environment.parent
      }

      // Add scopes from outermost to innermost.
      chain.reverse()

      for (const current of chain) {
        if (!seen.has(current)) {
          seen.add(current)
          environments.push(current)
        }
      }
    }

    addEnvironmentChain(currentEnvironment)

    for (const additionalEnvironment of additionalEnvironments) {
      addEnvironmentChain(additionalEnvironment)
    }

    return environments.map((current) => {
      const parent = current.parent

      return {
        scopeId: this.getScopeId(current),
        parentScopeId: parent ? this.getScopeId(parent) : null,
        type: current.metadata.type,
        name: current.metadata.name,
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
    additionalEnvironments: Environment[] = [],
  ): ExecutionSnapshot {
    if (this.snapshots.length >= RESOURCE_LIMITS.maxSnapshots) {
      throw new ResourceLimitError(
        `Execution stopped: the snapshot limit of ${RESOURCE_LIMITS.maxSnapshots} was reached.`,
      )
    }

    const bindingEntries = this.countBindingEntries(
      environment,
      additionalEnvironments,
    )

    if (
      this.snapshotBindingEntries + bindingEntries >
      RESOURCE_LIMITS.maxSnapshotBindingEntries
    ) {
      throw new ResourceLimitError(
        `Execution stopped: the cumulative snapshot binding limit of ${RESOURCE_LIMITS.maxSnapshotBindingEntries} was reached.`,
      )
    }

    const scopes = this.captureScopes(
      environment,
      additionalEnvironments,
    )

    const snapshot: ExecutionSnapshot = {
      index: this.snapshots.length,
      eventIndex,
      status,
      scopes,
      callStack: callStack.map((frame) => ({ ...frame })),
    }

    this.snapshots.push(snapshot)
    this.snapshotBindingEntries += bindingEntries

    return cloneSnapshot(snapshot)
  }

  getSnapshots(): ExecutionSnapshot[] {
    return this.snapshots.map(cloneSnapshot)
  }

  clear(): void {
    this.snapshots = []
    this.snapshotBindingEntries = 0
    this.scopeIds = new WeakMap<Environment, number>()
    this.nextScopeId = 1
  }
}

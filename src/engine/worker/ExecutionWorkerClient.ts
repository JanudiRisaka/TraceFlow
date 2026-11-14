import type { ProgramExecutionResult } from '../execution/types'
import type {
  ExecutionWorkerRequest,
  ExecutionWorkerResponse,
} from './messages'
import { RESOURCE_LIMITS } from '../resourceLimits'
import { exceedsSourceSizeLimit } from '../sourceSize'

type PendingExecution = {
  resolve: (result: ProgramExecutionResult) => void
  reject: (error: Error) => void
  timeoutId: ReturnType<typeof setTimeout>
}

function hasNoArrayHoles(value: unknown[]): boolean {
  for (let index = 0; index < value.length; index++) {
    if (!(index in value)) {
      return false
    }
  }

  return true
}

function isBoundedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= RESOURCE_LIMITS.maxStringLength
  )
}

function isSourceLocation(value: unknown): boolean {
  if (value === null) {
    return true
  }

  if (typeof value !== 'object') {
    return false
  }

  const location = value as Record<string, unknown>

  return (
    typeof location.start === 'number' &&
    Number.isSafeInteger(location.start) &&
    location.start >= 0 &&
    typeof location.end === 'number' &&
    Number.isSafeInteger(location.end) &&
    location.end >= location.start &&
    typeof location.line === 'number' &&
    Number.isSafeInteger(location.line) &&
    location.line >= 1 &&
    typeof location.column === 'number' &&
    Number.isSafeInteger(location.column) &&
    location.column >= 0
  )
}

function isRuntimeValueSnapshot(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const snapshot = value as Record<string, unknown>

  switch (snapshot.type) {
    case 'number':
      return typeof snapshot.value === 'number'

    case 'string':
      return (
        typeof snapshot.value === 'string' &&
        snapshot.value.length <= RESOURCE_LIMITS.maxStringLength
      )

    case 'boolean':
      return typeof snapshot.value === 'boolean'

    case 'null':
    case 'undefined':
      return true

    case 'function':
      return isBoundedString(snapshot.name)

    default:
      return false
  }
}

function isBindingSnapshot(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const binding = value as Record<string, unknown>

  if (
    !isBoundedString(binding.name) ||
    (binding.kind !== 'let' && binding.kind !== 'const') ||
    typeof binding.initialized !== 'boolean'
  ) {
    return false
  }

  if (binding.initialized) {
    return isRuntimeValueSnapshot(binding.value)
  }

  return binding.value === null
}

function isScopeSnapshot(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const scope = value as Record<string, unknown>

  return (
    typeof scope.scopeId === 'number' &&
    Number.isSafeInteger(scope.scopeId) &&
    scope.scopeId >= 0 &&
    (
      scope.parentScopeId === null ||
      (
        typeof scope.parentScopeId === 'number' &&
        Number.isSafeInteger(scope.parentScopeId) &&
        scope.parentScopeId >= 0
      )
    ) &&
    ['global', 'function', 'block', 'loop'].includes(
      scope.type as string,
    ) &&
    isBoundedString(scope.name) &&
    Array.isArray(scope.bindings) &&
    scope.bindings.length <= RESOURCE_LIMITS.maxAstNodes &&
    hasNoArrayHoles(scope.bindings) &&
    scope.bindings.every(isBindingSnapshot)
  )
}

function isCallFrameSnapshot(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const frame = value as Record<string, unknown>

  return (
    typeof frame.id === 'number' &&
    Number.isSafeInteger(frame.id) &&
    frame.id >= 0 &&
    isBoundedString(frame.functionName) &&
    isSourceLocation(frame.source)
  )
}

function isExecutionSnapshot(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const snapshot = value as Record<string, unknown>

  return (
    typeof snapshot.index === 'number' &&
    Number.isSafeInteger(snapshot.index) &&
    snapshot.index >= 0 &&
    typeof snapshot.eventIndex === 'number' &&
    Number.isSafeInteger(snapshot.eventIndex) &&
    snapshot.eventIndex >= 0 &&
    (
      snapshot.status === 'running' ||
      snapshot.status === 'completed' ||
      snapshot.status === 'error'
    ) &&
    Array.isArray(snapshot.scopes) &&
    snapshot.scopes.length <= RESOURCE_LIMITS.maxAstNodes &&
    hasNoArrayHoles(snapshot.scopes) &&
    snapshot.scopes.every(isScopeSnapshot) &&
    Array.isArray(snapshot.callStack) &&
    snapshot.callStack.length <= RESOURCE_LIMITS.maxFunctionCallDepth &&
    hasNoArrayHoles(snapshot.callStack) &&
    snapshot.callStack.every(isCallFrameSnapshot)
  )
}

function hasAcceptableSnapshotBindingEntries(
  snapshots: unknown[],
): boolean {
  let total = 0

  for (const snapshot of snapshots) {
    if (typeof snapshot !== 'object' || snapshot === null) {
      return false
    }

    const scopes = (snapshot as Record<string, unknown>).scopes

    if (!Array.isArray(scopes)) {
      return false
    }

    for (const scope of scopes) {
      if (typeof scope !== 'object' || scope === null) {
        return false
      }

      const bindings = (scope as Record<string, unknown>).bindings

      if (!Array.isArray(bindings)) {
        return false
      }

      total += bindings.length

      if (total > RESOURCE_LIMITS.maxSnapshotBindingEntries) {
        return false
      }
    }
  }

  return true
}

function isExecutionEvent(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const event = value as Record<string, unknown>

  if (
    typeof event.index !== 'number' ||
    !Number.isSafeInteger(event.index) ||
    event.index < 0 ||
    !isSourceLocation(event.location)
  ) {
    return false
  }

  switch (event.type) {
    case 'program-start':
    case 'program-complete':
      return true

    case 'variable-declared':
      return (
        isBoundedString(event.name) &&
        (event.kind === 'let' || event.kind === 'const')
      )

    case 'variable-initialized':
      return (
        isBoundedString(event.name) &&
        isRuntimeValueSnapshot(event.value)
      )

    case 'variable-assigned':
      return (
        isBoundedString(event.name) &&
        isRuntimeValueSnapshot(event.previousValue) &&
        isRuntimeValueSnapshot(event.newValue)
      )

    case 'branch-taken':
      return (
        event.branch === 'consequent' ||
        event.branch === 'alternate'
      )

    case 'loop-iteration':
      return (
        typeof event.iteration === 'number' &&
        Number.isSafeInteger(event.iteration) &&
        event.iteration > 0
      )

    case 'function-call':
      return (
        isBoundedString(event.functionName) &&
        typeof event.frameId === 'number' &&
        Number.isSafeInteger(event.frameId) &&
        event.frameId > 0
      )

    case 'function-return':
      return (
        isBoundedString(event.functionName) &&
        typeof event.frameId === 'number' &&
        Number.isSafeInteger(event.frameId) &&
        event.frameId > 0 &&
        isRuntimeValueSnapshot(event.value)
      )

    case 'console-output':
      return (
        Array.isArray(event.values) &&
        event.values.length <= RESOURCE_LIMITS.maxAstNodes &&
        hasNoArrayHoles(event.values) &&
        event.values.every(isRuntimeValueSnapshot)
      )

    case 'execution-error':
      return (
        isBoundedString(event.message) &&
        isBoundedString(event.code)
      )

    default:
      return false
  }
}

function isConsoleOutputEntry(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const entry = value as Record<string, unknown>

  return (
    typeof entry.index === 'number' &&
    Number.isSafeInteger(entry.index) &&
    entry.index >= 0 &&
    Array.isArray(entry.values) &&
    entry.values.length <= RESOURCE_LIMITS.maxAstNodes &&
    hasNoArrayHoles(entry.values) &&
    entry.values.every(isRuntimeValueSnapshot) &&
    isSourceLocation(entry.location)
  )
}

function isExecutionWorkerResponse(
  value: unknown,
): value is ExecutionWorkerResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const response = value as Record<string, unknown>

  if (
    typeof response.requestId !== 'number' ||
    !Number.isSafeInteger(response.requestId) ||
    response.requestId < 1
  ) {
    return false
  }

  if (response.type === 'fatal-error') {
    return isBoundedString(response.message)
  }

  if (response.type === 'result') {
    const result = response.result

    if (typeof result !== 'object' || result === null) {
      return false
    }

    const executionResult = result as Record<string, unknown>

    const hasValidCollections =
      Array.isArray(executionResult.events) &&
      executionResult.events.length <= RESOURCE_LIMITS.maxExecutionEvents &&
      hasNoArrayHoles(executionResult.events) &&
      executionResult.events.every(isExecutionEvent) &&
      Array.isArray(executionResult.snapshots) &&
      executionResult.snapshots.length <= RESOURCE_LIMITS.maxSnapshots &&
      hasNoArrayHoles(executionResult.snapshots) &&
      executionResult.snapshots.every(isExecutionSnapshot) &&
      hasAcceptableSnapshotBindingEntries(executionResult.snapshots) &&
      Array.isArray(executionResult.output) &&
      executionResult.output.length <= RESOURCE_LIMITS.maxConsoleEntries &&
      hasNoArrayHoles(executionResult.output) &&
      executionResult.output.every(isConsoleOutputEntry)

    if (!hasValidCollections) {
      return false
    }

    const events = executionResult.events
    const snapshots = executionResult.snapshots

    if (!Array.isArray(events) || !Array.isArray(snapshots)) {
      return false
    }

    const hasSequentialEventIndexes = events.every(
      (event: unknown, index: number) =>
        typeof event === 'object' &&
        event !== null &&
        'index' in event &&
        event.index === index,
    )

    const hasSequentialSnapshotIndexes = snapshots.every(
      (snapshot: unknown, index: number) =>
        typeof snapshot === 'object' &&
        snapshot !== null &&
        'index' in snapshot &&
        snapshot.index === index,
    )

    const output = executionResult.output

    if (!Array.isArray(output)) {
      return false
    }

    const hasSequentialOutputIndexes = output.every(
      (entry: unknown, index: number) =>
        typeof entry === 'object' &&
        entry !== null &&
        'index' in entry &&
        entry.index === index,
    )

    if (
      !hasSequentialEventIndexes ||
      !hasSequentialSnapshotIndexes ||
      !hasSequentialOutputIndexes
    ) {
      return false
    }

    const hasValidSnapshotIntegrity = snapshots.every(
      (snapshot: unknown) => {
        if (
          typeof snapshot !== 'object' ||
          snapshot === null ||
          !('eventIndex' in snapshot) ||
          !('scopes' in snapshot)
        ) {
          return false
        }

        if (
          typeof snapshot.eventIndex !== 'number' ||
          snapshot.eventIndex >= events.length ||
          !Array.isArray(snapshot.scopes)
        ) {
          return false
        }

        const scopeParents = new Map<number, number | null>()

        for (const scope of snapshot.scopes) {
          if (typeof scope !== 'object' || scope === null) {
            return false
          }

          const scopeRecord = scope as Record<string, unknown>
          const scopeId = scopeRecord.scopeId
          const parentScopeId = scopeRecord.parentScopeId

          if (typeof scopeId !== 'number' || scopeParents.has(scopeId)) {
            return false
          }

          if (parentScopeId === null) {
            scopeParents.set(scopeId, null)
            continue
          }

          if (typeof parentScopeId !== 'number') {
            return false
          }

          scopeParents.set(scopeId, parentScopeId)
        }

        // Every parent must reference an existing scope.
        for (const parentScopeId of scopeParents.values()) {
          if (parentScopeId !== null && !scopeParents.has(parentScopeId)) {
            return false
          }
        }

        // Reject circular parent relationships.
        const visitedScopeIds = new Set<number>()

        for (const scopeId of scopeParents.keys()) {
          let currentScopeId: number | null = scopeId
          const currentPath = new Set<number>()

          while (
            currentScopeId !== null &&
            !visitedScopeIds.has(currentScopeId)
          ) {
            if (currentPath.has(currentScopeId)) {
              return false
            }

            currentPath.add(currentScopeId)
            currentScopeId = scopeParents.get(currentScopeId) ?? null
          }

          for (const visitedId of currentPath) {
            visitedScopeIds.add(visitedId)
          }
        }

        return true
      },
    )

    if (!hasValidSnapshotIntegrity) {
      return false
    }

    if (executionResult.ok === true) {
      return !('error' in executionResult)
    }

    if (executionResult.ok === false) {
      const error = executionResult.error

      if (typeof error !== 'object' || error === null) {
        return false
      }

      const executionError = error as Record<string, unknown>

      if (!isBoundedString(executionError.message)) {
        return false
      }

      if (executionError.phase === 'runtime') {
        return (
          isBoundedString(executionError.message) &&
          executionError.message.length > 0 &&
          isBoundedString(executionError.code) &&
          executionError.code.length > 0
        )
      }

      if (executionError.phase === 'parse') {
        const details = executionError.details

        if (typeof details !== 'object' || details === null) {
          return false
        }

        const parseError = details as Record<string, unknown>

        return (
          isBoundedString(parseError.message) &&
          parseError.message.length > 0 &&
          (parseError.position === null ||
            (typeof parseError.position === 'number' &&
              Number.isSafeInteger(parseError.position) &&
              parseError.position >= 0)) &&
          (parseError.line === null ||
            (typeof parseError.line === 'number' &&
              Number.isSafeInteger(parseError.line) &&
              parseError.line >= 1)) &&
          (parseError.column === null ||
            (typeof parseError.column === 'number' &&
              Number.isSafeInteger(parseError.column) &&
              parseError.column >= 0))
        )
      }

      if (executionError.phase === 'validation') {
        return (
          Array.isArray(executionError.details) &&
          executionError.details.length <= RESOURCE_LIMITS.maxAstNodes &&
          hasNoArrayHoles(executionError.details) &&
          executionError.details.every((diagnostic) => {
            if (typeof diagnostic !== 'object' || diagnostic === null) {
              return false
            }

            const item = diagnostic as Record<string, unknown>

            return (
              [
                'UNSUPPORTED_SYNTAX',
                'UNSUPPORTED_OPERATOR',
                'UNSUPPORTED_FEATURE',
                'RESOURCE_LIMIT_EXCEEDED',
              ].includes(item.code as string) &&
              isBoundedString(item.message) &&
              item.message.length > 0 &&
              isBoundedString(item.nodeType) &&
              item.nodeType.length > 0 &&
              (item.line === null ||
                (typeof item.line === 'number' &&
                  Number.isSafeInteger(item.line) &&
                  item.line >= 1)) &&
              (item.column === null ||
                (typeof item.column === 'number' &&
                  Number.isSafeInteger(item.column) &&
                  item.column >= 0))
            )
          })
        )
      }
    }

    return false
  }

  return false
}

export class ExecutionWorkerClient {
  private worker: Worker | null = null
  private nextRequestId = 1

  private pendingExecutions = new Map<number, PendingExecution>()

  private createWorker(): Worker {
    const worker = new Worker(
      new URL('./execution.worker.ts', import.meta.url),
      { type: 'module' },
    )


    worker.onmessage = (event: MessageEvent<unknown>) => {
      const response = event.data

      if (!isExecutionWorkerResponse(response)) {
        this.handleWorkerFailure(
          worker,
          new Error('The Worker returned an invalid response.'),
        )
        return
      }

      const pending = this.pendingExecutions.get(response.requestId)

      // Ignore responses that no longer have a pending request.
      if (!pending) {
        return
      }

      clearTimeout(pending.timeoutId)
      this.pendingExecutions.delete(response.requestId)

      if (response.type === 'result') {
        pending.resolve(response.result)
      } else {
        pending.reject(new Error(response.message))
      }
    }


    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault()

      this.handleWorkerFailure(
        worker,
        new Error(event.message || 'The execution Worker failed.'),
      )
    }

    worker.onmessageerror = () => {
      this.handleWorkerFailure(
        worker,
        new Error('The Worker returned a message that could not be read.'),
      )
    }

    return worker
  }

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = this.createWorker()
    }

    return this.worker
  }

  private handleWorkerFailure(worker: Worker, error: Error): void {
    // Ignore errors from a Worker that has already been replaced.
    if (this.worker !== worker) {
      return
    }

    worker.terminate()
    this.worker = null

    for (const pending of this.pendingExecutions.values()) {
      clearTimeout(pending.timeoutId)
      pending.reject(error)
    }

    this.pendingExecutions.clear()
  }

  run(source: string): Promise<ProgramExecutionResult> {
    if (exceedsSourceSizeLimit(source)) {
      return Promise.reject(
        new Error(
          `Source code exceeds the maximum allowed size of ${RESOURCE_LIMITS.maxSourceBytes} bytes.`,
        ),
      )
    }

    return new Promise((resolve, reject) => {
      const worker = this.getWorker()
      const requestId = this.nextRequestId++

      const request: ExecutionWorkerRequest = {
        type: 'run',
        requestId,
        source,
      }

      const timeoutId = setTimeout(() => {
        this.handleWorkerFailure(
          worker,
          new Error(
            `Execution timed out after ${RESOURCE_LIMITS.executionTimeoutMs} ms.`,
          ),
        )
      }, RESOURCE_LIMITS.executionTimeoutMs)

      this.pendingExecutions.set(requestId, {
        resolve,
        reject,
        timeoutId,
      })

      try {
        worker.postMessage(request)
      } catch (error: unknown) {
        clearTimeout(timeoutId)
        this.pendingExecutions.delete(requestId)

        reject(
          error instanceof Error
            ? error
            : new Error('Could not send the execution request to the Worker.'),
        )
      }
    })
  }

  terminate(): void {
    this.worker?.terminate()
    this.worker = null

    const error = new Error('Execution was cancelled.')

    for (const pending of this.pendingExecutions.values()) {
      clearTimeout(pending.timeoutId)
      pending.reject(error)
    }

    this.pendingExecutions.clear()
  }
}

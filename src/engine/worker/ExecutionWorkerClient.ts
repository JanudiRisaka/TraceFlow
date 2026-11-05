
import type { ProgramExecutionResult } from '../execution/types'

import type {
  ExecutionWorkerRequest,
  ExecutionWorkerResponse,
} from './messages'

type PendingExecution = {
  resolve: (result: ProgramExecutionResult) => void
  reject: (error: Error) => void
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
    return typeof response.message === 'string'
  }

  if (response.type === 'result') {
    const result = response.result

    if (typeof result !== 'object' || result === null) {
      return false
    }

    const executionResult = result as Record<string, unknown>

    return (
      typeof executionResult.ok === 'boolean' &&
      Array.isArray(executionResult.events) &&
      Array.isArray(executionResult.snapshots)
    )
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
      pending.reject(error)
    }

    this.pendingExecutions.clear()
  }

  run(source: string): Promise<ProgramExecutionResult> {
    const worker = this.getWorker()
    const requestId = this.nextRequestId++

    const request: ExecutionWorkerRequest = {
      type: 'run',
      requestId,
      source,
    }

    return new Promise((resolve, reject) => {
      this.pendingExecutions.set(requestId, { resolve, reject })

      try {
        worker.postMessage(request)
      } catch (error: unknown) {
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
      pending.reject(error)
    }

    this.pendingExecutions.clear()
  }
}


/// <reference lib="webworker" />

import { runProgram } from '../execution/runProgram'

import type {
  ExecutionWorkerRequest,
  ExecutionWorkerResponse,
} from './messages'

const workerScope = self as unknown as DedicatedWorkerGlobalScope

workerScope.onmessage = (
  event: MessageEvent<ExecutionWorkerRequest>,
) => {
  const request = event.data

  // Reject malformed requests.
  if (
    !request ||
    request.type !== 'run' ||
    typeof request.requestId !== 'number' ||
    typeof request.source !== 'string'
  ) {
    return
  }

  try {
    const result = runProgram(request.source)

    const response: ExecutionWorkerResponse = {
      type: 'result',
      requestId: request.requestId,
      result,
    }

    workerScope.postMessage(response)
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'An unexpected Worker error occurred.'

    const response: ExecutionWorkerResponse = {
      type: 'fatal-error',
      requestId: request.requestId,
      message,
    }

    workerScope.postMessage(response)
  }
}

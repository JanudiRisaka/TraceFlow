
/// <reference lib="webworker" />

import { runProgram } from '../execution/runProgram'

import type {
  ExecutionWorkerRequest,
  ExecutionWorkerResponse,
} from './messages'

const workerScope = self as unknown as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<unknown>) => {
  const request = event.data

  // Check whether this message has a usable request ID.
  if (
    typeof request !== 'object' ||
    request === null ||
    !('requestId' in request) ||
    typeof request.requestId !== 'number' ||
    !Number.isSafeInteger(request.requestId) ||
    request.requestId < 1
  ) {
    return
  }

  const requestId = request.requestId

  // Reject malformed requests when we can identify the request.
  if (
    !('type' in request) ||
    request.type !== 'run' ||
    !('source' in request) ||
    typeof request.source !== 'string'
  ) {
    const response: ExecutionWorkerResponse = {
      type: 'fatal-error',
      requestId,
      message: 'The Worker received an invalid execution request.',
    }

    workerScope.postMessage(response)
    return
  }

  const validRequest: ExecutionWorkerRequest = {
    type: 'run',
    requestId,
    source: request.source,
  }

  try {
    const result = runProgram(validRequest.source)

    const response: ExecutionWorkerResponse = {
      type: 'result',
      requestId: validRequest.requestId,
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
      requestId: validRequest.requestId,
      message,
    }

    workerScope.postMessage(response)
  }
}

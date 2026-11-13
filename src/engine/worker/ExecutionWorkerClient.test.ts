
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ExecutionWorkerClient } from './ExecutionWorkerClient'
import { RESOURCE_LIMITS } from '../resourceLimits'

let postMessageBehavior: (() => void) | undefined

class MockWorker {
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  onmessageerror: (() => void) | null = null

  postMessage = vi.fn(() => postMessageBehavior?.())
  terminate = vi.fn()
}

describe('ExecutionWorkerClient', () => {
  let workers: MockWorker[]

  beforeEach(() => {
    postMessageBehavior = undefined
    vi.useFakeTimers()
    workers = []

    vi.stubGlobal(
      'Worker',
      class extends MockWorker {
        constructor() {
          super()
          workers.push(this)
        }
      },
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('terminates the Worker when execution exceeds the timeout', async () => {
    const client = new ExecutionWorkerClient()

    const execution = client.run('let value = 10')

    const rejection = expect(execution).rejects.toThrow(
      `Execution timed out after ${RESOURCE_LIMITS.executionTimeoutMs} ms.`,
    )

    expect(workers).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(
      RESOURCE_LIMITS.executionTimeoutMs - 1,
    )

    expect(workers[0].terminate).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)

    await rejection

    expect(workers[0].terminate).toHaveBeenCalledOnce()

    client.terminate()
  })

    it('creates a new Worker after a timeout', async () => {
    const client = new ExecutionWorkerClient()

    const firstExecution = client.run('let value = 10')

    const firstRejection = expect(firstExecution).rejects.toThrow(
        `Execution timed out after ${RESOURCE_LIMITS.executionTimeoutMs} ms.`,
    )

    await vi.advanceTimersByTimeAsync(
        RESOURCE_LIMITS.executionTimeoutMs,
    )

    await firstRejection

    expect(workers).toHaveLength(1)

    const secondExecution = client.run('let value = 20')

    expect(workers).toHaveLength(2)

    const secondWorker = workers[1]

    secondWorker.onmessage?.({
        data: {
        type: 'result',
        requestId: 2,
        result: {
            ok: true,
            events: [],
            snapshots: [],
            output: [],
        },
        },
    } as MessageEvent<unknown>)

    const result = await secondExecution

    expect(result.ok).toBe(true)
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    expect(workers[1].terminate).not.toHaveBeenCalled()

    client.terminate()
    })

    it('rejects all pending executions when the shared Worker times out', async () => {
    const client = new ExecutionWorkerClient()

    const firstExecution = client.run('let first = 1')
    const secondExecution = client.run('let second = 2')

    const timeoutMessage =
        `Execution timed out after ${RESOURCE_LIMITS.executionTimeoutMs} ms.`

    const firstRejection = expect(firstExecution).rejects.toThrow(
        timeoutMessage,
    )

    const secondRejection = expect(secondExecution).rejects.toThrow(
        timeoutMessage,
    )

    expect(workers).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(
        RESOURCE_LIMITS.executionTimeoutMs,
    )

    await Promise.all([firstRejection, secondRejection])

    expect(workers[0].terminate).toHaveBeenCalledOnce()

    client.terminate()
    })

    it('clears the timeout after a successful response', async () => {
    const client = new ExecutionWorkerClient()

    const execution = client.run('let value = 10')

    expect(workers).toHaveLength(1)

    workers[0].onmessage?.({
        data: {
        type: 'result',
        requestId: 1,
        result: {
            ok: true,
            events: [],
            snapshots: [],
            output: [],
        },
        },
    } as MessageEvent<unknown>)

    const result = await execution

    expect(result.ok).toBe(true)

    await vi.advanceTimersByTimeAsync(
        RESOURCE_LIMITS.executionTimeoutMs,
    )

    expect(workers[0].terminate).not.toHaveBeenCalled()

    client.terminate()
    })

    it('clears the timeout when execution is manually cancelled', async () => {
    const client = new ExecutionWorkerClient()

    const execution = client.run('let value = 10')

    const rejection = expect(execution).rejects.toThrow(
        'Execution was cancelled.',
    )

    client.terminate()

    await rejection

    await vi.advanceTimersByTimeAsync(
        RESOURCE_LIMITS.executionTimeoutMs,
    )

    expect(workers[0].terminate).toHaveBeenCalledOnce()
    })

    it('clears pending timers when the Worker encounters an error', async () => {
    const client = new ExecutionWorkerClient()

    const execution = client.run('let value = 10')

    const rejection = expect(execution).rejects.toThrow(
        'The execution Worker failed.',
    )

    workers[0].onerror?.({
        message: 'The execution Worker failed.',
        preventDefault: vi.fn(),
    } as unknown as ErrorEvent)

    await rejection

    await vi.advanceTimersByTimeAsync(
        RESOURCE_LIMITS.executionTimeoutMs,
    )

    expect(workers[0].terminate).toHaveBeenCalledOnce()

    client.terminate()
    })

    it('terminates the Worker when it receives an invalid response', async () => {
    const client = new ExecutionWorkerClient()

    const execution = client.run('let value = 10')

    const rejection = expect(execution).rejects.toThrow(
        'The Worker returned an invalid response.',
    )

    workers[0].onmessage?.({
        data: {
        type: 'invalid-response',
        requestId: 1,
        },
    } as MessageEvent<unknown>)

    await rejection

    await vi.advanceTimersByTimeAsync(
        RESOURCE_LIMITS.executionTimeoutMs,
    )

    expect(workers[0].terminate).toHaveBeenCalledOnce()

    client.terminate()
    })

    it('clears the timeout when sending a request fails', async () => {
    const client = new ExecutionWorkerClient()
    const workerError = new Error('Failed to send request.')

    postMessageBehavior = () => {
        throw workerError
    }

    const execution = client.run('let value = 10')

    await expect(execution).rejects.toBe(workerError)

    await vi.advanceTimersByTimeAsync(
        RESOURCE_LIMITS.executionTimeoutMs,
    )

    expect(workers[0].terminate).not.toHaveBeenCalled()

    client.terminate()

    expect(workers[0].terminate).toHaveBeenCalledOnce()
    })
})
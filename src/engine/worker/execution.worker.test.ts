import { afterEach, describe, expect, it, vi } from 'vitest'

const runProgramMock = vi.fn()

describe('execution.worker', () => {
  afterEach(() => {
    vi.doUnmock('../execution/runProgram')
    vi.unstubAllGlobals()
    vi.resetModules()
    runProgramMock.mockReset()
  })

  it('does not expose unexpected Worker exception messages', async () => {
    const workerScope = {
      onmessage: null as
        | ((event: MessageEvent<unknown>) => void)
        | null,
      postMessage: vi.fn(),
    }

    vi.stubGlobal('self', workerScope)

    vi.doMock('../execution/runProgram', () => ({
      runProgram: runProgramMock,
    }))

    runProgramMock.mockImplementation(() => {
      throw new Error('Internal implementation details')
    })

    await import('./execution.worker')

    workerScope.onmessage?.({
      data: {
        type: 'run',
        requestId: 1,
        source: 'let score = 10',
      },
    } as MessageEvent<unknown>)

    expect(workerScope.postMessage).toHaveBeenCalledWith({
      type: 'fatal-error',
      requestId: 1,
      message:
        'An unexpected error occurred while processing the execution.',
    })

    expect(workerScope.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal implementation details',
      }),
    )
  })

  it('processes valid execution requests', async () => {
    const workerScope = {
      onmessage: null as
        | ((event: MessageEvent<unknown>) => void)
        | null,
      postMessage: vi.fn(),
    }

    const result = {
      ok: true,
      events: [],
      snapshots: [],
      output: [],
    }

    vi.stubGlobal('self', workerScope)

    vi.doMock('../execution/runProgram', () => ({
      runProgram: runProgramMock,
    }))

    runProgramMock.mockReturnValue(result)

    await import('./execution.worker')

    workerScope.onmessage?.({
      data: {
        type: 'run',
        requestId: 1,
        source: 'console.log("Hello")',
      },
    } as MessageEvent<unknown>)

    expect(runProgramMock).toHaveBeenCalledWith(
      'console.log("Hello")',
    )

    expect(workerScope.postMessage).toHaveBeenCalledWith({
      type: 'result',
      requestId: 1,
      result,
    })
  })

  it('ignores requests with missing or invalid request IDs', async () => {
    const workerScope = {
      onmessage: null as
        | ((event: MessageEvent<unknown>) => void)
        | null,
      postMessage: vi.fn(),
    }

    vi.stubGlobal('self', workerScope)

    vi.doMock('../execution/runProgram', () => ({
      runProgram: runProgramMock,
    }))

    await import('./execution.worker')

    const invalidRequests: unknown[] = [
      { type: 'run', source: '1 + 1' },
      { type: 'run', requestId: '1', source: '1 + 1' },
      { type: 'run', requestId: NaN, source: '1 + 1' },
      { type: 'run', requestId: Infinity, source: '1 + 1' },
      { type: 'run', requestId: 1.5, source: '1 + 1' },
      { type: 'run', requestId: 0, source: '1 + 1' },
      { type: 'run', requestId: -1, source: '1 + 1' },
      {
        type: 'run',
        requestId: Number.MAX_SAFE_INTEGER + 1,
        source: '1 + 1',
      },
    ]

    for (const request of invalidRequests) {
      workerScope.onmessage?.({
        data: request,
      } as MessageEvent<unknown>)
    }

    expect(runProgramMock).not.toHaveBeenCalled()
    expect(workerScope.postMessage).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'wrong request type',
      request: {
        type: 'invalid',
        requestId: 2,
        source: '1 + 1',
      },
    },
    {
      name: 'missing source',
      request: {
        type: 'run',
        requestId: 2,
      },
    },
    {
      name: 'non-string source',
      request: {
        type: 'run',
        requestId: 2,
        source: 123,
      },
    },
  ])('rejects malformed requests: $name', async ({ request }) => {
    const workerScope = {
      onmessage: null as
        | ((event: MessageEvent<unknown>) => void)
        | null,
      postMessage: vi.fn(),
    }

    vi.stubGlobal('self', workerScope)

    vi.doMock('../execution/runProgram', () => ({
      runProgram: runProgramMock,
    }))

    await import('./execution.worker')

    workerScope.onmessage?.({
      data: request,
    } as MessageEvent<unknown>)

    expect(runProgramMock).not.toHaveBeenCalled()

    expect(workerScope.postMessage).toHaveBeenCalledExactlyOnceWith({
      type: 'fatal-error',
      requestId: 2,
      message: 'The Worker received an invalid execution request.',
    })
  })

  it('continues processing valid requests after a malformed request', async () => {
    const workerScope = {
      onmessage: null as
        | ((event: MessageEvent<unknown>) => void)
        | null,
      postMessage: vi.fn(),
    }

    const result = {
      ok: true,
      events: [],
      snapshots: [],
      output: [],
    }

    vi.stubGlobal('self', workerScope)

    vi.doMock('../execution/runProgram', () => ({
      runProgram: runProgramMock,
    }))

    runProgramMock.mockReturnValue(result)

    await import('./execution.worker')

    // First, send a malformed request with a valid request ID.
    workerScope.onmessage?.({
      data: {
        type: 'invalid',
        requestId: 2,
        source: '1 + 1',
      },
    } as MessageEvent<unknown>)

    // Then, send a valid request.
    workerScope.onmessage?.({
      data: {
        type: 'run',
        requestId: 3,
        source: 'console.log("Hello")',
      },
    } as MessageEvent<unknown>)

    expect(runProgramMock).toHaveBeenCalledExactlyOnceWith(
      'console.log("Hello")',
    )

    expect(workerScope.postMessage).toHaveBeenNthCalledWith(1, {
      type: 'fatal-error',
      requestId: 2,
      message: 'The Worker received an invalid execution request.',
    })

    expect(workerScope.postMessage).toHaveBeenNthCalledWith(2, {
      type: 'result',
      requestId: 3,
      result,
    })
  })

  it('ignores non-object message payloads', async () => {
    const workerScope = {
      onmessage: null as
        | ((event: MessageEvent<unknown>) => void)
        | null,
      postMessage: vi.fn(),
    }

    vi.stubGlobal('self', workerScope)

    vi.doMock('../execution/runProgram', () => ({
      runProgram: runProgramMock,
    }))

    await import('./execution.worker')

    const invalidPayloads: unknown[] = [
      null,
      undefined,
      'run',
      123,
      true,
      [],
    ]

    for (const payload of invalidPayloads) {
      workerScope.onmessage?.({
        data: payload,
      } as MessageEvent<unknown>)
    }

    expect(runProgramMock).not.toHaveBeenCalled()
    expect(workerScope.postMessage).not.toHaveBeenCalled()
  })
})
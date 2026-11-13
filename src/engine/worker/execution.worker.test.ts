
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
})

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

    it('rejects oversized source without creating a Worker', async () => {
        const client = new ExecutionWorkerClient()

        const oversizedSource =
            ' '.repeat(RESOURCE_LIMITS.maxSourceBytes + 1)

        await expect(client.run(oversizedSource)).rejects.toThrow(
            `Source code exceeds the maximum allowed size of ${RESOURCE_LIMITS.maxSourceBytes} bytes.`,
        )

        expect(workers).toHaveLength(0)

        client.terminate()
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

    it('rejects a failed result without an error object', async () => {
        const client = new ExecutionWorkerClient()

        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection

        expect(workers[0].terminate).toHaveBeenCalledOnce()

        client.terminate()
    })

    it('rejects responses with too many execution events', async () => {
        const client = new ExecutionWorkerClient()

        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: Array(RESOURCE_LIMITS.maxExecutionEvents + 1).fill({}),
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection

        expect(workers[0].terminate).toHaveBeenCalledOnce()

        client.terminate()
    })

    it('rejects execution events with unsupported event types', async () => {
        const client = new ExecutionWorkerClient()

        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'unknown-event',
                            index: 0,
                            location: null,
                        },
                    ],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection

        expect(workers[0].terminate).toHaveBeenCalledOnce()

        client.terminate()
    })

    it('rejects execution events with malformed source locations', async () => {
        const client = new ExecutionWorkerClient()

        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'program-start',
                            index: 0,
                            location: {
                                start: 'invalid',
                                end: -1,
                                line: null,
                                column: 'wrong',
                            },
                        },
                    ],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection

        expect(workers[0].terminate).toHaveBeenCalledOnce()

        client.terminate()
    })

    it('rejects execution events with oversized variable names', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'variable-declared',
                        index: 0,
                        location: null,
                        name: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                        kind: 'let',
                    }],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects events containing unsupported runtime values', async () => {
        const client = new ExecutionWorkerClient()

        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'variable-initialized',
                            index: 0,
                            location: null,
                            name: 'value',
                            value: {
                                type: 'object',
                                value: { secret: true },
                            },
                        },
                    ],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection

        expect(workers[0].terminate).toHaveBeenCalledOnce()

        client.terminate()
    })

    it('rejects snapshots with invalid execution statuses', async () => {
        const client = new ExecutionWorkerClient()

        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [
                        {
                            index: 0,
                            eventIndex: 0,
                            status: 'unknown-status',
                            scopes: [],
                            callStack: [],
                        },
                    ],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection

        expect(workers[0].terminate).toHaveBeenCalledOnce()

        client.terminate()
    })

    it('rejects snapshots with invalid binding kinds', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [{
                            scopeId: 1,
                            parentScopeId: null,
                            type: 'global',
                            name: 'Global',
                            bindings: [{
                                name: 'value',
                                kind: 'var',
                                initialized: true,
                                value: { type: 'number', value: 10 },
                            }],
                        }],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with malformed call-stack frames', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('function greet() {}')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [],
                        callStack: [{
                            id: 1,
                            functionName: 123,
                            source: null,
                        }],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects console output containing unsupported runtime values', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('console.log(10)')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [],
                    output: [{
                        index: 0,
                        values: [{ type: 'object', value: {} }],
                        location: null,
                    }],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects source locations where the end precedes the start', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'program-start',
                        index: 0,
                        location: {
                            start: 10,
                            end: 5,
                            line: 1,
                            column: 0,
                        },
                    }],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects runtime errors with empty error codes', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('unknownFunction()')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'runtime',
                        message: 'Execution failed.',
                        code: '',
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects parse errors with negative positions', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let =')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'parse',
                        message: 'Parsing failed.',
                        details: {
                            message: 'Unexpected token.',
                            position: -1,
                            line: 1,
                            column: 0,
                        },
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects parse errors with invalid line numbers', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let =')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'parse',
                        message: 'Parsing failed.',
                        details: {
                            message: 'Unexpected token.',
                            position: 4,
                            line: 0,
                            column: 0,
                        },
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects parse errors with negative column numbers', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let =')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'parse',
                        message: 'Parsing failed.',
                        details: {
                            message: 'Unexpected token.',
                            position: 4,
                            line: 1,
                            column: -1,
                        },
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects validation diagnostics with empty messages', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('window.location')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'validation',
                        message: 'Validation failed.',
                        details: [{
                            code: 'UNSUPPORTED_SYNTAX',
                            message: '',
                            nodeType: 'Identifier',
                            line: 1,
                            column: 0,
                        }],
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects validation diagnostics with invalid line numbers', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('window.location')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'validation',
                        message: 'Validation failed.',
                        details: [{
                            code: 'UNSUPPORTED_SYNTAX',
                            message: 'Unsupported syntax.',
                            nodeType: 'Identifier',
                            line: 0,
                            column: 0,
                        }],
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects validation diagnostics with negative column numbers', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('window.location')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'validation',
                        message: 'Validation failed.',
                        details: [{
                            code: 'UNSUPPORTED_SYNTAX',
                            message: 'Unsupported syntax.',
                            nodeType: 'Identifier',
                            line: 1,
                            column: -1,
                        }],
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with too many call-stack frames', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('function greet() {}')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [],
                        callStack: Array.from({ length: 101 }, (_, index) => ({
                            id: index + 1,
                            functionName: 'greet',
                            source: null,
                        })),
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with too many scope bindings', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [{
                            scopeId: 1,
                            parentScopeId: null,
                            type: 'global',
                            name: 'Global',
                            bindings: Array.from({ length: RESOURCE_LIMITS.maxAstNodes + 1 }, (_, index) => ({
                                name: `value${index}`,
                                kind: 'let',
                                initialized: true,
                                value: { type: 'number', value: index },
                            })),
                        }],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with oversized binding names', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [{
                            scopeId: 1,
                            parentScopeId: null,
                            type: 'global',
                            name: 'Global',
                            bindings: [{
                                name: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                                kind: 'let',
                                initialized: true,
                                value: { type: 'number', value: 10 },
                            }],
                        }],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with too many scopes', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: Array.from({ length: RESOURCE_LIMITS.maxAstNodes + 1 }, (_, index) => ({
                            scopeId: index,
                            parentScopeId: null,
                            type: 'global',
                            name: 'Global',
                            bindings: [],
                        })),
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects console events with too many runtime values', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('console.log(1)')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'console-output',
                        index: 0,
                        location: null,
                        values: Array.from({ length: RESOURCE_LIMITS.maxAstNodes + 1 }, (_, index) => ({
                            type: 'number',
                            value: index,
                        })),
                    }],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects console output entries with too many runtime values', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('console.log(1)')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [],
                    output: [{
                        index: 0,
                        values: Array.from({ length: RESOURCE_LIMITS.maxAstNodes + 1 }, (_, index) => ({
                            type: 'number',
                            value: index,
                        })),
                        location: null,
                    }],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects validation errors with too many diagnostics', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('window.location')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'validation',
                        message: 'Validation failed.',
                        details: Array.from({ length: RESOURCE_LIMITS.maxAstNodes + 1 }, () => ({
                            code: 'UNSUPPORTED_SYNTAX',
                            message: 'Unsupported syntax.',
                            nodeType: 'Identifier',
                            line: 1,
                            column: 0,
                        })),
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects execution responses with sparse event arrays', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let x = 1')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: new Array(1),
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects execution responses with sparse snapshot arrays', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let x = 1')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: new Array(1),
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with sparse binding arrays', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let x = 1')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [
                        {
                            index: 0,
                            eventIndex: 0,
                            status: 'running',
                            scopes: [
                                {
                                    scopeId: 0,
                                    parentScopeId: null,
                                    type: 'global',
                                    name: 'Global',
                                    bindings: new Array(1),
                                },
                            ],
                            callStack: [],
                        },
                    ],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with sparse call-stack arrays', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let x = 1')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [
                        {
                            index: 0,
                            eventIndex: 0,
                            status: 'running',
                            scopes: [],
                            callStack: new Array(1),
                        },
                    ],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects console events with sparse value arrays', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('console.log(1)')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'console-output',
                            index: 0,
                            location: null,
                            values: new Array(1),
                        },
                    ],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects console output entries with sparse value arrays', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('console.log(1)')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [],
                    output: [
                        {
                            index: 0,
                            values: new Array(1),
                            location: null,
                        },
                    ],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects validation errors with sparse diagnostic arrays', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('window.location')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'validation',
                        message: 'Validation failed.',
                        details: new Array(1),
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('accepts non-finite JavaScript numbers in runtime values', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('console.log(1 / 0)')

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'console-output',
                            index: 0,
                            location: null,
                            values: [
                                { type: 'number', value: Infinity },
                                { type: 'number', value: -Infinity },
                                { type: 'number', value: NaN },
                            ],
                        },
                    ],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await expect(execution).resolves.toMatchObject({
            ok: true,
        })

        client.terminate()
    })

    it('rejects snapshots with oversized function names', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('function greet() {}')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [],
                        callStack: [{
                            id: 1,
                            functionName: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                            source: null,
                        }],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with oversized scope names', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [{
                            scopeId: 1,
                            parentScopeId: null,
                            type: 'global',
                            name: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                            bindings: [],
                        }],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects execution events with oversized error messages', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'execution-error',
                        index: 0,
                        location: null,
                        message: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                        code: 'EXECUTION_ERROR',
                    }],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects execution events with oversized function names', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('function greet() {}')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'function-call',
                        index: 0,
                        location: null,
                        functionName: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                        frameId: 1,
                    }],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects fatal Worker errors with oversized messages', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'fatal-error',
                requestId: 1,
                message: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects runtime errors with oversized messages', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('unknownFunction()')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'runtime',
                        message: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                        code: 'UNKNOWN_RUNTIME_ERROR',
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects parse errors with oversized messages', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let =')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'parse',
                        message: 'Parse failed.',
                        details: {
                            message: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                            position: 0,
                            line: 1,
                            column: 0,
                        },
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects validation diagnostics with oversized messages', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'validation',
                        message: 'Validation failed.',
                        details: [{
                            code: 'UNSUPPORTED_SYNTAX',
                            message: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                            nodeType: 'UnknownExpression',
                            line: 1,
                            column: 0,
                        }],
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects validation diagnostics with oversized node types', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'validation',
                        message: 'Validation failed.',
                        details: [{
                            code: 'UNSUPPORTED_SYNTAX',
                            message: 'Unsupported syntax.',
                            nodeType: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                            line: 1,
                            column: 0,
                        }],
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects validation errors with oversized top-level messages', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: false,
                    error: {
                        phase: 'validation',
                        message: 'a'.repeat(RESOURCE_LIMITS.maxStringLength + 1),
                        details: [{
                            code: 'UNSUPPORTED_SYNTAX',
                            message: 'Unsupported syntax.',
                            nodeType: 'UnknownExpression',
                            line: 1,
                            column: 0,
                        }],
                    },
                    events: [],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects execution events with unsafe indexes', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'program-start',
                            index: Number.MAX_SAFE_INTEGER + 1,
                            location: null,
                        },
                    ],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects execution events with non-sequential indexes', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'program-start',
                            index: 1,
                            location: null,
                        },
                    ],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with unsafe scope IDs', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [{
                            scopeId: Number.MAX_SAFE_INTEGER + 1,
                            parentScopeId: null,
                            type: 'global',
                            name: 'Global',
                            bindings: [],
                        }],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with duplicate scope IDs', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'program-start',
                        index: 0,
                        location: null,
                    }],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [
                            {
                                scopeId: 1,
                                parentScopeId: null,
                                type: 'global',
                                name: 'Global',
                                bindings: [],
                            },
                            {
                                scopeId: 1,
                                parentScopeId: null,
                                type: 'block',
                                name: 'Block',
                                bindings: [],
                            },
                        ],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with missing parent scope references', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'program-start',
                        index: 0,
                        location: null,
                    }],
                    snapshots: [{
                        index: 0,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [{
                            scopeId: 1,
                            parentScopeId: 99,
                            type: 'block',
                            name: 'Block',
                            bindings: [],
                        }],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with circular parent scope references', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'program-start',
                            index: 0,
                            location: null,
                        },
                    ],
                    snapshots: [
                        {
                            index: 0,
                            eventIndex: 0,
                            status: 'running',
                            scopes: [
                                {
                                    scopeId: 1,
                                    parentScopeId: 2,
                                    type: 'global',
                                    name: 'Global',
                                    bindings: [],
                                },
                                {
                                    scopeId: 2,
                                    parentScopeId: 1,
                                    type: 'block',
                                    name: 'Block',
                                    bindings: [],
                                },
                            ],
                            callStack: [],
                        },
                    ],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with unsafe indexes', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: Number.MAX_SAFE_INTEGER + 1,
                        eventIndex: 0,
                        status: 'running',
                        scopes: [],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with non-sequential indexes', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'program-start',
                            index: 0,
                            location: null,
                        },
                    ],
                    snapshots: [
                        {
                            index: 1,
                            eventIndex: 0,
                            status: 'running',
                            scopes: [],
                            callStack: [],
                        },
                    ],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects console output entries with non-sequential indexes', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('console.log(10)')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'program-start',
                            index: 0,
                            location: null,
                        },
                    ],
                    snapshots: [],
                    output: [
                        {
                            index: 1,
                            values: [{ type: 'number', value: 10 }],
                            location: null,
                        },
                    ],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots with unsafe event indexes', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots: [{
                        index: 0,
                        eventIndex: Number.MAX_SAFE_INTEGER + 1,
                        status: 'running',
                        scopes: [],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots referencing non-existent events', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [
                        {
                            type: 'program-start',
                            index: 0,
                            location: null,
                        },
                    ],
                    snapshots: [{
                        index: 0,
                        eventIndex: 1,
                        status: 'running',
                        scopes: [],
                        callStack: [],
                    }],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects loop events with unsafe iteration values', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'loop-iteration',
                        index: 0,
                        iteration: Number.MAX_SAFE_INTEGER + 1,
                        location: null,
                    }],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects function-call events with unsafe frame IDs', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'function-call',
                        index: 0,
                        functionName: 'test',
                        frameId: Number.MAX_SAFE_INTEGER + 1,
                        location: null,
                    }],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects function-return events with unsafe frame IDs', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('const value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [{
                        type: 'function-return',
                        index: 0,
                        functionName: 'test',
                        frameId: Number.MAX_SAFE_INTEGER + 1,
                        value: { type: 'undefined' },
                        location: null,
                    }],
                    snapshots: [],
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects snapshots exceeding the cumulative binding limit', async () => {
        const client = new ExecutionWorkerClient()
        const execution = client.run('let value = 10')

        const rejection = expect(execution).rejects.toThrow(
            'The Worker returned an invalid response.',
        )

        const bindingsPerSnapshot =
            Math.floor(RESOURCE_LIMITS.maxSnapshotBindingEntries / 6) + 1

        const snapshots = Array.from({ length: 6 }, (_, index) => ({
            index,
            eventIndex: index,
            status: 'running',
            scopes: [{
                scopeId: index + 1,
                parentScopeId: null,
                type: 'global',
                name: 'Global',
                bindings: Array.from(
                    { length: bindingsPerSnapshot },
                    (_, bindingIndex) => ({
                        name: `value${bindingIndex}`,
                        kind: 'let',
                        initialized: true,
                        value: { type: 'number', value: bindingIndex },
                    }),
                ),
            }],
            callStack: [],
        }))

        workers[0].onmessage?.({
            data: {
                type: 'result',
                requestId: 1,
                result: {
                    ok: true,
                    events: [],
                    snapshots,
                    output: [],
                },
            },
        } as MessageEvent<unknown>)

        await rejection
        expect(workers[0].terminate).toHaveBeenCalledOnce()
        client.terminate()
    })

    it('rejects when Worker construction fails', async () => {
        const constructionError = new Error('Worker construction failed.')

        vi.stubGlobal(
            'Worker',
            class {
                constructor() {
                    throw constructionError
                }
            },
        )

        const client = new ExecutionWorkerClient()

        await expect(client.run('let value = 10')).rejects.toBe(
            constructionError,
        )
    })
})
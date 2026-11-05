import { expect, test } from '@playwright/test'
import type { ProgramExecutionResult } from '../src/engine/execution/types'

test('executes JavaScript in a real Web Worker', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const modulePath = '/src/engine/worker/ExecutionWorkerClient.ts'

   const { ExecutionWorkerClient } = await import(
  /* @vite-ignore */ modulePath
    )
    const client = new ExecutionWorkerClient()

    try {
      return await client.run(`
        let score = 10
        let bonus = 5
        let total = score + bonus
      `)
    } finally {
      client.terminate()
    }
  })

  expect(result.ok).toBe(true)

  if (result.ok) {
    expect(result.events[0].type).toBe('program-start')
    expect(result.events.at(-1)?.type).toBe('program-complete')
    expect(result.snapshots.length).toBeGreaterThan(0)
  }
})

test('returns runtime errors from the Worker', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {

    const modulePath = '/src/engine/worker/ExecutionWorkerClient.ts'

const { ExecutionWorkerClient } = await import(
  /* @vite-ignore */ modulePath
)

    const client = new ExecutionWorkerClient()

    try {
      return await client.run(`
        const score = 10
        score = 20
      `)
    } finally {
      client.terminate()
    }
  })

  expect(result.ok).toBe(false)

  if (!result.ok) {
    expect(result.error.phase).toBe('runtime')

    if (result.error.phase === 'runtime') {
      expect(result.error.code).toBe('CONST_ASSIGNMENT')
    }
  }
})


test('cancels pending execution and can run again', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const modulePath = '/src/engine/worker/ExecutionWorkerClient.ts'
    const { ExecutionWorkerClient } = await import(
      /* @vite-ignore */ modulePath
    )

    const client = new ExecutionWorkerClient()

    try {
      const pendingExecution = client.run('let score = 10')

      client.terminate()

      let cancellationMessage = ''

      try {
        await pendingExecution
      } catch (error) {
        cancellationMessage =
          error instanceof Error ? error.message : ''
      }

      const recoveryResult = await client.run('let score = 20')

      return {
        cancellationMessage,
        recoveryResult,
      }
    } finally {
      client.terminate()
    }
  })

  expect(result.cancellationMessage).toBe('Execution was cancelled.')
  expect(result.recoveryResult.ok).toBe(true)
})



test('keeps the main thread responsive during Worker execution', async ({ page }) => {
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const modulePath = '/src/engine/worker/ExecutionWorkerClient.ts'
    const { ExecutionWorkerClient } = await import(
      /* @vite-ignore */ modulePath
    )

    const client = new ExecutionWorkerClient()

    try {
      let settled = false

      const pendingExecution = client
        .run(`
          let total = 0

          for (let i = 0; i < 10000; i++) {
            total = total + 1
          }
        `)
        .then((executionResult: ProgramExecutionResult) => {
          settled = true
          return executionResult
        })

      // Give the main thread an opportunity to process a timer.
      await new Promise((resolve) => setTimeout(resolve, 0))

      const executionStillPending = !settled

      const executionResult = await pendingExecution

      return {
        executionStillPending,
        executionResult,
      }
    } finally {
      client.terminate()
    }
  })

  expect(result.executionStillPending).toBe(true)
  expect(result.executionResult.ok).toBe(true)
})


test('rejects malformed Worker requests with a valid request ID', async ({ page }) => {
  await page.goto('/')

  const response = await page.evaluate(async () => {
    const worker = new Worker(
      new URL('/src/engine/worker/execution.worker.ts', window.location.origin),
      { type: 'module' },
    )

    try {
      return await new Promise<unknown>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          reject(new Error('Worker did not respond to the malformed request.'))
        }, 5000)

        worker.onmessage = (event: MessageEvent<unknown>) => {
          window.clearTimeout(timeout)
          resolve(event.data)
        }

        worker.onerror = (event) => {
          window.clearTimeout(timeout)
          reject(new Error(event.message))
        }

        worker.postMessage({
          type: 'invalid-request',
          requestId: 123,
          source: 'let x = 1',
        })
      })
    } finally {
      worker.terminate()
    }
  })

  expect(response).toEqual({
    type: 'fatal-error',
    requestId: 123,
    message: 'The Worker received an invalid execution request.',
  })
})
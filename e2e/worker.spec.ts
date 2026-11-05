
import { expect, test } from '@playwright/test'

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

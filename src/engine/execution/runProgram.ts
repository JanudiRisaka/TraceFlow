
import type { Statement } from 'acorn'

import { parseJavaScript } from '../parser/parse'
import { validateJavaScript } from '../validator/validate'
import { Environment, RuntimeError } from '../runtime/Environment'
import {
  createExecutionContext,
  executeStatement,
} from '../runtime/execute'

import type { ExecutionEventInput } from '../trace/ExecutionRecorder'
import type { ProgramExecutionResult } from './types'
import { ResourceLimitError } from '../ResourceLimitError'

export function runProgram(source: string): ProgramExecutionResult {
  const context = createExecutionContext()
  const environment = new Environment(null, {
    type: 'global',
    name: 'Global',
  })

  try {
    // Stage 1: Parse the source code.
    const parseResult = parseJavaScript(source)

    if (parseResult.ok === false) {
      return {
        ok: false,
        error: {
          phase: 'parse',
          message: parseResult.error.message,
          details: parseResult.error,
        },
        events: [],
        snapshots: [],
        output: [],
      }
    }

    // Stage 2: Reject syntax the interpreter does not support.
    const validationResult = validateJavaScript(parseResult.ast)

    if (validationResult.ok === false) {
      return {
        ok: false,
        error: {
          phase: 'validation',
          message: 'The program contains unsupported JavaScript syntax.',
          details: validationResult.diagnostics,
        },
        events: [],
        snapshots: [],
        output: [],
      }
    }

    // Stage 3: Execute each top-level statement.
    const startEvent: ExecutionEventInput = {
      type: 'program-start',
      location: null,
    }

    const recordedStart = context.eventRecorder.record(startEvent)

    context.snapshotRecorder.capture(
      recordedStart.index,
      'running',
      environment,
      context.errorCallStack ?? context.callStack,
    )

    for (const statement of parseResult.ast.body) {
      executeStatement(
        statement as Statement,
        environment,
        context,
      )
    }

    // Record successful completion.
    const completeEvent: ExecutionEventInput = {
      type: 'program-complete',
      location: null,
    }

    const recordedComplete =
      context.eventRecorder.record(completeEvent)

    context.snapshotRecorder.capture(
      recordedComplete.index,
      'completed',
      environment,
      context.callStack,
    )

    return {
      ok: true,
      events: context.eventRecorder.getEvents(),
      snapshots: context.snapshotRecorder.getSnapshots(),
      output: context.consoleOutputRecorder.getEntries(),
    }
  } catch (error: unknown) {
    const isExpectedError =
      error instanceof RuntimeError ||
      error instanceof ResourceLimitError

    const message = isExpectedError
      ? error.message
      : 'An unexpected error occurred during program execution.'

    const code =
      error instanceof ResourceLimitError
        ? error.code
        : error instanceof RuntimeError
          ? error.code
          : 'UNKNOWN_RUNTIME_ERROR'

    // Record the execution failure unless a resource limit
    // prevents further trace recording.
    if (!(error instanceof ResourceLimitError)) {
      try {
        const errorEvent: ExecutionEventInput = {
          type: 'execution-error',
          location: null,
          message,
          code,
        }

        const recordedError = context.eventRecorder.record(errorEvent)

        context.snapshotRecorder.capture(
          recordedError.index,
          'error',
          environment,
          context.errorCallStack ?? context.callStack,
          context.errorEnvironments ?? [],
        )
      } catch {
        // Do not expose or replace the original execution error
        // if recording the error also fails.
      }
    }

    return {
      ok: false,
      error: {
        phase: 'runtime',
        message,
        code,
      },
      events: context.eventRecorder.getEvents(),
      snapshots: context.snapshotRecorder.getSnapshots(),
      output: context.consoleOutputRecorder.getEntries(),
    }
  }
}

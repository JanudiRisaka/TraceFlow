
import type { ProgramExecutionResult } from '../execution/types'

export type ExecutionWorkerRequest = {
  type: 'run'
  requestId: number
  source: string
}

export type ExecutionWorkerResponse =
  | {
      type: 'result'
      requestId: number
      result: ProgramExecutionResult
    }
  | {
      type: 'fatal-error'
      requestId: number
      message: string
    }

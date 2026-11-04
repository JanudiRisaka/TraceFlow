import type { ParseError } from '../parser/parse'
import type { ValidationDiagnostic } from '../validator/validate'
import type { ExecutionEvent, ExecutionSnapshot } from '../trace/types'

export type ProgramExecutionError =
  | {
      phase: 'parse'
      message: string
      details: ParseError
    }
  | {
      phase: 'validation'
      message: string
      details: ValidationDiagnostic[]
    }
  | {
      phase: 'runtime'
      message: string
      code: string
    }

export type ProgramExecutionResult =
  | {
      ok: true
      events: ExecutionEvent[]
      snapshots: ExecutionSnapshot[]
    }
  | {
      ok: false
      error: ProgramExecutionError
      events: ExecutionEvent[]
      snapshots: ExecutionSnapshot[]
    }
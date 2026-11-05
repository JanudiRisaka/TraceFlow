export type SourceLocation = {
  start: number
  end: number
  line: number
  column: number
}

export type RuntimeValueSnapshot =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'undefined' }
  | { type: 'function'; name: string }

export type BindingSnapshot = {
  name: string
  kind: 'let' | 'const'
  initialized: boolean
  value: RuntimeValueSnapshot | null
}

export type ScopeSnapshot = {
  scopeId: number
  parentScopeId: number | null
  bindings: BindingSnapshot[]
}

export type CallFrameSnapshot = {
  id: number
  functionName: string
  source: SourceLocation | null
}

export type ExecutionStatus = 'running' | 'completed' | 'error'

export type ExecutionSnapshot = {
  index: number
  eventIndex: number
  status: ExecutionStatus
  scopes: ScopeSnapshot[]
  callStack: CallFrameSnapshot[]
}

export type BaseExecutionEvent = {
  index: number
  location: SourceLocation | null
}

export type ExecutionEvent =
  | (BaseExecutionEvent & {
      type: 'program-start'
    })
  | (BaseExecutionEvent & {
      type: 'variable-declared'
      name: string
      kind: 'let' | 'const'
    })
  | (BaseExecutionEvent & {
      type: 'variable-initialized'
      name: string
      value: RuntimeValueSnapshot
    })
  | (BaseExecutionEvent & {
      type: 'variable-assigned'
      name: string
      previousValue: RuntimeValueSnapshot
      newValue: RuntimeValueSnapshot
    })
  | (BaseExecutionEvent & {
      type: 'branch-taken'
      branch: 'consequent' | 'alternate'
    })
  | (BaseExecutionEvent & {
      type: 'loop-iteration'
      iteration: number
    })
  | (BaseExecutionEvent & {
      type: 'function-call'
      functionName: string
      frameId: number
    })
  | (BaseExecutionEvent & {
      type: 'function-return'
      functionName: string
      frameId: number
      value: RuntimeValueSnapshot
    })
  | (BaseExecutionEvent & {
    type: 'console-output'
    values: RuntimeValueSnapshot[]
  })
  | (BaseExecutionEvent & {
      type: 'execution-error'
      message: string
      code: string
    })
  | (BaseExecutionEvent & {
      type: 'program-complete'
    })

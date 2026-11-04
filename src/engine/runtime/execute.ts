
import type { Expression, Statement } from 'acorn'
import { Environment, RuntimeError } from './Environment'
import {
  evaluateExpression,
  isTruthy,
  type FunctionInvoker,
  type AssignmentObserver,
} from './evaluate'
import {
  createFunction,
  createUndefined,
  type RuntimeValue,
  type FunctionRuntimeValue,
} from './value'
import {
  ExecutionRecorder,
  toRuntimeValueSnapshot,
  type ExecutionEventInput,
} from '../trace/ExecutionRecorder'
import { ExecutionSnapshotRecorder } from '../trace/ExecutionSnapshotRecorder'
import type {
  CallFrameSnapshot,
  SourceLocation,
  ExecutionEvent,
} from '../trace/types'


export type ExecutionContext = {
  // Loop limits
  loopIterations: number
  maxLoopIterations: number

  // Function call limits
  functionCallDepth: number
  maxFunctionCallDepth: number

  // Execution history
  eventRecorder: ExecutionRecorder
  snapshotRecorder: ExecutionSnapshotRecorder

  // Active function calls
  callStack: CallFrameSnapshot[]
  nextFrameId: number
}

const DEFAULT_MAX_LOOP_ITERATIONS = 10_000
const DEFAULT_MAX_FUNCTION_CALL_DEPTH = 100

export function createExecutionContext(): ExecutionContext {
  return {
    loopIterations: 0,
    maxLoopIterations: DEFAULT_MAX_LOOP_ITERATIONS,

    functionCallDepth: 0,
    maxFunctionCallDepth: DEFAULT_MAX_FUNCTION_CALL_DEPTH,

    eventRecorder: new ExecutionRecorder(),
    snapshotRecorder: new ExecutionSnapshotRecorder(),

    callStack: [],
    nextFrameId: 1,
  }
}

type AstNode = {
  type: string
  [key: string]: unknown
}

type VariableDeclaratorNode = {
  id: AstNode
  init: Expression | null
}

type VariableDeclarationNode = {
  kind: string
  declarations: VariableDeclaratorNode[]
}

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  )
}

export class ReturnSignal {
  public readonly value: RuntimeValue

  constructor(value: RuntimeValue) {
    this.value = value
  }
}

type SourceNode = {
  start?: number
  end?: number
  loc?: {
    start: {
      line: number
      column: number
    }
  } | null
}

function getSourceLocation(node: SourceNode): SourceLocation | null {
  if (
    node.start === undefined ||
    node.end === undefined ||
    node.loc === null ||
    node.loc === undefined
  ) {
    return null
  }

  return {
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    column: node.loc.start.column + 1,
  }
}

function recordExecutionEvent(
  context: ExecutionContext,
  event: ExecutionEventInput,
  environment: Environment,
): ExecutionEvent {
  const recordedEvent = context.eventRecorder.record(event)

  context.snapshotRecorder.capture(
    recordedEvent.index,
    'running',
    environment,
    context.callStack,
  )

  return recordedEvent
}

function invokeFunction(
  fn: FunctionRuntimeValue,
  args: RuntimeValue[],
  context: ExecutionContext,
): RuntimeValue {
  if (context.functionCallDepth >= context.maxFunctionCallDepth) {
    throw new RuntimeError(
      `Execution stopped: the function call depth limit of ${context.maxFunctionCallDepth} was reached.`,
      'EXECUTION_LIMIT_EXCEEDED',
    )
  }

  context.functionCallDepth += 1

  try {
    const functionEnvironment = new Environment(fn.closure)

    // Initialize function parameters.
    for (let index = 0; index < fn.declaration.params.length; index += 1) {
      const parameter = fn.declaration.params[index]

      if (parameter.type !== 'Identifier') {
        throw new RuntimeError(
          'Only simple identifier parameters are supported.',
          'UNSUPPORTED_EXPRESSION',
        )
      }

      const parameterName = parameter.name

      functionEnvironment.declare(parameterName, 'let')

      functionEnvironment.initialize(
        parameterName,
        args[index] ?? createUndefined(),
      )
    }

    try {
      executeStatement(
        fn.declaration.body,
        functionEnvironment,
        context,
      )
    } catch (error: unknown) {
      if (error instanceof ReturnSignal) {
        return error.value
      }

      throw error
    }

    // A function without an explicit return produces undefined.
    return createUndefined()
  } finally {
    context.functionCallDepth -= 1
  }
}

export function executeStatement(
  statement: Statement,
  environment: Environment,
  context: ExecutionContext = createExecutionContext(),
): void {
  const callFunction: FunctionInvoker = (fn, args) =>
    invokeFunction(fn, args, context)

  const onAssignment: AssignmentObserver = (
  name,
  previousValue,
  newValue,
  location,
) => {
  recordExecutionEvent(
    context,
    {
      type: 'variable-assigned',
      location,
      name,
      previousValue: toRuntimeValueSnapshot(previousValue),
      newValue: toRuntimeValueSnapshot(newValue),
    },
    environment,
  )
}

  switch (statement.type) {
case 'VariableDeclaration': {
  const declaration =
    statement as unknown as VariableDeclarationNode

  if (declaration.kind !== 'let' && declaration.kind !== 'const') {
    throw new RuntimeError(
      'Only let and const declarations are supported.',
      'UNSUPPORTED_EXPRESSION',
    )
  }

  // First declare every binding to preserve temporal dead zone behaviour.
  for (const item of declaration.declarations) {
    if (!isAstNode(item.id) || item.id.type !== 'Identifier') {
      throw new RuntimeError(
        'Only simple variable identifiers are supported.',
        'UNSUPPORTED_EXPRESSION',
      )
    }

    const name = item.id.name

    if (typeof name !== 'string') {
      throw new RuntimeError(
        'Invalid variable identifier.',
        'UNSUPPORTED_EXPRESSION',
      )
    }

    environment.declare(name, declaration.kind)
  }

  // Record declarations after all bindings have been created.
  for (const item of declaration.declarations) {
    const name = item.id.name as string

    recordExecutionEvent(
      context,
      {
        type: 'variable-declared',
        location: getSourceLocation(item as SourceNode),
        name,
        kind: declaration.kind,
      },
      environment,
    )
  }

  // Initialize variables in source order.
  for (const item of declaration.declarations) {
    const name = item.id.name as string

    const value =
      item.init === null
        ? createUndefined()
        : evaluateExpression(
            item.init,
            environment,
            callFunction,
            onAssignment,
          )

    environment.initialize(name, value)

    recordExecutionEvent(
      context,
      {
        type: 'variable-initialized',
        location: getSourceLocation(item as SourceNode),
        name,
        value: toRuntimeValueSnapshot(value),
      },
      environment,
    )
  }

  return
}

case 'ExpressionStatement': {
  evaluateExpression(
    statement.expression,
    environment,
    callFunction,
    onAssignment,
  )
  return
}

    case 'BlockStatement': {
    const blockEnvironment = new Environment(environment)

    for (const bodyStatement of statement.body) {
        executeStatement(bodyStatement, blockEnvironment, context)  }

    return
    }

case 'IfStatement': {
  const condition = evaluateExpression(
    statement.test,
    environment,
    callFunction,
    onAssignment,
  )

  const branch = isTruthy(condition) ? 'consequent' : 'alternate'

  recordExecutionEvent(
    context,
    {
      type: 'branch-taken',
      location: getSourceLocation(statement),
      branch,
    },
    environment,
  )

  if (branch === 'consequent') {
    if (statement.consequent === undefined) {
      throw new RuntimeError(
        'The if statement has no consequent.',
        'UNSUPPORTED_EXPRESSION',
      )
    }

    executeStatement(statement.consequent, environment, context)
  } else if (
    statement.alternate !== null &&
    statement.alternate !== undefined
  ) {
    executeStatement(statement.alternate, environment, context)
  }

  return
}

    case 'ForStatement': {
      const loopEnvironment = new Environment(environment)

      // Execute the initializer once, if one exists.
      if (statement.init !== null && statement.init !== undefined) {
        if (statement.init.type === 'VariableDeclaration') {
          executeStatement(statement.init, loopEnvironment, context)
        } else {
          evaluateExpression(
            statement.init,
            loopEnvironment,
            callFunction,
            onAssignment,
          )
        }
      }

      // A missing condition means the loop continues indefinitely,
      // until the execution limit stops it.
      while (
        statement.test === null ||
        statement.test === undefined ||
        isTruthy(evaluateExpression(
          statement.test,
          loopEnvironment,
          callFunction,
          onAssignment,
        ),
      )
      ) {
        if (context.loopIterations >= context.maxLoopIterations) {
          throw new RuntimeError(
            `Execution stopped: the loop iteration limit of ${context.maxLoopIterations} was reached.`,
            'EXECUTION_LIMIT_EXCEEDED',
          )
        }

        context.loopIterations += 1

        recordExecutionEvent(
          context,
          {
            type: 'loop-iteration',
            location: getSourceLocation(statement),
            iteration: context.loopIterations,
          },
          loopEnvironment,
        )

        if (statement.body === undefined) {
          throw new RuntimeError(
            'The for loop has no body.',
            'UNSUPPORTED_EXPRESSION',
          )
        }

        executeStatement(statement.body, loopEnvironment, context)

        // Execute the update expression, if one exists.
        if (statement.update !== null && statement.update !== undefined) {
          evaluateExpression(
            statement.update,
            loopEnvironment,
            callFunction,
            onAssignment,
          )
        }
      }

      return
    }

    case 'FunctionDeclaration': {
    if (statement.id === null) {
        throw new RuntimeError(
        'Function declarations must have a name.',
        'UNSUPPORTED_EXPRESSION',
        )
    }

    const functionName = statement.id.name

    environment.declare(functionName, 'let')

    const functionValue = createFunction(statement, environment)

    environment.initialize(functionName, functionValue)

    return
    }

    case 'ReturnStatement': {
        const value =
        statement.argument === null || statement.argument === undefined
            ? createUndefined()
            : evaluateExpression(
              statement.argument,
              environment,
              callFunction,
              onAssignment,
            )

        throw new ReturnSignal(value)
    }

    default:
      throw new RuntimeError(
        `Statement "${statement.type}" is not supported yet.`,
        'UNSUPPORTED_EXPRESSION',
      )
  }
}

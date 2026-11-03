
import type { Expression, Statement } from 'acorn'
import { Environment, RuntimeError } from './Environment'
import { evaluateExpression, isTruthy } from './evaluate'
import { createUndefined } from './value'

export type ExecutionContext = {
  loopIterations: number
  maxLoopIterations: number
}

const DEFAULT_MAX_LOOP_ITERATIONS = 10_000

export function createExecutionContext(): ExecutionContext {
  return {
    loopIterations: 0,
    maxLoopIterations: DEFAULT_MAX_LOOP_ITERATIONS,
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

export function executeStatement(
  statement: Statement,
  environment: Environment,
  context: ExecutionContext = createExecutionContext(),
): void {
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

      // Declare all names first, so references to later declarations
      // in the same statement correctly encounter the temporal dead zone.
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

      // Initialize each variable in source order.
      for (const item of declaration.declarations) {
        const name = item.id.name as string

        const value = item.init === null
          ? createUndefined()
          : evaluateExpression(item.init, environment)

        environment.initialize(name, value)
      }

      return
    }

    case 'ExpressionStatement': {
      evaluateExpression(statement.expression, environment)
      return
    }

case 'BlockStatement': {
  const blockEnvironment = new Environment(environment)

  for (const bodyStatement of statement.body) {
    executeStatement(bodyStatement, blockEnvironment, context)  }

  return
}

  case 'IfStatement': {
  const condition = evaluateExpression(statement.test, environment)

  if (isTruthy(condition)) {
    if (statement.consequent === undefined) {
      throw new RuntimeError(
        'The if statement has no consequent.',
        'UNSUPPORTED_EXPRESSION',
      )
    }

    executeStatement(statement.consequent, environment, context)
  } else if (statement.alternate !== null && statement.alternate !== undefined) {
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
          evaluateExpression(statement.init, loopEnvironment)
        }
      }

      // A missing condition means the loop continues indefinitely,
      // until the execution limit stops it.
      while (
        statement.test === null ||
        statement.test === undefined ||
        isTruthy(evaluateExpression(statement.test, loopEnvironment))
      ) {
        if (context.loopIterations >= context.maxLoopIterations) {
          throw new RuntimeError(
            `Execution stopped: the loop iteration limit of ${context.maxLoopIterations} was reached.`,
            'EXECUTION_LIMIT_EXCEEDED',
          )
        }

        context.loopIterations += 1

        if (statement.body === undefined) {
          throw new RuntimeError(
            'The for loop has no body.',
            'UNSUPPORTED_EXPRESSION',
          )
        }

        executeStatement(statement.body, loopEnvironment, context)

        // Execute the update expression, if one exists.
        if (statement.update !== null && statement.update !== undefined) {
          evaluateExpression(statement.update, loopEnvironment)
        }
      }

      return
    }

    default:
      throw new RuntimeError(
        `Statement "${statement.type}" is not supported yet.`,
        'UNSUPPORTED_EXPRESSION',
      )
  }
}

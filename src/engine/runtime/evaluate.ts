
import type { Expression } from 'acorn'
import { Environment, RuntimeError } from './Environment'
import {
  createBoolean,
  createNull,
  createNumber,
  createString,
  type RuntimeValue,
} from './value'

type AstExpression = {
  type: string
  [key: string]: unknown
}

function asExpression(value: unknown): AstExpression {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    typeof value.type !== 'string'
  ) {
    throw new RuntimeError(
      'Invalid expression node.',
      'UNSUPPORTED_EXPRESSION',
    )
  }

  return value as AstExpression
}

function getNumber(value: RuntimeValue): number {
  switch (value.type) {
    case 'number':
      return value.value
    case 'string':
      return Number(value.value)
    case 'boolean':
      return value.value ? 1 : 0
    case 'null':
      return 0
    case 'undefined':
      return Number.NaN
  }
}

function getString(value: RuntimeValue): string {
  switch (value.type) {
    case 'string':
      return value.value
    case 'number':
      return String(value.value)
    case 'boolean':
      return String(value.value)
    case 'null':
      return 'null'
    case 'undefined':
      return 'undefined'
  }
}

export function isTruthy(value: RuntimeValue): boolean {
    switch (value.type) {
    case 'boolean':
      return value.value
    case 'number':
      return value.value !== 0 && !Number.isNaN(value.value)
    case 'string':
      return value.value.length > 0
    case 'null':
    case 'undefined':
      return false
  }
}

function strictEqual(
  left: RuntimeValue,
  right: RuntimeValue,
): boolean {
  if (left.type !== right.type) {
    return false
  }

  if (left.type === 'null' || left.type === 'undefined') {
    return true
  }

  if (
    left.type === 'number' &&
    right.type === 'number'
  ) {
    return left.value === right.value
  }

  if (
    left.type === 'string' &&
    right.type === 'string'
  ) {
    return left.value === right.value
  }

  if (
    left.type === 'boolean' &&
    right.type === 'boolean'
  ) {
    return left.value === right.value
  }

  return false
}

function looseEqual(
  left: RuntimeValue,
  right: RuntimeValue,
): boolean {
  if (left.type === right.type) {
    return strictEqual(left, right)
  }

  if (
    (left.type === 'null' && right.type === 'undefined') ||
    (left.type === 'undefined' && right.type === 'null')
  ) {
    return true
  }

  if (left.type === 'boolean') {
    return looseEqual(createNumber(getNumber(left)), right)
  }

  if (right.type === 'boolean') {
    return looseEqual(left, createNumber(getNumber(right)))
  }

  if (
    (left.type === 'number' && right.type === 'string') ||
    (left.type === 'string' && right.type === 'number')
  ) {
    return getNumber(left) === getNumber(right)
  }

  return false
}

function evaluateBinaryExpression(
  operator: string,
  left: RuntimeValue,
  right: RuntimeValue,
): RuntimeValue {
  switch (operator) {
    case '+':
      if (left.type === 'string' || right.type === 'string') {
        return createString(getString(left) + getString(right))
      }
      return createNumber(getNumber(left) + getNumber(right))

    case '-':
      return createNumber(getNumber(left) - getNumber(right))

    case '*':
      return createNumber(getNumber(left) * getNumber(right))

    case '/':
      return createNumber(getNumber(left) / getNumber(right))

    case '%':
      return createNumber(getNumber(left) % getNumber(right))

    case '<':
      if (left.type === 'string' && right.type === 'string') {
        return createBoolean(left.value < right.value)
      }
      return createBoolean(getNumber(left) < getNumber(right))

    case '<=':
      if (left.type === 'string' && right.type === 'string') {
        return createBoolean(left.value <= right.value)
      }
      return createBoolean(getNumber(left) <= getNumber(right))

    case '>':
      if (left.type === 'string' && right.type === 'string') {
        return createBoolean(left.value > right.value)
      }
      return createBoolean(getNumber(left) > getNumber(right))

    case '>=':
      if (left.type === 'string' && right.type === 'string') {
        return createBoolean(left.value >= right.value)
      }
      return createBoolean(getNumber(left) >= getNumber(right))

    case '===':
      return createBoolean(strictEqual(left, right))

    case '!==':
      return createBoolean(!strictEqual(left, right))

    case '==':
      return createBoolean(looseEqual(left, right))

    case '!=':
      return createBoolean(!looseEqual(left, right))

    default:
      throw new RuntimeError(
        `Unsupported binary operator "${operator}".`,
        'UNSUPPORTED_OPERATOR',
      )
  }
}

export function evaluateExpression(
  expression: Expression,
  environment: Environment,
): RuntimeValue {
  const node = asExpression(expression)

  switch (node.type) {
    case 'Literal': {
      const value = node.value

      if (typeof value === 'number') return createNumber(value)
      if (typeof value === 'string') return createString(value)
      if (typeof value === 'boolean') return createBoolean(value)
      if (value === null) return createNull()

      throw new RuntimeError(
        'This literal type is not supported.',
        'UNSUPPORTED_EXPRESSION',
      )
    }

    case 'Identifier': {
      if (typeof node.name !== 'string') {
        throw new RuntimeError(
          'Invalid identifier.',
          'UNSUPPORTED_EXPRESSION',
        )
      }

      return environment.get(node.name)
    }

    case 'BinaryExpression': {
      const left = evaluateExpression(
        node.left as Expression,
        environment,
      )

      const right = evaluateExpression(
        node.right as Expression,
        environment,
      )

      if (typeof node.operator !== 'string') {
        throw new RuntimeError(
          'Invalid binary operator.',
          'UNSUPPORTED_OPERATOR',
        )
      }

      return evaluateBinaryExpression(
        node.operator,
        left,
        right,
      )
    }

    case 'UnaryExpression': {
      const argument = evaluateExpression(
        node.argument as Expression,
        environment,
      )

      switch (node.operator) {
        case '!':
          return createBoolean(!isTruthy(argument))

        case '+':
          return createNumber(getNumber(argument))

        case '-':
          return createNumber(-getNumber(argument))

        default:
          throw new RuntimeError(
            `Unsupported unary operator "${String(node.operator)}".`,
            'UNSUPPORTED_OPERATOR',
          )
      }
    }


    case 'AssignmentExpression': {
      if (node.operator !== '=') {
        throw new RuntimeError(
          `Unsupported assignment operator "${String(node.operator)}".`,
          'UNSUPPORTED_OPERATOR',
        )
      }

      const left = node.left as AstExpression

      if (left.type !== 'Identifier' || typeof left.name !== 'string') {
        throw new RuntimeError(
          'Assignments must target a variable identifier.',
          'UNSUPPORTED_EXPRESSION',
        )
      }

      const value = evaluateExpression(
        node.right as Expression,
        environment,
      )

      environment.assign(left.name, value)

      return value
    }

    default:
      throw new RuntimeError(
        `Expression "${node.type}" is not supported yet.`,
        'UNSUPPORTED_EXPRESSION',
      )
  }
}

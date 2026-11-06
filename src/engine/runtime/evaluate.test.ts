import { describe, expect, it, vi } from 'vitest'
import { parseJavaScript } from '../parser/parse'
import { Environment, RuntimeError } from './Environment'
import { evaluateExpression } from './evaluate'
import type { RuntimeValue } from './value'
import { parse } from 'acorn'
import type { Expression } from 'acorn'
import { createNumber, createFunction } from './value'


function evaluate(source: string): RuntimeValue {
  const parsed = parseJavaScript(source)

  if (parsed.ok === false) {
    throw new Error('Invalid JavaScript in test.')
  }

  const statement = parsed.ast.body[0]

  if (!statement || statement.type !== 'ExpressionStatement') {
    throw new Error('Expected an expression statement.')
  }

  return evaluateExpression(
    statement.expression,
    new Environment(),
  )
}

function parseExpression(source: string): Expression {
  const program = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'script',
  })

  const statement = program.body[0]

  if (
    statement === undefined ||
    statement.type !== 'ExpressionStatement'
  ) {
    throw new Error('Expected an expression.')
  }

  return statement.expression
}

describe('evaluateExpression', () => {
  it('evaluates number literals', () => {
    expect(evaluate('42')).toEqual({
      type: 'number',
      value: 42,
    })
  })

  it('evaluates string literals', () => {
    expect(evaluate('"TraceFlow"')).toEqual({
      type: 'string',
      value: 'TraceFlow',
    })
  })

  it('evaluates boolean literals', () => {
    expect(evaluate('true')).toEqual({
      type: 'boolean',
      value: true,
    })
  })

  it('evaluates null literals', () => {
    expect(evaluate('null')).toEqual({
      type: 'null',
    })
  })

  it('evaluates addition', () => {
    expect(evaluate('10 + 5')).toEqual({
      type: 'number',
      value: 15,
    })
  })

  it('evaluates string concatenation', () => {
    expect(evaluate('"Hello " + "World"')).toEqual({
      type: 'string',
      value: 'Hello World',
    })
  })

  it('evaluates subtraction', () => {
    expect(evaluate('10 - 5')).toEqual({
      type: 'number',
      value: 5,
    })
  })

  it('evaluates multiplication', () => {
    expect(evaluate('4 * 5')).toEqual({
      type: 'number',
      value: 20,
    })
  })

  it('evaluates division', () => {
    expect(evaluate('10 / 2')).toEqual({
      type: 'number',
      value: 5,
    })
  })

  it('evaluates remainder', () => {
    expect(evaluate('10 % 3')).toEqual({
      type: 'number',
      value: 1,
    })
  })

  it('evaluates comparison operators', () => {
    expect(evaluate('10 > 5')).toEqual({
      type: 'boolean',
      value: true,
    })

    expect(evaluate('10 === 5')).toEqual({
      type: 'boolean',
      value: false,
    })
  })

  it('evaluates unary operators', () => {
    expect(evaluate('!true')).toEqual({
      type: 'boolean',
      value: false,
    })

    expect(evaluate('-10')).toEqual({
      type: 'number',
      value: -10,
    })
  })

  it('evaluates expressions using environment variables', () => {
    const parsed = parseJavaScript('score + 5')

    if (parsed.ok === false) {
      throw new Error('Invalid test expression.')
    }

    const environment = new Environment()
    environment.declare('score', 'let')
    environment.initialize('score', {
      type: 'number',
      value: 10,
    })

    const statement = parsed.ast.body[0]

    if (!statement || statement.type !== 'ExpressionStatement') {
      throw new Error('Expected expression statement.')
    }

    expect(
      evaluateExpression(statement.expression, environment),
    ).toEqual({
      type: 'number',
      value: 15,
    })
  })

  it('uses JavaScript primitive conversion for multiplication', () => {
    expect(evaluate('"10" * 2')).toEqual({
      type: 'number',
      value: 20,
    })
  })

  it('evaluates loose equality for null and undefined', () => {
    const environment = new Environment()
    environment.declare('missing', 'let')
    environment.initialize('missing', {
      type: 'undefined',
    })

    const parsed = parseJavaScript('null == missing')

    if (parsed.ok === false) {
      throw new Error('Invalid test expression.')
    }

    const statement = parsed.ast.body[0]

    if (!statement || statement.type !== 'ExpressionStatement') {
      throw new Error('Expected expression statement.')
    }

    expect(
      evaluateExpression(statement.expression, environment),
    ).toEqual({
      type: 'boolean',
      value: true,
    })
  })

    it('returns false when comparing undefined with a number', () => {
    const environment = new Environment()
    environment.declare('missing', 'let')
    environment.initialize('missing', {
        type: 'undefined',
    })

    const parsed = parseJavaScript('missing > 0')

    if (parsed.ok === false) {
        throw new Error('Invalid test expression.')
    }

    const statement = parsed.ast.body[0]

    if (!statement || statement.type !== 'ExpressionStatement') {
        throw new Error('Expected expression statement.')
    }

    expect(
        evaluateExpression(statement.expression, environment),
    ).toEqual({
        type: 'boolean',
        value: false,
        })
    })

    it('returns false when comparing NaN with a number', () => {
    expect(evaluate('"not a number" * 2 < 10')).toEqual({
        type: 'boolean',
        value: false,
    })
    })

    it('throws for undeclared variables', () => {
        expect(() => evaluate('unknownVariable')).toThrow(RuntimeError)
    })

      it('supports postfix increment', () => {
    const environment = new Environment()
    environment.declare('count', 'let')
    environment.initialize('count', createNumber(5))

    const result = evaluateExpression(
      parseExpression('count++'),
      environment,
    )

    expect(result).toEqual(createNumber(5))
    expect(environment.get('count')).toEqual(createNumber(6))
  })

  it('supports prefix increment', () => {
    const environment = new Environment()
    environment.declare('count', 'let')
    environment.initialize('count', createNumber(5))

    const result = evaluateExpression(
      parseExpression('++count'),
      environment,
    )

    expect(result).toEqual(createNumber(6))
    expect(environment.get('count')).toEqual(createNumber(6))
  })

  it('supports postfix decrement', () => {
    const environment = new Environment()
    environment.declare('count', 'let')
    environment.initialize('count', createNumber(5))

    const result = evaluateExpression(
      parseExpression('count--'),
      environment,
    )

    expect(result).toEqual(createNumber(5))
    expect(environment.get('count')).toEqual(createNumber(4))
  })

  it('supports prefix decrement', () => {
    const environment = new Environment()
    environment.declare('count', 'let')
    environment.initialize('count', createNumber(5))

    const result = evaluateExpression(
      parseExpression('--count'),
      environment,
    )

    expect(result).toEqual(createNumber(4))
    expect(environment.get('count')).toEqual(createNumber(4))
  })

it('counts operations in unary expressions', () => {
  const onOperation = vi.fn()

  evaluateExpression(
    parseExpression('!!true'),
    new Environment(),
    undefined,
    undefined,
    undefined,
    onOperation,
  )

  expect(onOperation).toHaveBeenCalledTimes(3)
})

it('counts operations in nested binary expressions', () => {
  const onOperation = vi.fn()

  evaluateExpression(
    parseExpression('1 + (2 * 3)'),
    new Environment(),
    undefined,
    undefined,
    undefined,
    onOperation,
  )

  expect(onOperation).toHaveBeenCalledTimes(5)
})

it('counts operations in assignment expressions', () => {
  const environment = new Environment()
  environment.declare('value', 'let')
  environment.initialize('value', createNumber(0))

  const onOperation = vi.fn()

  evaluateExpression(
    parseExpression('value = 1 + 2'),
    environment,
    undefined,
    undefined,
    undefined,
    onOperation,
  )

  // Assignment + binary expression + two literals.
  expect(onOperation).toHaveBeenCalledTimes(4)
})

it('counts operations in function calls and arguments', () => {
  const environment = new Environment()
  const declaration = parseJavaScript(
    'function add(a, b) { return a + b; }',
  )

  if (declaration.ok === false) {
    throw new Error('Invalid function declaration in test.')
  }

  const functionDeclaration = declaration.ast.body[0]

  if (
    !functionDeclaration ||
    functionDeclaration.type !== 'FunctionDeclaration'
  ) {
    throw new Error('Expected a function declaration.')
  }

  environment.declare('add', 'let')
  environment.initialize(
    'add',
    createFunction(functionDeclaration, environment),
  )

  const onOperation = vi.fn()

  const result = evaluateExpression(
    parseExpression('add(1 + 2, 3)'),
    environment,
    (fn, args) => {
      expect(fn.type).toBe('function')
      expect(args).toEqual([
        createNumber(3),
        createNumber(3),
      ])
      return createNumber(6)
    },
    undefined,
    undefined,
    onOperation,
  )

  expect(result).toEqual(createNumber(6))
  expect(onOperation).toHaveBeenCalledTimes(6)
})

})
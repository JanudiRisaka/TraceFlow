
import { describe, expect, it } from 'vitest'
import { parseJavaScript } from '../parser/parse'
import { Environment } from './Environment'
import { executeStatement } from './execute'

function executeSource(source: string, environment = new Environment()) {
  const parsed = parseJavaScript(source)

  if (parsed.ok === false) {
    throw new Error(`Invalid test JavaScript: ${parsed.error.message}`)
  }

for (const statement of parsed.ast.body) {
  if (
    statement.type === 'ImportDeclaration' ||
    statement.type === 'ExportNamedDeclaration' ||
    statement.type === 'ExportDefaultDeclaration' ||
    statement.type === 'ExportAllDeclaration'
  ) {
    throw new Error('Module declarations are not supported.')
  }

  executeStatement(statement, environment)
}

  return environment
}

describe('executeStatement', () => {
  it('declares and initializes a let variable', () => {
    const environment = executeSource('let score = 10;')

    expect(environment.get('score')).toEqual({
      type: 'number',
      value: 10,
    })
  })

  it('declares and initializes a const variable', () => {
    const environment = executeSource('const limit = 20;')

    expect(environment.get('limit')).toEqual({
      type: 'number',
      value: 20,
    })
  })

  it('initializes let without a value as undefined', () => {
    const environment = executeSource('let score;')

    expect(environment.get('score')).toEqual({
      type: 'undefined',
    })
  })

  it('supports multiple declarations in one statement', () => {
    const environment = executeSource(
      'let first = 10, second = first + 5;',
    )

    expect(environment.get('first')).toEqual({
      type: 'number',
      value: 10,
    })

    expect(environment.get('second')).toEqual({
      type: 'number',
      value: 15,
    })
  })

  it('supports reassignment of let variables', () => {
    const environment = executeSource(`
      let score = 10;
      score = score + 5;
    `)

    expect(environment.get('score')).toEqual({
      type: 'number',
      value: 15,
    })
  })

  it('rejects reassignment of const variables', () => {
    expect(() => {
      executeSource(`
        const limit = 20;
        limit = 30;
      `)
    }).toThrow('Assignment to constant variable "limit".')
  })

it('rejects duplicate declarations in the same environment', () => {
  const environment = new Environment()

  environment.declare('score', 'let')

  expect(() => {
    environment.declare('score', 'let')
  }).toThrow('Identifier "score" has already been declared.')
})

  it('enforces the temporal dead zone across declarations', () => {
    expect(() => {
      executeSource('let first = second, second = 10;')
    }).toThrow('Cannot access "second" before initialization.')
  })

  it('supports assignment expressions inside initializers', () => {
    const environment = executeSource(`
      let score = 10;
      let result = (score = 20);
    `)

    expect(environment.get('score')).toEqual({
      type: 'number',
      value: 20,
    })

    expect(environment.get('result')).toEqual({
      type: 'number',
      value: 20,
    })
  })

  it('rejects assignment to an undeclared variable', () => {
    expect(() => {
      executeSource('score = 10;')
    }).toThrow('Variable "score" is not defined.')
  })
})

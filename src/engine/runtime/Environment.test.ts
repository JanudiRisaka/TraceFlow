
import { describe, expect, it } from 'vitest'
import {
  Environment,
  RuntimeError,
} from './Environment'
import {
  createNumber,
  createString,
} from './value'

describe('Environment', () => {
  it('declares and reads a let variable', () => {
    const environment = new Environment()

    environment.declare('score', 'let')
    environment.initialize('score', createNumber(10))

    expect(environment.get('score')).toEqual({
      type: 'number',
      value: 10,
    })
  })

  it('allows reassignment of let variables', () => {
    const environment = new Environment()

    environment.declare('score', 'let')
    environment.initialize('score', createNumber(10))
    environment.assign('score', createNumber(15))

    expect(environment.get('score')).toEqual(createNumber(15))
  })

  it('does not allow reassignment of const variables', () => {
    const environment = new Environment()

    environment.declare('limit', 'const')
    environment.initialize('limit', createNumber(20))

    expect(() => {
      environment.assign('limit', createNumber(30))
    }).toThrow(RuntimeError)

    expect(() => {
      environment.assign('limit', createNumber(30))
    }).toThrow('Assignment to constant variable "limit".')
  })

  it('rejects duplicate declarations in the same environment', () => {
    const environment = new Environment()

    environment.declare('score', 'let')

    expect(() => {
      environment.declare('score', 'let')
    }).toThrow('Identifier "score" has already been declared.')
  })

  it('rejects access before initialization', () => {
    const environment = new Environment()

    environment.declare('score', 'let')

    expect(() => {
      environment.get('score')
    }).toThrow('Cannot access "score" before initialization.')
  })

  it('rejects access to undeclared variables', () => {
    const environment = new Environment()

    expect(() => {
      environment.get('missing')
    }).toThrow('Variable "missing" is not defined.')
  })

  it('supports undefined as an initial value', () => {
    const environment = new Environment()

    environment.declare('score', 'let')
    environment.initialize('score', {
      type: 'undefined',
    })

    expect(environment.get('score')).toEqual({
      type: 'undefined',
    })
  })

  it('can read variables from a parent environment', () => {
    const parent = new Environment()
    const child = new Environment(parent)

    parent.declare('score', 'let')
    parent.initialize('score', createNumber(10))

    expect(child.get('score')).toEqual(createNumber(10))
  })

  it('allows a child environment to shadow a parent variable', () => {
    const parent = new Environment()
    const child = new Environment(parent)

    parent.declare('score', 'let')
    parent.initialize('score', createNumber(10))

    child.declare('score', 'let')
    child.initialize('score', createNumber(20))

    expect(child.get('score')).toEqual(createNumber(20))
    expect(parent.get('score')).toEqual(createNumber(10))
  })

  it('updates the nearest existing variable in the scope chain', () => {
    const parent = new Environment()
    const child = new Environment(parent)

    parent.declare('score', 'let')
    parent.initialize('score', createNumber(10))

    child.assign('score', createNumber(15))

    expect(parent.get('score')).toEqual(createNumber(15))
  })

  it('does not allow a child to reassign a parent const', () => {
    const parent = new Environment()
    const child = new Environment(parent)

    parent.declare('name', 'const')
    parent.initialize('name', createString('TraceFlow'))

    expect(() => {
      child.assign('name', createString('Other'))
    }).toThrow('Assignment to constant variable "name".')
  })
})

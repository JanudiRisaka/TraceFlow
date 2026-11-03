import type { FunctionDeclaration } from 'acorn'
import type { Environment } from './Environment'

export type FunctionRuntimeValue = {
  type: 'function'
  declaration: FunctionDeclaration
  closure: Environment
}

export type RuntimeValue =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'undefined' }
  | FunctionRuntimeValue

export function createNumber(value: number): RuntimeValue {
  return { type: 'number', value }
}

export function createString(value: string): RuntimeValue {
  return { type: 'string', value }
}

export function createBoolean(value: boolean): RuntimeValue {
  return { type: 'boolean', value }
}

export function createNull(): RuntimeValue {
  return { type: 'null' }
}

export function createUndefined(): RuntimeValue {
  return { type: 'undefined' }
}

export function createFunction(
  declaration: FunctionDeclaration,
  closure: Environment,
): RuntimeValue {
  return {
    type: 'function',
    declaration,
    closure,
  }
}
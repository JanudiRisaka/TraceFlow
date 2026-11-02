
export type RuntimeValue =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'null' }
  | { type: 'undefined' }

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


import {
  createUndefined,
  type RuntimeValue,
} from './value'

export type DeclarationKind = 'let' | 'const'

type Binding = {
  value: RuntimeValue
  mutable: boolean
  initialized: boolean
}

export type RuntimeErrorCode =
  | 'DUPLICATE_DECLARATION'
  | 'UNDECLARED_VARIABLE'
  | 'TEMPORAL_DEAD_ZONE'
  | 'CONST_ASSIGNMENT'
  | 'ALREADY_INITIALIZED'

export class RuntimeError extends Error {
  public readonly code: RuntimeErrorCode

  constructor(message: string, code: RuntimeErrorCode) {
    super(message)
    this.name = 'RuntimeError'
    this.code = code
  }
}

export class Environment {
  private readonly bindings = new Map<string, Binding>()

  public readonly parent: Environment | null

  constructor(parent: Environment | null = null) {
    this.parent = parent
  }

  // Create a binding before evaluating its initializer.
  // This allows us to model JavaScript's temporal dead zone.
  declare(name: string, kind: DeclarationKind): void {
    if (this.bindings.has(name)) {
      throw new RuntimeError(
        `Identifier "${name}" has already been declared.`,
        'DUPLICATE_DECLARATION',
      )
    }

    this.bindings.set(name, {
      value: createUndefined(),
      mutable: kind === 'let',
      initialized: false,
    })
  }

  // Give a newly declared variable its initial value.
  initialize(name: string, value: RuntimeValue): void {
    const binding = this.bindings.get(name)

    if (!binding) {
      throw new RuntimeError(
        `Cannot initialize undeclared variable "${name}".`,
        'UNDECLARED_VARIABLE',
      )
    }

    if (binding.initialized) {
      throw new RuntimeError(
        `Variable "${name}" has already been initialized.`,
        'ALREADY_INITIALIZED',
      )
    }

    binding.value = value
    binding.initialized = true
  }

  // Read a variable, searching parent environments if necessary.
  get(name: string): RuntimeValue {
    const binding = this.resolveBinding(name)

    if (!binding) {
      throw new RuntimeError(
        `Variable "${name}" is not defined.`,
        'UNDECLARED_VARIABLE',
      )
    }

    if (!binding.initialized) {
      throw new RuntimeError(
        `Cannot access "${name}" before initialization.`,
        'TEMPORAL_DEAD_ZONE',
      )
    }

    return binding.value
  }

  // Update the nearest existing mutable variable.
  assign(name: string, value: RuntimeValue): void {
    const environment = this.resolveEnvironment(name)

    if (!environment) {
      throw new RuntimeError(
        `Variable "${name}" is not defined.`,
        'UNDECLARED_VARIABLE',
      )
    }

    const binding = environment.bindings.get(name)!

    if (!binding.initialized) {
      throw new RuntimeError(
        `Cannot access "${name}" before initialization.`,
        'TEMPORAL_DEAD_ZONE',
      )
    }

    if (!binding.mutable) {
      throw new RuntimeError(
        `Assignment to constant variable "${name}".`,
        'CONST_ASSIGNMENT',
      )
    }

    binding.value = value
  }

  private resolveBinding(name: string): Binding | undefined {
    const ownBinding = this.bindings.get(name)

    if (ownBinding) {
      return ownBinding
    }

    return this.parent?.resolveBinding(name)
  }

  private resolveEnvironment(name: string): Environment | null {
    if (this.bindings.has(name)) {
      return this
    }

    return this.parent?.resolveEnvironment(name) ?? null
  }
}

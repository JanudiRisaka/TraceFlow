
import { describe, expect, it } from 'vitest'
import { parseJavaScript } from '../parser/parse'
import { Environment } from './Environment'
import {
    createExecutionContext,
    executeStatement,
    ReturnSignal,
} from './execute'
import type { Statement } from 'acorn'

function executeSource(source: string, environment = new Environment(), context = createExecutionContext(),) {
  const parsed = parseJavaScript(source)

  if (parsed.ok === false) {
    throw new Error(`Invalid test JavaScript: ${parsed.error.message}`)
  }

  context.maxLoopIterations = 3

  for (const statement of parsed.ast.body) {
    if (
      statement.type === 'ImportDeclaration' ||
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration' ||
      statement.type === 'ExportAllDeclaration'
    ) {
      throw new Error('Module declarations are not supported.')
    }

    executeStatement(statement, environment, context)
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

  it('executes the if branch when the condition is true', () => {
  const environment = executeSource(`
    let result = "";
    if (10 > 5) {
      result = "true branch";
    } else {
      result = "false branch";
    }
  `)

  expect(environment.get('result')).toEqual({
    type: 'string',
    value: 'true branch',
  })
})

it('executes the else branch when the condition is false', () => {
  const environment = executeSource(`
    let result = "";
    if (10 < 5) {
      result = "true branch";
    } else {
      result = "false branch";
    }
  `)

  expect(environment.get('result')).toEqual({
    type: 'string',
    value: 'false branch',
  })
})

it('does not execute either branch when false and there is no else', () => {
  const environment = executeSource(`
    let result = "unchanged";

    if (false) {
      result = "changed";
    }
  `)

  expect(environment.get('result')).toEqual({
    type: 'string',
    value: 'unchanged',
  })
})

it('supports nested if statements', () => {
  const environment = executeSource(`
    let result = "";

    if (true) {
      if (false) {
        result = "wrong";
      } else {
        result = "correct";
      }
    }
  `)

  expect(environment.get('result')).toEqual({
    type: 'string',
    value: 'correct',
  })
})

it('keeps block-scoped variables inside their block', () => {
  const environment = executeSource(`
    if (true) {
      let message = "inside";
    }
  `)

    expect(() => environment.get('message')).toThrow(
    'Variable "message" is not defined.',
    )
})

it('allows a block variable to shadow an outer variable', () => {
  const environment = executeSource(`
    let message = "outside";

    if (true) {
      let message = "inside";
    }
  `)

  expect(environment.get('message')).toEqual({
    type: 'string',
    value: 'outside',
  })
 })

 it('allows a block to modify an outer variable', () => {
  const environment = executeSource(`
    let score = 10;

    if (true) {
      score = 20;
    }
  `)

  expect(environment.get('score')).toEqual({
    type: 'number',
    value: 20,
  })
})

  it('throws when the loop iteration limit is reached', () => {
    const environment = new Environment()
    const parsed = parseJavaScript(`
      for (;;) {
      }
    `)

    if (parsed.ok === false) {
      throw new Error(parsed.error.message)
    }

    const context = createExecutionContext()
context.maxLoopIterations = 3
    expect(() => {
      for (const statement of parsed.ast.body) {
        if (
          statement.type === 'ImportDeclaration' ||
          statement.type === 'ExportNamedDeclaration' ||
          statement.type === 'ExportDefaultDeclaration' ||
          statement.type === 'ExportAllDeclaration'
        ) {
          throw new Error('Module declarations are not supported.')
        }

        executeStatement(statement, environment, context)
      }
    }).toThrow('loop iteration limit of 3 was reached')
  })

  it('shares the iteration limit across nested loops', () => {
  const environment = new Environment()
  const parsed = parseJavaScript(`
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
      }
    }
  `)

  if (parsed.ok === false) {
    throw new Error(parsed.error.message)
  }

    const context = createExecutionContext()
context.maxLoopIterations = 3
  expect(() => {
    for (const statement of parsed.ast.body) {
      if (
        statement.type === 'ImportDeclaration' ||
        statement.type === 'ExportNamedDeclaration' ||
        statement.type === 'ExportDefaultDeclaration' ||
        statement.type === 'ExportAllDeclaration'
      ) {
        throw new Error('Module declarations are not supported.')
      }

      executeStatement(statement, environment, context)
    }
  }).toThrow('loop iteration limit of 3 was reached')
})

  it('keeps the for loop initializer variable inside the loop scope', () => {
  const environment = executeSource(`
    for (let i = 0; i < 3; i++) {
    }
  `)

  expect(() => environment.get('i')).toThrow(
    'Variable "i" is not defined.',
  )
})

it('registers a function declaration in the environment', () => {
  const environment = new Environment()
  const result = parseJavaScript(`
    function greet() {
      return "Hello"
    }
  `)

  if (result.ok === false) {
    throw new Error(result.error.message)
  }

  executeStatement(result.ast.body[0] as Statement, environment)

  const functionValue = environment.get('greet')

  expect(functionValue.type).toBe('function')
})

it('stores the original declaration in the function value', () => {
  const environment = new Environment()
  const result = parseJavaScript(`
    function greet() {
      return "Hello"
    }
  `)

  if (result.ok === false) {
    throw new Error(result.error.message)
  }

  executeStatement(result.ast.body[0] as Statement, environment)

  const functionValue = environment.get('greet')

  expect(functionValue.type).toBe('function')

  if (functionValue.type === 'function') {
    expect(functionValue.declaration.id?.name).toBe('greet')
  }
})

it('throws a return signal containing the returned value', () => {
  const environment = new Environment()
  const parsed = parseJavaScript(`
    function test() {
      return 42;
    }
  `)

  if (parsed.ok === false) {
    throw new Error(parsed.error.message)
  }

  const functionDeclaration = parsed.ast.body[0]

  if (functionDeclaration.type !== 'FunctionDeclaration') {
    throw new Error('Expected a function declaration.')
  }

  const returnStatement = functionDeclaration.body.body[0]

  try {
    executeStatement(returnStatement, environment)
    throw new Error('Expected a ReturnSignal.')
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ReturnSignal)

    if (error instanceof ReturnSignal) {
      expect(error.value).toEqual({
        type: 'number',
        value: 42,
      })
    }
  }
})

it('returns undefined when no return expression is provided', () => {
  const environment = new Environment()
  const parsed = parseJavaScript(`
    function test() {
      return;
    }
  `)

  if (parsed.ok === false) {
    throw new Error(parsed.error.message)
  }

  const functionDeclaration = parsed.ast.body[0]

  if (functionDeclaration.type !== 'FunctionDeclaration') {
    throw new Error('Expected a function declaration.')
  }

  const returnStatement = functionDeclaration.body.body[0]

  try {
    executeStatement(returnStatement, environment)
    throw new Error('Expected a ReturnSignal.')
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(ReturnSignal)

    if (error instanceof ReturnSignal) {
      expect(error.value).toEqual({ type: 'undefined' })
    }
  }
})

  it('calls a function with two arguments and returns the result', () => {
    const environment = executeSource(`
      function add(a, b) {
        return a + b;
      }

      let result = add(2, 3);
    `)

    expect(environment.get('result')).toEqual({
      type: 'number',
      value: 5,
    })
  })

  it('returns undefined when a function has no return statement', () => {
    const environment = executeSource(`
      function greet() {
        let message = "Hello";
      }

      let result = greet();
    `)

    expect(environment.get('result')).toEqual({
      type: 'undefined',
    })
  })

  it('returns undefined for a missing function argument', () => {
    const environment = executeSource(`
      function getValue(value) {
        return value;
      }

      let result = getValue();
    `)

    expect(environment.get('result')).toEqual({
      type: 'undefined',
    })
  })

  it('supports calling one function from another', () => {
    const environment = executeSource(`
      function double(value) {
        return value * 2;
      }

      function calculate(value) {
        return double(value) + 1;
      }

      let result = calculate(5);
    `)

    expect(environment.get('result')).toEqual({
      type: 'number',
      value: 11,
    })
  })

  it('supports recursive function calls', () => {
    const environment = executeSource(`
      function factorial(n) {
        if (n <= 1) {
          return 1;
        }

        return n * factorial(n - 1);
      }

      let result = factorial(5);
    `)

    expect(environment.get('result')).toEqual({
      type: 'number',
      value: 120,
    })
  })

  it('rejects attempts to call a non-function value', () => {
    expect(() => {
      executeSource(`
        let value = 10;
        value();
      `)
    }).toThrow('Only user-defined functions can be called.')
  })

  it('enforces the function call depth limit', () => {
    const context = createExecutionContext()
    context.maxFunctionCallDepth = 3

    expect(() => {
      executeSource(
        `
          function recurse() {
            return recurse();
          }

          recurse();
        `,
        new Environment(),
        context,
      )
    }).toThrow('function call depth limit of 3 was reached')
  })

})


import { describe, expect, it } from 'vitest'
import { parseJavaScript } from '../parser/parse'
import { Environment } from './Environment'
import {
    createExecutionContext,
    executeStatement,
    ReturnSignal,
} from './execute'
import type { Statement } from 'acorn'
import type { ExecutionEvent } from '../trace/types'

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


function executeSourceWithContext(
  source: string,
  environment = new Environment(),
  context = createExecutionContext(),
) {
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

  return { environment, context }
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


it('throws when the operation limit is exceeded', () => {
  const context = createExecutionContext()
  context.maxOperations = 3

  expect(() => {
    executeSource(
      'let value = 1 + 2;',
      new Environment(),
      context,
    )
  }).toThrow('operation limit of 3 was reached')

  expect(context.operationCount).toBe(4)
})

it('counts operations across loop iterations', () => {
  const context = createExecutionContext()
  context.maxOperations = 6

  expect(() => {
    executeSource(
      'let i = 0; for (i = 0; i < 5; i++) { let value = i; }',
      new Environment(),
      context,
    )
  }).toThrow('operation limit of 6 was reached')

  expect(context.operationCount).toBe(7)
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

it('counts operations inside function calls', () => {
  const context = createExecutionContext()
  context.maxOperations = 6

  expect(() => {
    executeSource(
      'function add(a, b) { return a + b; } let result = add(1, 2);',
      new Environment(),
      context,
    )
  }).toThrow('operation limit of 6 was reached')

  expect(context.operationCount).toBe(7)
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

  it('records variable declaration and initialization events', () => {
  const context = createExecutionContext()

  executeSource('let score = 10;', new Environment(), context)

  const events = context.eventRecorder.getEvents()

  expect(events.map((event) => event.type)).toEqual([
    'variable-declared',
    'variable-initialized',
  ])

  expect(events[0]).toMatchObject({
    type: 'variable-declared',
    name: 'score',
    kind: 'let',
  })

  expect(events[1]).toMatchObject({
    type: 'variable-initialized',
    name: 'score',
    value: {
      type: 'number',
      value: 10,
    },
  })

  expect(context.snapshotRecorder.getSnapshots()).toHaveLength(2)
})

it('records variable assignments with previous and new values', () => {
  const context = createExecutionContext()

  executeSource(`
    let score = 10;
    score = 20;
  `, new Environment(), context)

  const assignmentEvents = context.eventRecorder
    .getEvents()
    .filter((event) => event.type === 'variable-assigned')

  expect(assignmentEvents).toHaveLength(1)

  expect(assignmentEvents[0]).toMatchObject({
    type: 'variable-assigned',
    name: 'score',
    previousValue: {
      type: 'number',
      value: 10,
    },
    newValue: {
      type: 'number',
      value: 20,
    },
  })
})

it('records increment and decrement operations', () => {
  const context = createExecutionContext()

  executeSource(`
    let count = 5;
    count++;
    count--;
  `, new Environment(), context)

  const assignmentEvents = context.eventRecorder
    .getEvents()
    .filter((event) => event.type === 'variable-assigned')

  expect(assignmentEvents).toHaveLength(2)

  expect(assignmentEvents[0]).toMatchObject({
    type: 'variable-assigned',
    name: 'count',
    previousValue: { type: 'number', value: 5 },
    newValue: { type: 'number', value: 6 },
  })

  expect(assignmentEvents[1]).toMatchObject({
    type: 'variable-assigned',
    name: 'count',
    previousValue: { type: 'number', value: 6 },
    newValue: { type: 'number', value: 5 },
  })
})

it('captures a snapshot after every recorded event', () => {
  const context = createExecutionContext()

  executeSource(`
    let score = 10;
    score = 20;
  `, new Environment(), context)

  const events = context.eventRecorder.getEvents()
  const snapshots = context.snapshotRecorder.getSnapshots()

  expect(snapshots).toHaveLength(events.length)

  expect(snapshots.map((snapshot) => snapshot.eventIndex)).toEqual(
    events.map((event) => event.index),
  )

  expect(snapshots[0].scopes[0].bindings).toContainEqual({
    name: 'score',
    kind: 'let',
    initialized: false,
    value: null,
  })

  expect(snapshots[1].scopes[0].bindings).toContainEqual({
    name: 'score',
    kind: 'let',
    initialized: true,
    value: { type: 'number', value: 10 },
  })

  expect(snapshots[2].scopes[0].bindings).toContainEqual({
    name: 'score',
    kind: 'let',
    initialized: true,
    value: { type: 'number', value: 20 },
  })
})

it('does not record an assignment event when const reassignment fails', () => {
  const context = createExecutionContext()

  expect(() => {
    executeSource(`
      const limit = 20;
      limit = 30;
    `, new Environment(), context)
  }).toThrow('Assignment to constant variable "limit".')

  const assignmentEvents = context.eventRecorder
    .getEvents()
    .filter((event) => event.type === 'variable-assigned')

  expect(assignmentEvents).toHaveLength(0)
})

it('records which branch of an if statement was taken', () => {
  const context = createExecutionContext()

  executeSource(`
    let score = 10;

    if (score > 5) {
      score = 20;
    } else {
      score = 0;
    }
  `, new Environment(), context)

  const branchEvents = context.eventRecorder
    .getEvents()
    .filter((event) => event.type === 'branch-taken')

  expect(branchEvents).toHaveLength(1)

  expect(branchEvents[0]).toMatchObject({
    type: 'branch-taken',
    branch: 'consequent',
  })
})

it('records the alternate branch when the if condition is false', () => {
  const context = createExecutionContext()

  executeSource(`
    let score = 2;

    if (score > 5) {
      score = 20;
    } else {
      score = 0;
    }
  `, new Environment(), context)

  const branchEvents = context.eventRecorder
    .getEvents()
    .filter((event) => event.type === 'branch-taken')

  expect(branchEvents).toHaveLength(1)

  expect(branchEvents[0]).toMatchObject({
    type: 'branch-taken',
    branch: 'alternate',
  })
})

it('records each for loop iteration', () => {
  const context = createExecutionContext()

  executeSource(`
    for (let i = 0; i < 3; i++) {
      // Loop body
    }
  `, new Environment(), context)

  const loopEvents = context.eventRecorder
    .getEvents()
    .filter((event) => event.type === 'loop-iteration')

  expect(loopEvents).toHaveLength(3)

  expect(loopEvents.map((event) => {
    if (event.type === 'loop-iteration') {
      return event.iteration
    }

    return null
  })).toEqual([1, 2, 3])
})

})


describe('function execution tracing', () => {
  it('records function call and return events', () => {
    const { context } = executeSourceWithContext(`
      function add(a, b) {
        return a + b;
      }

      let result = add(2, 3);
    `)

    const events = context.eventRecorder.getEvents()

    const functionEvents = events.filter(
      (event: ExecutionEvent) =>
        event.type === 'function-call' ||
        event.type === 'function-return',
    )

    expect(functionEvents).toHaveLength(2)

    expect(functionEvents[0]).toMatchObject({
      type: 'function-call',
      functionName: 'add',
      frameId: 1,
    })

    expect(functionEvents[1]).toMatchObject({
      type: 'function-return',
      functionName: 'add',
      frameId: 1,
      value: { type: 'number', value: 5 },
    })
  })

  it('captures the active call stack in function snapshots', () => {
    const { context } = executeSourceWithContext(`
      function greet() {
        return 42;
      }

      greet();
    `)

    const events = context.eventRecorder.getEvents()
    const snapshots = context.snapshotRecorder.getSnapshots()

    const callEvent = events.find(
      (event) => event.type === 'function-call',
    )

    expect(callEvent).toBeDefined()

    if (callEvent === undefined) {
      throw new Error('Expected a function-call event.')
    }

    const callSnapshot = snapshots[callEvent.index]

    expect(callSnapshot.callStack).toHaveLength(1)
    expect(callSnapshot.callStack[0].functionName).toBe('greet')
  })

  it('records implicit undefined returns', () => {
    const { context } = executeSourceWithContext(`
      function greet() {
        let message = 1;
      }

      greet();
    `)

    const returnEvent = context.eventRecorder
      .getEvents()
      .find((event) => event.type === 'function-return')

    expect(returnEvent).toMatchObject({
      type: 'function-return',
      functionName: 'greet',
      value: { type: 'undefined' },
    })
  })


it('records nested function calls with the correct call stack', () => {
  const { context } = executeSourceWithContext(`
    function inner() {
      return 10;
    }

    function outer() {
      return inner();
    }

    let result = outer();
  `)

  const events = context.eventRecorder.getEvents()
  const snapshots = context.snapshotRecorder.getSnapshots()

  const callEvents = events.filter(
    (event: ExecutionEvent) => event.type === 'function-call',
  )

  expect(callEvents).toHaveLength(2)

  const outerCall = callEvents[0]
  const innerCall = callEvents[1]

  expect(outerCall.type).toBe('function-call')
  expect(innerCall.type).toBe('function-call')

  if (
    outerCall.type !== 'function-call' ||
    innerCall.type !== 'function-call'
  ) {
    throw new Error('Expected function-call events.')
  }

  expect(outerCall.functionName).toBe('outer')
  expect(innerCall.functionName).toBe('inner')

  const innerSnapshot = snapshots[innerCall.index]

  expect(innerSnapshot.callStack).toHaveLength(2)
  expect(innerSnapshot.callStack[0].functionName).toBe('outer')
  expect(innerSnapshot.callStack[1].functionName).toBe('inner')
})


it('cleans up the call stack when a function throws an error', () => {
  const environment = new Environment()
  const context = createExecutionContext()

  expect(() => {
    executeSourceWithContext(`
      function fail() {
        missingVariable;
      }

      fail();
    `, environment, context)
  }).toThrow('Variable "missingVariable" is not defined.')

  expect(context.callStack).toHaveLength(0)
  expect(context.functionCallDepth).toBe(0)
})


})

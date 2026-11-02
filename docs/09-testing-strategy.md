# 9. Testing Strategy

## Goals
Verify interpreter correctness, trace consistency, navigation behavior, error handling, and security limits.

## Test layers

### Unit tests
- Parser integration and supported-syntax validation.
- Value operations and type behavior.
- Environment lookup and assignment.
- Scope creation and destruction.
- Function parameter binding and return behavior.
- Event sequence ordering.
- Snapshot immutability and serialization.
- Step-budget accounting.

### Interpreter tests
For each supported syntax construct, include:
- A minimal valid example.
- A nested or boundary example.
- An invalid/unsupported example.
- Expected final result.
- Expected important events and snapshots.

### UI tests
- Editor input and Run action.
- Loading, empty, completed, and error states.
- Previous/next navigation bounds.
- Variable inspector updates when selected step changes.
- Call stack updates across function call/return.
- Source highlighting from locations.

### Integration tests
Run source through parser, validator, interpreter, recorder, and trace UI model. Assert that displayed state is derived from the selected recorded snapshot.

### Security tests
- Infinite loop reaches step limit.
- Large input is rejected or limited.
- Unsupported syntax is rejected before execution.
- Guest code cannot access host globals or browser APIs.
- No unsafe HTML rendering path for source or output.

## Golden test cases
Maintain small example programs with expected traces:
1. Variable declaration and assignment.
2. Arithmetic expression.
3. If/else true branch.
4. If/else false branch.
5. Loop with a small fixed number of iterations.
6. Function call with parameters and return.
7. Nested function calls.
8. Runtime error after at least one successful step.
9. Unsupported syntax.
10. Step-limit exceeded.

## Quality gate
A feature is not complete merely because it works manually. It must have automated tests for its supported behavior and documented limitations.

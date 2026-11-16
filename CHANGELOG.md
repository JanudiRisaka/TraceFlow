
# Changelog

All notable project changes will be documented in this file.

The project has not released a version yet.

## [Unreleased]

### Added

- Browser-based JavaScript execution visualizer.
- Controlled AST-based interpreter for a documented subset of JavaScript.
- AST parsing and validation with an explicit supported-syntax allowlist.
- Execution event recording and state snapshots.
- Runtime environments, variable bindings and function call handling.
- Web Worker-based program execution.
- Execution cancellation and timeout handling.
- Configurable resource limits for source size, AST complexity, interpreter operations, loops, function calls and execution history.
- Cumulative snapshot binding-entry limits.
- Runtime validation of messages received from the execution Worker.
- Documentation covering product requirements, architecture, technical design, execution events, security and testing.

### Supported JavaScript subset

TraceFlow interprets a restricted subset of JavaScript using a controlled AST-based interpreter.

Supported syntax includes:
- `let` and `const` declarations.
- Identifiers and literals.
- Binary, unary and update expressions.
- Simple assignment using `=`.
- Function declarations and return statements.
- `if` statements and `for` loops.
- Block and empty statements.
- Direct `console.log(...)` calls.
- Calls to functions defined within the interpreted program.

Supported operators include arithmetic, comparison, equality, unary `+`, `-`, `!`, increment, decrement and simple assignment.

Unsupported syntax and operators are rejected during AST validation. `var`, async functions, generator functions and general member access are not supported.

### Security limitations

TraceFlow is an educational JavaScript execution visualizer, not a general-purpose secure sandbox.

- User programs execute through TraceFlow's controlled interpreter rather than unrestricted native JavaScript execution.
- Web Workers help keep the main thread responsive but are not a complete security boundary.
- Resource limits reduce excessive execution and trace growth but do not constitute a strict total memory limit.
- Browser vulnerabilities, implementation defects and untested malicious inputs remain potential risks.
- TraceFlow is not intended to execute arbitrary untrusted JavaScript and must not be treated as a general-purpose secure sandbox.

### Configured resource limits

| Resource | Maximum |
|---|---:|
| Source size | 100 KiB (102,400 UTF-8 bytes) |
| AST nodes | 20,000 |
| AST depth | 100 |
| Interpreter operations | 50,000 |
| Loop iterations | 10,000 cumulative per execution |
| Function call depth | 100 |
| Execution timeout | 3,000 ms |
| Execution events | 5,000 |
| Snapshots | 5,000 |
| Cumulative snapshot binding entries | 100,000 |
| Console entries | 500 |
| String length | 10,000 UTF-16 code units |

### Security

- Reject unsupported syntax through fail-closed AST validation.
- Avoid unrestricted `eval()` and `new Function()` execution for user-provided programs.
- Enforce source-size and execution resource limits.
- Terminate Workers when execution exceeds the configured timeout.
- Reject malformed or oversized Worker responses.
- Prevent unexpected internal exception details from being exposed to users.
- Handle parser stack exhaustion consistently.
- Document security limitations and the distinction between Worker isolation and a complete security sandbox.

### Testing

- Unit tests for parsing, syntax validation, runtime execution and resource limits.
- Tests for source-size and AST-complexity boundaries.
- Tests for execution snapshot and cumulative binding-entry limits.
- Tests for malformed Worker responses and timeout handling.
- 8 Playwright end-to-end Worker scenarios run in Chromium, Firefox and WebKit (24 browser-specific executions), covering execution, parser nesting errors, runtime errors, cancellation, responsiveness, malformed requests and timeout behavior.


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
- Playwright end-to-end tests for Worker execution, errors, cancellation and timeout behavior.

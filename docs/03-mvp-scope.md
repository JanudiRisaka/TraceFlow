# 3. MVP Scope

## Goal
Deliver a small but reliable JavaScript execution visualizer. The MVP proves the full path from source input to AST interpretation, event recording, snapshots, and UI inspection.

## In scope

### Editor and run flow
- Single source editor.
- Run action.
- Clear trace / reset action.
- Example snippets for supported constructs.

### Language support proposal
The following is a proposed initial subset, subject to implementation and test confirmation:

| Construct | V1 target |
|---|---|
| Numeric, string, boolean, null literals | Yes |
| `let` and `const` declarations | Yes |
| Identifier reads and assignments | Yes |
| Basic arithmetic and comparison operators | Yes |
| Boolean logical operators | Limited, explicitly tested |
| `if` / `else` | Yes |
| `while` or `for` loop | Choose one initially, then expand |
| Function declarations and calls | Yes, basic synchronous functions |
| `return` | Yes |
| Arrays | Optional; include only if snapshot semantics are defined |
| Objects | Defer unless explicitly specified and tested |
| Arrow functions | Defer |
| Closures | Defer |
| Classes / `this` | Defer |
| Promises / async / await | Defer |
| Modules / imports | Defer |
| DOM / browser APIs | No |
| Network, filesystem, storage APIs | No |
| `eval`, `Function`, dynamic code generation | No |

The implementation must publish the actual supported subset. Do not claim a feature is supported until tests demonstrate its semantics.

### Visualization
- Execution step list/timeline.
- Current source line/range highlight.
- Variable inspector for active scopes.
- Call stack panel.
- Basic output panel for explicitly supported `console.log`-like output, if implemented as a safe interpreter intrinsic.

### Errors
- Parser errors.
- Unsupported syntax errors.
- Interpreter runtime errors.
- Step-limit exceeded error.

## Out of scope for V1
- Complete ECMAScript compliance.
- Arbitrary JavaScript execution.
- Debugging a user's local project or attaching to a browser process.
- Breakpoints, watch expressions, conditional breakpoints.
- Reverse execution by re-running code; navigation should use recorded snapshots.
- Persistent accounts, cloud trace storage, collaboration.
- Multi-language support.
- Plugin system and IDE extensions.

## Definition of MVP complete
All V1 requirements in the PRD pass their acceptance criteria, the supported syntax matrix is accurate, and the security design is implemented and reviewed.

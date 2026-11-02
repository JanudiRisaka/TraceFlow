# 2. Product Requirements Document (PRD)

## 2.1 Product objective
Enable a user to understand how a supported JavaScript program executes by inspecting a navigable, visual record of its execution.

## 2.2 Primary user stories
- As a user, I want to enter JavaScript so I can inspect a program.
- As a user, I want to run the program so I can generate an execution trace.
- As a user, I want to move one step forward or backward so I can understand execution order.
- As a user, I want to see variable values at the selected step so I can understand state changes.
- As a user, I want to inspect function calls and returns so I can understand call flow.
- As a user, I want errors to identify the relevant source location so I can diagnose problems.
- As a user, I want unsupported syntax to be explained rather than silently misinterpreted.

## 2.3 Functional requirements

### FR-01: Code input
The application must provide an editor for entering and editing JavaScript source.

### FR-02: Parsing and validation
The engine must parse source code and validate it against the documented V1 syntax subset before execution.

### FR-03: Execution
The engine must interpret supported syntax using controlled runtime semantics. It must not rely on unrestricted `eval()` or `new Function()` to execute user programs.

### FR-04: Event recording
The engine must record ordered execution events. Events should include a sequence number, event kind, source location when available, and relevant identifiers/data.

### FR-05: State snapshots
The engine must produce inspectable state snapshots at defined execution boundaries. The UI must be able to display the state for any recorded step without re-executing the program.

### FR-06: Navigation
The user must be able to move to the first, previous, next, and last recorded step. The selected step must remain within valid bounds.

### FR-07: Variable inspection
The UI must show variables visible in the selected execution context, their values, and relevant scope information.

### FR-08: Call stack
The UI must show active function frames at the selected step and preserve call/return events in the trace.

### FR-09: Source highlighting
When an event has a source location, the editor should highlight the corresponding source range.

### FR-10: Error presentation
Parse errors and interpreter runtime errors must be displayed with an understandable message and source location when available.

### FR-11: Execution limits
The engine must enforce documented limits such as maximum executed steps and supported value sizes to prevent runaway programs and excessive memory use.

## 2.4 Non-functional requirements
- **Correctness:** displayed state must agree with interpreter state at the recorded step.
- **Safety:** user programs must not access arbitrary browser APIs, network, storage, or host capabilities.
- **Responsiveness:** navigation through an already-created trace should not require re-execution.
- **Maintainability:** parser, interpreter, recorder, and UI should have clear boundaries.
- **Accessibility:** controls must be keyboard accessible and have meaningful labels.
- **Transparency:** unsupported syntax and limits must be documented.

## 2.5 V1 acceptance criteria
V1 is acceptable when:
1. The supported syntax matrix is implemented and tested.
2. A user can execute representative programs containing declarations, assignments, arithmetic, conditionals, loops, arrays (if included), and functions (within the defined subset).
3. A trace is generated with ordered events and state snapshots.
4. Previous/next navigation displays the correct snapshot.
5. Variables and call frames are inspectable.
6. Parse errors, unsupported syntax, and runtime errors are distinguished.
7. Step/time/resource limits are enforced.
8. The security review checklist has no unresolved critical issue.

## 2.6 Out of scope
See [MVP Scope](03-mvp-scope.md). Product requirements do not imply support for syntax absent from the explicit support matrix.

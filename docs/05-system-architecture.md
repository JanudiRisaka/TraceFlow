# 5. System Architecture

## Architectural approach
Use a layered browser application with a controlled AST interpreter. The interpreter, rather than the browser's native JavaScript evaluator, defines the supported program semantics.

## High-level flow

```text
Source Editor
    |
    v
Parser (Acorn or equivalent)
    |
    v
Supported-Syntax Validator
    |
    v
AST Interpreter <---- Runtime Environment / Call Frames
    |
    +----> Execution Event Recorder
    |             |
    |             v
    |        Trace Model / Snapshots
    |             |
    v             v
Execution Limits  Trace State
                  |
                  v
        Timeline + Variable Inspector
        + Call Stack + Source Highlighting
```

## Main modules

### 1. Editor and application shell
Owns source text, run/reset actions, editor selection, and layout. It must not implement language semantics.

### 2. Parser
Converts source text into an AST and reports syntax errors. Parser choice and version should be pinned.

### 3. Supported-syntax validator
Walks the AST and rejects unsupported constructs before interpretation. It prevents accidental partial support.

### 4. Interpreter
Evaluates only explicitly supported AST node types. It owns environments, variable bindings, expression evaluation, control flow, function calls, and return behavior.

### 5. Runtime model
Represents values, lexical environments, scope chains, and call frames. Avoid using host-language object references as an implicit substitute for guest-language semantics.

### 6. Recorder
Receives structured events from the interpreter and creates snapshots at documented boundaries. It should be deterministic for the same source and runtime configuration.

### 7. Trace state
Stores the immutable trace and selected step. Previous/next navigation selects snapshots; it does not replay user code.

### 8. Visualization
Renders the selected event, source highlight, variable state, and call stack.

## Execution isolation
The interpreter should run away from the main UI thread where practical, such as in a Web Worker, to keep the interface responsive. A worker is a responsiveness boundary, not by itself a complete security sandbox. The interpreter must expose no unrestricted host APIs, and it must enforce step and resource limits.

## Data flow
1. Source text is parsed.
2. AST is validated against the supported subset.
3. Interpreter executes AST nodes.
4. Interpreter emits events and state changes.
5. Recorder stores trace data.
6. UI reads selected snapshot and event.
7. Navigation changes the selected index only.

## Architectural constraints
- UI components cannot mutate recorded snapshots.
- Interpreter cannot depend on React or UI libraries.
- Recorder cannot infer semantics by inspecting UI state.
- All displayed runtime values must come from the trace model.
- Unsupported AST nodes fail closed.

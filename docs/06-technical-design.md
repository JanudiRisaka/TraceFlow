# 6. Technical Design

## Proposed stack
- React + TypeScript: application UI.
- Vite: development/build tooling.
- Tailwind CSS: styling, if desired.
- Monaco Editor: source editing.
- Acorn: JavaScript parsing.
- Zustand or React state: UI/trace selection state; keep engine state independent.
- Vitest: unit and integration tests.
- React Flow: optional later visualization for graph-style data flow; not required for the first timeline.

Versions should be selected and pinned during repository setup.

## Key engineering choice: interpreter vs. instrumentation
For V1, prefer a small AST interpreter over transforming arbitrary source and executing it with `eval()` or `new Function()`.

Reasons:
- Interpreter events occur at known semantic boundaries.
- Variable environments and call frames are explicitly represented.
- Snapshots can be created from controlled runtime state.
- Unsupported syntax can be rejected before execution.
- User code does not execute as unrestricted native JavaScript.

Trade-offs:
- The supported language subset is limited.
- JavaScript semantics must be implemented carefully.
- The interpreter itself requires extensive tests.
- It is not a substitute for a standards-compliant JavaScript engine.

## Interpreter design
Suggested interfaces (illustrative; refine during implementation):

```ts
type SourceLocation = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
};

type TraceEvent = {
  sequence: number;
  kind: string;
  location?: SourceLocation;
  frameId?: string;
  description?: string;
};

type TraceSnapshot = {
  sequence: number;
  variables: VariableSnapshot[];
  callStack: CallFrameSnapshot[];
  output: OutputEntry[];
};
```

The actual schema is defined in `07-execution-event-spec.md`.

## Runtime concepts
- **Value:** a tagged representation of supported guest-language values.
- **Environment:** a lexical scope containing bindings.
- **Binding:** a variable's name, value, mutability, and initialization status.
- **Call frame:** function identity, parameters, local environment, and call location.
- **Control result:** normal completion, return, break/continue if supported, or runtime error.

Do not use JavaScript `undefined` as an ambiguous marker for both uninitialized and absent bindings. Represent initialization explicitly.

## Execution algorithm
1. Parse source.
2. Validate every AST node against the allowlist.
3. Initialize global environment and recorder.
4. Interpret statements and expressions recursively.
5. Emit events at defined boundaries.
6. Enforce step and resource budgets.
7. Capture snapshots according to the event/snapshot policy.
8. Return completed, errored, or limit-exceeded trace.

## State snapshots
Prefer immutable, serializable snapshots. Copy only supported guest values into trace records; do not retain mutable references to live interpreter environments. If snapshotting every operation is too expensive, document snapshot boundaries and ensure timeline semantics remain understandable.

## Error model
Distinguish:
- Source syntax error.
- Unsupported syntax.
- Guest runtime error (e.g. reading an unbound identifier).
- Execution limit exceeded.
- Internal TraceFlow error.

Internal errors should not expose implementation secrets or raw host stack traces to the user.

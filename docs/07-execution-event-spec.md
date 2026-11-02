# 7. Execution Event Specification

## Purpose
Define a stable, UI-independent representation of execution history. The interpreter emits events; the recorder turns those events into a trace that the UI can inspect.

## Design requirements
- Events are ordered.
- Every event has a monotonically increasing sequence number.
- Source locations are included when the originating AST node has a location.
- Events use serializable data only.
- Guest values are represented using tagged values.
- Trace snapshots are immutable after creation.
- Schema changes should be versioned.

## Proposed trace envelope

```ts
type Trace = {
  schemaVersion: 1;
  sourceHash: string;
  status: "completed" | "runtime-error" | "limit-exceeded";
  events: TraceEvent[];
  snapshots: TraceSnapshot[];
  error?: TraceError;
};
```

## Proposed event kinds
- `program-start`
- `statement-start`
- `variable-declared`
- `variable-assigned`
- `expression-evaluated` (only where useful; avoid excessive noisy events)
- `branch-selected`
- `loop-iteration`
- `function-call`
- `function-return`
- `output`
- `runtime-error`
- `program-end`
- `execution-limit`

## Proposed value representation

```ts
type TraceValue =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "null"; value: null }
  | { type: "undefined" }
  | { type: "array"; id: string; items: TraceValue[] };
```

Extend only when the interpreter supports the corresponding value semantics. If objects are added later, define identity, property ordering, mutation, and snapshot behavior explicitly.

## Event structure

```ts
type TraceEvent = {
  sequence: number;
  kind: string;
  location?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  frameId?: string;
  variableName?: string;
  value?: TraceValue;
  description?: string;
};
```

This is a starting schema, not a final public API. Prefer discriminated unions in implementation so each event kind has required fields.

## Snapshot structure

```ts
type TraceSnapshot = {
  sequence: number;
  activeFrameId?: string;
  callStack: CallFrameSnapshot[];
  scopes: ScopeSnapshot[];
  output: OutputEntry[];
};
```

Each snapshot must represent the state after a clearly defined event boundary. The recorder must document whether a snapshot is taken before or after the event. Use one consistent convention.

## Navigation semantics
The UI selects a snapshot index. Previous and next operations change that index within bounds. They must not re-run the source. If some events do not have snapshots, define a deterministic mapping from event to nearest applicable snapshot.

## Open questions to resolve during implementation
- Snapshot after every statement or every meaningful event?
- How are arrays copied and identified across snapshots?
- How is output represented and selected in history?
- What trace-size limit should V1 enforce?

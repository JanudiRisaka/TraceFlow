# 11. Architecture Decisions

Record significant decisions here. For larger projects, move each decision into a separate Architecture Decision Record (ADR).

## ADR-001: Use a controlled AST interpreter for V1

**Status:** Proposed

**Context:** TraceFlow needs to observe execution and variable state. Executing arbitrary instrumented source through native `eval()` or `new Function()` makes isolation and state capture difficult to reason about.

**Decision:** V1 will parse source into an AST, validate it against a supported subset, and interpret allowed nodes using a TraceFlow-owned runtime.

**Consequences:**
- Execution events and state changes are explicit.
- Guest code does not receive ambient browser capabilities.
- Language support is limited and must be documented.
- Interpreter semantics require careful tests.
- This is not full JavaScript compatibility.

## ADR-002: Store trace snapshots for navigation

**Status:** Proposed

**Context:** Users need to move backward and forward through execution.

**Decision:** The recorder will store immutable snapshots at documented event boundaries. UI navigation selects a recorded snapshot rather than re-executing source.

**Consequences:**
- Reverse navigation is predictable.
- Memory usage grows with trace size.
- Snapshot frequency and limits must be designed and tested.

## ADR-003: Keep engine independent from UI

**Status:** Proposed

**Context:** Interpreter correctness should be testable without rendering React components.

**Decision:** Parser, validator, interpreter, runtime, and recorder will be independent of React and UI state.

**Consequences:**
- Engine can be tested in isolation.
- UI consumes a stable trace model.
- Shared types must be carefully versioned.

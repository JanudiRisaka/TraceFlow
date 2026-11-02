# 10. Product Roadmap

Roadmap order is provisional and may change based on implementation findings.

## Phase 0 — Product and technical foundation
- Finalize scope and supported syntax.
- Create repository and documentation.
- Set up TypeScript, React, Vite, linting, formatting, and tests.
- Record architecture decisions.

## Phase 1 — Minimal execution engine
- Parse source.
- Validate supported AST nodes.
- Implement tagged values and environments.
- Interpret declarations, expressions, assignments, and basic control flow.
- Add step limits and engine tests.

## Phase 2 — Trace recording
- Define event schema.
- Record variable changes and source locations.
- Capture snapshots.
- Verify deterministic trace behavior.

## Phase 3 — Core interface
- Editor and run/reset actions.
- Timeline and step navigation.
- Variable inspector.
- Source highlighting.
- Basic error panel.

## Phase 4 — Function tracing
- Function declarations and calls.
- Parameters and return values.
- Call frames and call stack visualization.
- Nested-call tests.

## Phase 5 — Hardening and release
- Security review.
- Accessibility and responsive layout.
- Performance and trace-size limits.
- Documentation, examples, and release checklist.

## Later possibilities (not V1 commitments)
- More JavaScript syntax and semantics.
- Breakpoints and watch expressions.
- Trace export/import.
- Value-origin navigation.
- Graph-based data-flow visualization.
- TypeScript support.
- Additional languages.
- IDE integration.

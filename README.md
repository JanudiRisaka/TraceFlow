# TraceFlow

**See what happens inside your code.**

TraceFlow is a browser-based JavaScript execution visualizer. It helps developers inspect how a supported JavaScript program executes by presenting execution steps, variable values, function calls, and errors in an interactive interface.

## Project status

Early planning / pre-development. The first release is intentionally limited to a documented subset of JavaScript. Full JavaScript compatibility is not a V1 goal.

## V1 goals

- Enter or paste a JavaScript example.
- Parse supported JavaScript syntax.
- Execute supported programs using a controlled interpreter.
- Record deterministic execution events and state snapshots.
- Step forward and backward through recorded execution.
- Inspect variables and function calls.
- Explain parse-time and runtime errors with source locations.

## Non-goals for V1

- Running arbitrary JavaScript with unrestricted browser or operating-system access.
- Supporting every ECMAScript feature.
- Replacing production-grade debuggers.
- Multi-language support.
- Collaborative sessions, cloud accounts, or saved trace hosting.

## Repository layout

```text
traceflow/
├── docs/                 # Product and engineering documentation
├── github-issues/        # Proposed issue descriptions for GitHub
├── src/
│   ├── app/              # Application shell and page composition
│   ├── components/       # Editor, timeline, inspectors, visualizations
│   ├── engine/
│   │   ├── parser/       # AST parsing and supported-syntax validation
│   │   ├── interpreter/  # Controlled AST evaluator
│   │   ├── runtime/      # Environments, call frames and values
│   │   └── recorder/     # Events and snapshots
│   ├── state/            # UI and trace state
│   ├── types/            # Shared TypeScript types
│   └── utils/
├── tests/
└── README.md
```

The layout is a starting proposal; adjust it when implementation evidence justifies a change.

## Getting started

Setup commands will be added after the repository's package manager and tooling are selected in the setup issue.

## Documentation

Start with:
1. [Project Overview](docs/01-project-overview.md)
2. [Product Requirements](docs/02-product-requirements.md)
3. [MVP Scope](docs/03-mvp-scope.md)
4. [System Architecture](docs/05-system-architecture.md)
5. [Security Design](docs/08-security-design.md)

## Development workflow

GitHub Issues are the source of truth for actionable development work. Each issue should have a clear outcome and acceptance criteria. Technical decisions that affect architecture should be recorded in `docs/11-architecture-decisions.md`.

## License

Not selected yet. Choose a license before publishing or accepting external contributions.

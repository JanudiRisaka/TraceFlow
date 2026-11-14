# TraceFlow

**See what happens inside your code.**

TraceFlow is a browser-based JavaScript execution visualizer that helps developers understand how supported JavaScript programs execute. It presents execution steps, variable values, function calls, console output and runtime errors in an interactive interface.

## Project status

**Early development — V1**

TraceFlow is actively being developed. Its execution engine uses a controlled AST-based interpreter to execute a documented subset of JavaScript.

Full JavaScript compatibility is not a V1 goal. Unsupported syntax is rejected rather than executed through unrestricted native JavaScript evaluation.

## V1 goals

- Enter or paste a JavaScript example.
- Parse and validate supported JavaScript syntax.
- Execute supported programs using a controlled interpreter.
- Record execution events and state snapshots.
- Step forward and backward through recorded execution.
- Inspect variables, scopes and function calls.
- Display console output.
- Explain parse-time and runtime errors with source locations.
- Keep execution work off the main UI thread using Web Workers.

## Supported JavaScript syntax

TraceFlow currently supports a limited subset of JavaScript.

| Category | Supported features |
|---|---|
| Declarations | `let`, `const` |
| Values | Numbers, strings, booleans, `null` |
| Arithmetic | `+`, `-`, `*`, `/`, `%` |
| Comparisons | `<`, `<=`, `>`, `>=` |
| Equality | `==`, `!=`, `===`, `!==` |
| Unary operators | `+`, `-`, `!` |
| Updates | `++`, `--` |
| Assignment | `=` |
| Control flow | `if`, `else`, `for` |
| Functions | Named function declarations, calls and return statements |
| Scopes | Block, function and loop scopes |
| Console | Direct `console.log()` calls |

Function parameters must be simple identifiers. Only the documented operators and syntax forms are supported.

This table describes the implemented interpreter subset, not complete ECMAScript compatibility. Consult the security and technical documentation for implementation details.

## Known limitations

The following are outside the current supported subset:

- Arrow functions and function expressions.
- Classes and object-oriented syntax.
- Array and object literals.
- General property access and method calls.
- `while` and `do...while` loops.
- `switch` statements.
- `try...catch` and exception-handling syntax.
- Modules and imports.
- `async` / `await` and generators.
- Destructuring, spread and rest syntax.
- Optional chaining.
- Arbitrary browser APIs, Node.js APIs and unrestricted built-in function calls.
- Logical operators such as `&&`, `||` and `??`.
- Compound assignment operators such as `+=`, `-=` and `*=`.

TraceFlow is an educational execution visualizer, not a replacement for a production debugger or a general-purpose secure sandbox.

## V1 non-goals

- Running arbitrary JavaScript with unrestricted browser or operating-system access.
- Supporting every ECMAScript feature.
- Replacing production-grade debuggers.
- Multi-language support.
- Collaborative sessions, cloud accounts or saved trace hosting.

## Security and resource limits

TraceFlow uses a controlled AST interpreter rather than unrestricted `eval()` or `new Function()` execution for user-provided programs.

The execution engine applies configurable limits to resources including:

- Source size and AST complexity.
- Interpreter operations and loop iterations.
- Function call depth.
- Execution duration.
- Event and snapshot history.
- Cumulative snapshot binding entries.
- Console entries and string length.

Execution takes place in a Web Worker to help keep the interface responsive. A Worker is not a complete security boundary, and TraceFlow should not be treated as a sandbox for arbitrary untrusted code.

See [Security Design](docs/08-security-design.md) for details.

## Repository layout

TraceFlow/
|-- docs/                 # Product and engineering documentation
|-- e2e/                  # Playwright end-to-end tests
|-- public/               # Static public assets
|-- src/
|   |-- assets/           # Application assets
|   |-- components/       # React UI components
|   |-- engine/           # Parser, validator, runtime and execution engine
|-- README.md
|-- CHANGELOG.md
|-- package.json

## Getting started

### Prerequisites

- Node.js
- npm

### Installation

```bash
git clone https://github.com/JanudiRisaka/TraceFlow.git
cd TraceFlow
npm install
```

### Start the development server

```bash
npm run dev
```

### Run unit tests

```bash
npx vitest run
```

### Run end-to-end tests

```bash
npm run test:e2e
```

### Run lint

```bash
npm run lint
```

### Build the project

```bash
npm run build
```

## Documentation

Start with:

1. [Project Overview](docs/01-project-overview.md)
2. [Product Requirements](docs/02-product-requirements.md)
3. [MVP Scope](docs/03-mvp-scope.md)
4. [User Flows](docs/04-user-flows.md)
5. [System Architecture](docs/05-system-architecture.md)
6. [Technical Design](docs/06-technical-design.md)
7. [Execution Event Specification](docs/07-execution-event-spec.md)
8. [Security Design](docs/08-security-design.md)
9. [Testing Strategy](docs/09-testing-strategy.md)
10. [Product Roadmap](docs/10-product-roadmap.md)
11. [Architecture Decisions](docs/11-architecture-decisions.md)

## Development workflow

GitHub Issues are the source of truth for actionable development work. Each issue should have a clear outcome and acceptance criteria.

Technical decisions that affect architecture should be recorded in `docs/11-architecture-decisions.md`.

## License

No license has been selected yet. Until a license is added, do not assume that the project is open source or that others have permission to reuse its code.
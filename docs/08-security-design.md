# 8. Security Design

## Security objective
A user-provided program must not gain unrestricted access to the browser, network, local storage, filesystem, or host environment.

## Core rule
Do not execute user-provided source using unrestricted `eval()` or `new Function()`.

## V1 approach
- Parse source into an AST.
- Validate the AST against an explicit allowlist.
- Interpret supported nodes using TraceFlow-owned runtime semantics.
- Do not expose `window`, `document`, `fetch`, `XMLHttpRequest`, `localStorage`, `indexedDB`, Node APIs, filesystem APIs, or arbitrary host objects to the interpreted program.
- Do not provide dynamic code generation.
- Enforce a maximum interpreter step count.
- Enforce input-size and trace-size limits.
- Run engine work off the main UI thread where practical.
- Allow cancellation or discard of a run.
- Treat all displayed source, strings, and error messages as untrusted text; do not inject them as HTML.

## Important clarification
A Web Worker improves UI responsiveness and separates execution from the main thread, but it is not a complete security boundary against all denial-of-service or implementation vulnerabilities. The primary safety control is that the interpreter never delegates arbitrary user code to the native JavaScript runtime and exposes no host capabilities.

## Threats and mitigations

| Threat | Mitigation |
|---|---|
| Infinite loop | Interpreter step budget; cancellation |
| Excessive trace growth | Event/snapshot and source-size limits |
| Unsupported AST node bypass | Fail-closed validator and interpreter default error |
| Host API access | No host objects or capabilities in guest environment |
| UI injection | Render user content as text; avoid unsafe HTML |
| Main-thread freeze | Worker-based engine execution where practical |
| Malformed input | Parser error handling and input limits |

## Security acceptance checklist
- No unrestricted `eval` / `new Function` execution path.
- Unsupported AST nodes fail closed.
- Guest runtime has no ambient host APIs.
- Step and trace-size limits are tested.
- Infinite-loop test terminates within budget.
- User text is rendered safely.
- Errors do not expose sensitive internal details.

## Residual risks
The interpreter and parser are software and may contain defects. Keep dependencies updated, test hostile inputs, and do not market V1 as a general-purpose secure sandbox for arbitrary code.

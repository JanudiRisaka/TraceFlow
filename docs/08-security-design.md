# 8. Security Design

## 1. Security objective

User-provided programs must not gain unrestricted access to the browser, network, local storage, filesystem or host environment.

TraceFlow is an educational JavaScript execution visualizer. It is not designed to execute arbitrary JavaScript with unrestricted privileges and must not be marketed as a general-purpose secure sandbox.

## 2. Core security rule

Do not execute user-provided source using unrestricted `eval()` or `new Function()`.

TraceFlow uses a controlled AST-based interpreter to execute supported syntax.

## 3. V1 security approach

- Parse source into an Abstract Syntax Tree (AST).
- Validate the AST against an explicit allowlist of supported syntax.
- Reject unsupported syntax rather than falling back to native JavaScript execution.
- Interpret supported nodes using TraceFlow-owned runtime semantics.
- Do not expose browser APIs, Node.js APIs, filesystem APIs or arbitrary host objects to the interpreted program.
- Do not provide unrestricted dynamic code generation.
- Enforce source-size, AST-complexity and execution resource limits.
- Record execution events and snapshots within configured limits.
- Run execution work in a Web Worker to keep the main UI thread responsive.
- Enforce execution timeouts from the main thread and terminate the Worker when necessary.
- Allow execution cancellation.
- Validate messages received from the execution Worker.
- Treat displayed source, strings and error messages as untrusted text.

## 4. Resource limits

The execution engine uses configurable limits defined in `src/engine/resourceLimits.ts`.

| Resource | Maximum limit |
|---|---:|
| Source size | 100 KiB (102,400 bytes) |
| AST nodes | 20,000 |
| AST depth | 100 |
| Interpreter operations | 50,000 |
| Loop iterations | 10,000 cumulative per execution |
| Function call depth | 100 |
| Execution timeout | 3,000 ms |
| Execution events | 5,000 |
| Snapshots | 5,000 |
| Cumulative snapshot binding entries | 100,000 |
| Console entries | 500 |
| String length | 10,000 UTF-16 code units |

### Limit implementation details

- Source size is measured in UTF-8 bytes.
- String length is measured in UTF-16 code units.
- Source-size validation occurs before Worker creation in the Worker client and during parsing.
- AST node count and depth are checked during validation.
- Interpreter operations, loop iterations and function call depth are limited by the execution runtime.
- Snapshot recording enforces both a snapshot-count limit and a cumulative binding-entry limit.
- The Worker client validates returned execution data, including collection sizes and cumulative snapshot binding entries.
- The main thread enforces the execution timeout and terminates the Worker if execution exceeds the configured duration.

**Important:** These limits are individual resource budgets. The cumulative snapshot binding-entry limit is not a complete memory limit. Other data, including scope metadata, call-stack information, event values and runtime values, can also consume memory.

## 5. Worker execution and isolation

TraceFlow executes programs in a Web Worker rather than directly on the main UI thread.

The Worker provides execution separation and helps prevent long-running synchronous execution from freezing the interface.

The main thread manages the execution timeout. If a Worker exceeds the configured timeout, it is terminated and pending execution requests are rejected.

A Web Worker is not a complete security boundary. It does not, by itself, guarantee protection against every denial-of-service condition, browser vulnerability or implementation defect.

The primary safety control is the controlled interpreter, which executes only validated syntax without delegating arbitrary user-provided source to the native JavaScript runtime.

## 6. Threats and mitigations

| Threat | Mitigation |
|---|---|
| Infinite loops | Interpreter operation and loop-iteration limits; main-thread timeout |
| Excessive source input | UTF-8 source-size limit |
| Excessive AST complexity | AST node-count and depth limits |
| Excessive function recursion | Function call-depth limit |
| Excessive trace growth | Event, snapshot and cumulative binding-entry limits |
| Unsupported AST node bypass | Fail-closed AST validation and interpreter rejection |
| Host API access | Controlled runtime without exposed host capabilities |
| Malformed Worker responses | Runtime response validation and Worker termination |
| Main-thread freeze | Worker-based execution and timeout termination |
| Excessive string or console output | String-length and console-entry limits |
| Internal error disclosure | Generic messages for unexpected internal exceptions |
| UI injection | User-controlled content is rendered as text, not interpreted as HTML |
| Parser stack exhaustion | Recognize common parser stack-exhaustion errors and return a controlled parsing failure |

## 7. Security verification checklist

The following records the current implementation and verification evidence. Reviewed items are code-inspection results, not formal security proofs.

| Security requirement | Status | Evidence |
|---|---|---|
| No unrestricted `eval()` / `new Function()` execution path | Reviewed | Source search and interpreter/execution-path inspection |
| Unsupported AST nodes fail closed | Tested | AST validator and unsupported-syntax tests |
| Guest runtime does not expose ambient host APIs | Reviewed | Inspected `Environment.ts`, `value.ts`, `evaluate.ts`, `execute.ts` and `runProgram.ts`; no host APIs injected into the guest environment |
| Source-size limits are enforced | Tested | Parser and Worker client boundary tests |
| AST complexity limits are enforced | Tested | AST node-count and depth validation tests |
| Interpreter operation limits are enforced | Tested | Runtime resource-limit tests |
| Loop iteration limits are enforced | Tested | Unbounded `for (;;)` loop test with a reduced iteration limit |
| Function call-depth limits are enforced | Tested | Runtime function-depth tests |
| Execution timeout triggers Worker termination | Tested | Playwright test verifies timeout rejection and termination using an unresponsive mock Worker |
| Event and snapshot limits are enforced | Tested | Execution snapshot recorder tests |
| Cumulative snapshot binding-entry limit is enforced | Tested | Recorder and Worker response validation tests |
| Malformed Worker responses are rejected | Tested | Worker client tests |
| Unexpected internal errors do not expose internal details | Tested | Runtime and Worker error-handling tests |
| User-controlled UI content is rendered safely | Reviewed | Inspected React rendering paths; dynamic content uses JSX text rendering, and no unsafe HTML insertion APIs were found in `src` |
| Parser stack exhaustion | Tested | Recognized parser stack-exhaustion errors are converted into controlled parsing failures |
| Console output immutability | Tested | Console recorder tests verify that returned entries cannot mutate recorded output |
| Console output index integrity | Tested | Worker client test rejects non-sequential console output indexes |

## 8. Test coverage

The latest reported verification run completed successfully:

- Vitest: 272 tests passed across 13 test files.
- ESLint: passed.
- TypeScript: passed.
- Production build: passed.
- Playwright: 8 end-to-end tests passed.

The Playwright tests cover Worker execution, runtime errors, cancellation, main-thread responsiveness, malformed request rejection (including non-object payloads) and timeout handling.

The timeout test uses an unresponsive mock Worker to verify timeout rejection and termination. It does not simulate a real Worker executing an infinite loop.

The interpreter's unbounded `for (;;)` loop test separately verifies that the configured loop-iteration limit stops execution.

These results demonstrate that the tested cases pass. They do not prove the absence of all security vulnerabilities.

## 9. Residual risks and limitations

- The parser, validator, interpreter and Worker communication code may contain implementation defects.
- A Web Worker is not a complete security sandbox.
- Resource limits do not represent a strict total memory cap.
- Browser and JavaScript engine vulnerabilities remain outside TraceFlow's control.
- The supported JavaScript subset is intentionally limited.
- Not every possible malicious or malformed input has been tested.
- The UI rendering review is based on the inspected application source and does not constitute a complete security guarantee.
- Third-party dependencies may introduce vulnerabilities and must be kept updated.

Do not execute arbitrary untrusted JavaScript through TraceFlow or describe V1 as a production-grade secure sandbox.

## 10. Maintenance requirements

Before public release:

- Review changes to the parser, validator, interpreter and Worker communication code.
- Add regression tests for newly supported syntax and discovered vulnerabilities.
- Reassess resource limits when execution behavior or data structures change.
- Keep dependencies updated and review security advisories.
- Review UI rendering paths for unsafe HTML injection.
- Update this document whenever security behavior or resource limits change.
# Contributing to TraceFlow

## Before starting
- Read the project overview, PRD, MVP scope, architecture, and security design.
- Choose an open GitHub Issue.
- Confirm that the issue is not already being handled.

## Development expectations
- Keep changes focused on one issue.
- Add or update tests for behavior changes.
- Do not add unsupported JavaScript syntax without updating the support matrix and tests.
- Do not execute user code using unrestricted `eval()` or `new Function()`.
- Keep engine logic independent from React components.
- Update documentation when behavior or architecture changes.

## Pull requests
A pull request should include:
- What changed and why.
- Related issue link (for example, `Closes #12`).
- Tests run and results.
- Screenshots for visible UI changes.
- Known limitations or follow-up work.

## Definition of Done
- Acceptance criteria are met.
- Automated tests pass.
- Lint/type checks pass.
- Documentation is updated where necessary.
- No known security regression is introduced.

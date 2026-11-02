# 1. Project Overview

## Product name
TraceFlow

## Tagline
See what happens inside your code.

## Summary
TraceFlow is a browser-based tool that makes the execution of supported JavaScript programs visible. A user enters code, runs it through TraceFlow's controlled execution engine, and explores the resulting execution history.

The interface is intended to connect source code with the runtime state produced by each step. Users can inspect variable values, function calls, control-flow decisions, and errors.

## Problem
Reading source code or inspecting only a program's final output does not always make it easy to understand how a result was produced. Traditional debugging tools are powerful, but their interfaces and workflows can be difficult for learners and can require more setup than a small experiment deserves.

## Proposed solution
TraceFlow combines a code editor with a visual execution history. It records structured events and state snapshots while interpreting a deliberately supported subset of JavaScript.

## Intended users
- Developers investigating small JavaScript examples.
- Programming learners trying to understand execution order.
- Educators demonstrating variables, conditions, loops, and function calls.

## Product principles
1. **Correctness before breadth:** support fewer language constructs accurately rather than claim broad compatibility.
2. **Inspectable execution:** connect every displayed event to a source location where possible.
3. **Deterministic replay:** navigate recorded snapshots without re-running the program.
4. **Safe by design:** user code must not gain unrestricted access to browser or host capabilities.
5. **Honest limitations:** clearly explain unsupported syntax and runtime limits.

## Success indicators for V1
- A user can run each documented supported example and inspect its steps.
- Variable values shown at a selected step match the interpreter's state.
- Previous/next navigation restores the corresponding recorded state.
- Unsupported syntax is rejected with a useful source location.
- Automated tests cover every construct included in the V1 support matrix.

## Constraints and assumptions
- V1 targets JavaScript only.
- V1 is a learning/debugging aid, not a standards-complete JavaScript runtime.
- Trace data is initially held in browser memory; persistence/export is deferred unless later prioritized.
- The exact supported syntax is governed by the MVP scope and tested examples.

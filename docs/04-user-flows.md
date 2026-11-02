# 4. User Flows

## Flow A: Run a program
1. User opens TraceFlow.
2. User enters or pastes supported JavaScript in the editor.
3. User selects **Run**.
4. TraceFlow parses the source.
5. If parsing or validation fails, TraceFlow displays an error and source location where available.
6. If validation succeeds, the interpreter executes the program under configured limits.
7. The recorder produces an ordered trace.
8. The UI selects the initial or first meaningful execution step and displays the trace.

## Flow B: Inspect execution
1. User selects an event in the timeline or uses Next.
2. TraceFlow selects the associated snapshot.
3. The editor highlights the event's source location when available.
4. The variable inspector displays values visible at that point.
5. The call stack displays active frames at that point.
6. User moves backward or forward without re-running the program.

## Flow C: Inspect a variable
1. User selects a recorded step.
2. User finds a variable in the variable inspector.
3. TraceFlow displays its name, value, type, and scope/frame where available.
4. If the variable did not exist at that step, it must not be shown as though it did.

## Flow D: Handle unsupported syntax
1. User enters syntax outside the supported subset.
2. Parser or validator identifies the unsupported construct.
3. TraceFlow displays an unsupported-feature message and source location.
4. The program is not executed partially.

## Flow E: Handle runtime error
1. A supported program causes an interpreter runtime error.
2. The recorder retains valid events produced before the error.
3. The UI marks the trace as terminated by an error.
4. The error panel displays the error type, message, and source location when available.
5. User can inspect the preceding recorded steps.

## Empty and reset states
- Before a run: show a concise prompt and sample code.
- During execution: disable conflicting run actions or clearly define cancellation.
- After reset: clear the current trace and return to the editor state.
- For zero-step programs: show a completed trace with a useful empty-state message.

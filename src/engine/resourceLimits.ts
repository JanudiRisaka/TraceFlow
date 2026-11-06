
export const RESOURCE_LIMITS = {
  // Input and parsing
  maxSourceBytes: 100 * 1024,
  maxAstNodes: 20_000,
  maxAstDepth: 100,

  // Execution
  maxOperations: 50_000,
  maxLoopIterations: 10_000,
  maxFunctionCallDepth: 100,
  executionTimeoutMs: 3_000,

  // Execution history
  maxExecutionEvents: 5_000,
  maxSnapshots: 5_000,

  // Console output
  maxConsoleEntries: 500,
  maxStringLength: 10_000,
} as const

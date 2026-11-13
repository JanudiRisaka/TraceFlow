
export function isParserStackExhaustion(error: unknown): boolean {
  return (
    error instanceof Error &&
    /not enough stack space|maximum call stack size exceeded|too much recursion/i.test(
      error.message,
    )
  )
}

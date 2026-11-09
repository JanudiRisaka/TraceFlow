
export class ResourceLimitError extends Error {
  readonly code = 'EXECUTION_LIMIT_EXCEEDED'

  constructor(message: string) {
    super(message)
    this.name = 'ResourceLimitError'
  }
}

import type { RuntimeValue } from '../runtime/value'
import type { SourceLocation, RuntimeValueSnapshot } from './types'
import { toRuntimeValueSnapshot } from './ExecutionRecorder'
import { RESOURCE_LIMITS } from '../resourceLimits'
import { ResourceLimitError } from '../ResourceLimitError'

export type ConsoleOutputEntry = {
  index: number
  values: RuntimeValueSnapshot[]
  location: SourceLocation | null
}

export class ConsoleOutputRecorder {
  private entries: ConsoleOutputEntry[] = []

  record(
    values: RuntimeValue[],
    location: SourceLocation | null,
  ): ConsoleOutputEntry {
    if (this.entries.length >= RESOURCE_LIMITS.maxConsoleEntries) {
      throw new ResourceLimitError(
        `Execution stopped: the console output limit of ${RESOURCE_LIMITS.maxConsoleEntries} was reached.`,
      )
    }

    const entry: ConsoleOutputEntry = {
      index: this.entries.length,
      values: values.map(toRuntimeValueSnapshot),
      location,
    }

    this.entries.push(entry)

    return entry
  }

  getEntries(): ConsoleOutputEntry[] {
    return [...this.entries]
  }
}

import type { RuntimeValue } from '../runtime/value'
import type { SourceLocation, RuntimeValueSnapshot } from './types'
import { toRuntimeValueSnapshot } from './ExecutionRecorder'

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

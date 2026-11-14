
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

function cloneEntry(entry: ConsoleOutputEntry): ConsoleOutputEntry {
  return {
    ...entry,
    values: entry.values.map((value) => ({ ...value })),
    location: entry.location === null ? null : { ...entry.location },
  }
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  Object.freeze(value)

  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue)
  }

  return value
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

    const entry = deepFreeze({
      index: this.entries.length,
      values: values.map(toRuntimeValueSnapshot),
      location: location === null ? null : { ...location },
    })

    this.entries.push(entry)

    return cloneEntry(entry)
  }

  getEntries(): ConsoleOutputEntry[] {
    return this.entries.map(cloneEntry)
  }
}

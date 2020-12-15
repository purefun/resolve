import { SecretsManager, Event, SerializableMap } from 'resolve-core'
import { CommandExecutorBuilder, CommandExecutor } from 'resolve-command'
import { Phases, symbol } from './constants'
import { BDDAggregate } from './aggregate'
import transformEvents from './transform-events'
import { BDDAggregateAssertion } from './aggregate-assertions'

type BDDExecuteCommandState = {
  phase: Phases
  aggregate: BDDAggregate
  aggregateId: string
  secretsManager: SecretsManager
  events: Event[]
  command: {
    name: string
    payload: SerializableMap
    aggregateId: string
  }
  jwt?: string
  resolve: Function
  reject: Function
  assertion: BDDAggregateAssertion
}

type BDDExecuteCommandContext = {
  createCommand: CommandExecutorBuilder<CommandExecutor>
  promise: {
    [symbol]: BDDExecuteCommandState
  }
}

const makeDummyEventStore = ({
  secretsManager,
  events,
  aggregateId,
}: BDDExecuteCommandState) => {
  const savedEvents: Event[] = []
  const saveEvent = (event: Event): Promise<void> => {
    savedEvents.push(event)
    return Promise.resolve()
  }

  return {
    saveEvent,
    getNextCursor: () => Promise.resolve(null),
    saveSnapshot: () => Promise.resolve(),
    getSecretsManager: () => Promise.resolve(secretsManager),
    loadSnapshot: () => Promise.resolve(null),
    loadEvents: () =>
      Promise.resolve({
        events: transformEvents(events, 'aggregate', { aggregateId }),
      }),
  }
}

export const executeCommand = async (
  context: BDDExecuteCommandContext
): Promise<void> => {
  const {
    createCommand,
    promise: { [symbol]: state },
  } = context

  if (state.phase < Phases.COMMAND) {
    throw new TypeError(`unexpected phase`)
  }

  const { assertion, resolve, reject } = state
  let executor: CommandExecutor | null = null
  try {
    executor = createCommand(
      {
        aggregates: [
          {
            name: state.aggregate.name,
            projection: state.aggregate.projection,
            commands: state.aggregate.commands,
            encryption: state.aggregate.encryption || null,
            deserializeState: JSON.parse,
            serializeState: JSON.stringify,
            invariantHash: 'invariant-hash',
          },
        ],
      },
      {
        eventstore: makeDummyEventStore(state),
      }
    )

    const result = await executor({
      aggregateId: state.aggregateId,
      aggregateName: state.aggregate.name,
      type: state.command.name,
      payload: state.command.payload || {},
      jwt: state.jwt,
    })

    const event: {
      type: string
      payload?: SerializableMap
    } = {
      type: result.type,
    }

    if (Object.prototype.hasOwnProperty.call(result, 'payload')) {
      event['payload'] = result['payload']
    }

    return assertion(resolve, reject, event, null)
  } catch (error) {
    return assertion(resolve, reject, null, error)
  }
}

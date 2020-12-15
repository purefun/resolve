import {
  AggregateProjection,
  Command,
  CommandHandler,
  CommandResult,
  Event,
  AggregateMeta,
  Eventstore,
  Monitoring,
  PerformanceSubsegment,
} from 'resolve-core'
import getLog from './get-log'

type AggregateInstance = {
  name: string
  aggregateVersion: number
  aggregateId: string
  aggregateState: any
  projection: AggregateProjection
  cursor: any
  minimalTimestamp: number
  snapshotKey: string | null
  serializeState: Function
  deserializeState: Function
}

export type CommandExecutor = (command: Command) => Promise<CommandResult>

export type DisposableCommandExecutor = {
  execute: (command: Command) => Promise<CommandResult>
  dispose: () => Promise<void>
}

type CommandDomain = {
  aggregates: AggregateMeta[]
}

type CommandRuntime = {
  monitoring?: Monitoring
  eventstore: Eventstore
}

type CommandExecutorState = {
  isDisposed: boolean
}

type CommandExecutorBuilder<T> = (
  domain: CommandDomain,
  runtime: CommandRuntime,
  state?: CommandExecutorState
) => T

type SnapshotProcessor = (
  runtime: CommandRuntime,
  aggregateInstance: AggregateInstance
) => Promise<any>

// eslint-disable-next-line no-new-func
const CommandError = Function()
Object.setPrototypeOf(CommandError.prototype, Error.prototype)
export { CommandError }

const generateCommandError = (message: string): Error => {
  const error = new Error(message)
  Object.setPrototypeOf(error, CommandError.prototype)
  Object.defineProperties(error, {
    name: { value: 'CommandError', enumerable: true },
    message: { value: error.message, enumerable: true },
    stack: { value: error.stack, enumerable: true },
  })
  return error
}

const getPerformanceTracerSubsegment = (
  monitoring: Monitoring | undefined,
  name: string
): PerformanceSubsegment => {
  const segment = monitoring?.performanceTracer?.getSegment()
  const subSegment = segment?.addNewSubsegment(name)
  return (
    subSegment ?? {
      addAnnotation: () => {
        /*no-op*/
      },
      addError: () => {
        /*no-op*/
      },
      close: () => {
        /*no-op*/
      },
    }
  )
}

const checkOptionShape = (option: any, types: any[]): boolean =>
  !(
    option == null ||
    !types.reduce((acc, type) => acc || option.constructor === type, false)
  )

const verifyCommand = ({ aggregateId, aggregateName, type }: Command): void => {
  if (!checkOptionShape(aggregateId, [String])) {
    throw generateCommandError('The "aggregateId" argument must be a string')
  }
  if (!checkOptionShape(aggregateName, [String])) {
    throw generateCommandError('The "aggregateName" argument must be a string')
  }
  if (!checkOptionShape(type, [String])) {
    throw generateCommandError('The "type" argument must be a string')
  }
}

const projectionEventHandler = async (
  runtime: CommandRuntime,
  state: CommandExecutorState,
  aggregateInstance: AggregateInstance,
  processSnapshot: SnapshotProcessor | null,
  event: Event
): Promise<any> => {
  const subSegment = getPerformanceTracerSubsegment(
    runtime.monitoring,
    'applyEvent'
  )
  try {
    const aggregateName = aggregateInstance.name

    subSegment.addAnnotation('aggregateName', aggregateName)
    subSegment.addAnnotation('eventType', event.type)
    subSegment.addAnnotation('origin', 'resolve:applyEvent')

    if (state.isDisposed) {
      throw generateCommandError('Command handler is disposed')
    }

    if (aggregateInstance.aggregateVersion >= event.aggregateVersion) {
      throw generateCommandError(
        `Incorrect order of events by aggregateId = "${aggregateInstance.aggregateId}"`
      )
    }
    aggregateInstance.aggregateVersion = event.aggregateVersion
    if (
      aggregateInstance.projection != null &&
      typeof aggregateInstance.projection[event.type] === 'function'
    ) {
      aggregateInstance.aggregateState = await aggregateInstance.projection[
        event.type
      ](aggregateInstance.aggregateState, event)
    }

    aggregateInstance.cursor = await runtime.eventstore.getNextCursor(
      aggregateInstance.cursor,
      [event]
    )

    aggregateInstance.minimalTimestamp = event.timestamp

    if (typeof processSnapshot === 'function') {
      await processSnapshot(runtime, aggregateInstance)
    }
  } catch (error) {
    subSegment.addError(error)
    throw error
  } finally {
    subSegment.close()
  }
}

const takeSnapshot = async (
  runtime: CommandRuntime,
  aggregateInstance: AggregateInstance
): Promise<any> => {
  const { name: aggregateName } = aggregateInstance
  const { monitoring, eventstore } = runtime

  const log = getLog(
    `takeSnapshot:${aggregateName}:${aggregateInstance.aggregateId}`
  )
  const subSegment = getPerformanceTracerSubsegment(monitoring, 'applySnapshot')

  try {
    subSegment.addAnnotation('aggregateName', aggregateName)
    subSegment.addAnnotation('origin', 'resolve:applySnapshot')

    log.debug(`invoking event store snapshot taking operation`)
    log.verbose(`version: ${aggregateInstance.aggregateVersion}`)
    log.verbose(`minimalTimestamp: ${aggregateInstance.minimalTimestamp}`)

    await eventstore.saveSnapshot(
      aggregateInstance.snapshotKey,
      JSON.stringify({
        state: aggregateInstance.serializeState(
          aggregateInstance.aggregateState
        ),
        version: aggregateInstance.aggregateVersion,
        minimalTimestamp: aggregateInstance.minimalTimestamp,
        cursor: aggregateInstance.cursor,
      })
    )

    log.debug(`snapshot processed`)
  } catch (error) {
    log.error(error.message)
    subSegment.addError(error)
    throw error
  } finally {
    subSegment.close()
  }
}

const getAggregateState = async (
  runtime: CommandRuntime,
  state: CommandExecutorState,
  aggregate: AggregateMeta,
  aggregateId: string
): Promise<any> => {
  const { monitoring, eventstore } = runtime
  const { isDisposed } = state
  const {
    name: aggregateName,
    projection,
    serializeState,
    deserializeState,
    invariantHash = null,
  } = aggregate
  const log = getLog(`getAggregateState:${aggregateName}:${aggregateId}`)

  const subSegment = getPerformanceTracerSubsegment(
    monitoring,
    'getAggregateState'
  )

  try {
    subSegment.addAnnotation('aggregateName', aggregateName)
    subSegment.addAnnotation('origin', 'resolve:getAggregateState')

    const snapshotKey = checkOptionShape(projection, [Object])
      ? `AG;${invariantHash};${aggregateId}`
      : null

    if (!checkOptionShape(invariantHash, [String]) && snapshotKey != null) {
      throw generateCommandError(
        `Field "invariantHash" is required and must be a string when using aggregate snapshots`
      )
    }

    const aggregateInstance = {
      name: aggregateName,
      aggregateState: null,
      aggregateVersion: 0,
      minimalTimestamp: 0,
      cursor: null,
      aggregateId,
      projection,
      serializeState,
      deserializeState,
      snapshotKey,
    }

    try {
      if (snapshotKey == null) {
        throw generateCommandError(`no snapshot key`)
      }

      // TODO: Restore
      // if (projection == null) {
      //   const lastEvent = await pool.eventstoreAdapter.getLatestEvent({
      //     aggregateIds: [aggregateId]
      //   })
      //   if (lastEvent != null) {
      //     await regularHandler(pool, aggregateInfo, lastEvent)
      //   }
      //
      //   aggregateInfo.cursor = null
      //   return aggregateInfo
      // }

      const snapshot = await (async (): Promise<any> => {
        const subSegment = getPerformanceTracerSubsegment(
          runtime.monitoring,
          'loadSnapshot'
        )

        try {
          if (isDisposed) {
            throw generateCommandError('Command handler is disposed')
          }

          log.debug(`loading snapshot`)
          const snapshot = await eventstore.loadSnapshot(snapshotKey)

          if (snapshot != null && snapshot.constructor === String) {
            return JSON.parse(snapshot)
          }
          throw Error('invalid snapshot data')
        } catch (error) {
          subSegment.addError(error)
          throw error
        } finally {
          subSegment.close()
        }
      })()

      if (!(snapshot.cursor == null || isNaN(+snapshot.minimalTimestamp))) {
        log.verbose(`snapshot.version: ${snapshot.version}`)
        log.verbose(`snapshot.minimalTimestamp: ${snapshot.minimalTimestamp}`)

        Object.assign(aggregateInstance, {
          aggregateState: deserializeState(snapshot.state),
          aggregateVersion: snapshot.version,
          minimalTimestamp: snapshot.minimalTimestamp,
          cursor: snapshot.cursor,
        })
      }
    } catch (err) {
      log.verbose(err.message)
    }

    if (aggregateInstance.cursor == null && projection != null) {
      log.debug(`building the aggregate state from scratch`)
      aggregateInstance.aggregateState =
        typeof projection.Init === 'function' ? await projection.Init() : null
    }

    const eventHandler =
      snapshotKey != null
        ? projectionEventHandler.bind(
            null,
            runtime,
            state,
            aggregateInstance,
            takeSnapshot
          )
        : projectionEventHandler.bind(
            null,
            runtime,
            state,
            aggregateInstance,
            null
          )

    await (async (): Promise<any> => {
      const subSegment = getPerformanceTracerSubsegment(
        runtime.monitoring,
        'loadEvents'
      )

      try {
        if (isDisposed) {
          throw generateCommandError('Command handler is disposed')
        }

        const { events } = await eventstore.loadEvents({
          aggregateIds: [aggregateId],
          cursor: aggregateInstance.cursor,
          limit: Number.MAX_SAFE_INTEGER,
        })

        log.debug(
          `loaded ${events.length} events starting from the last snapshot`
        )
        for (const event of events) {
          await eventHandler(event)
        }

        subSegment.addAnnotation('eventCount', events.length)
        subSegment.addAnnotation('origin', 'resolve:loadEvents')
      } catch (error) {
        log.error(error.message)
        subSegment.addError(error)
        throw error
      } finally {
        subSegment.close()
      }
    })()

    return aggregateInstance
  } catch (error) {
    log.error(error.message)
    subSegment.addError(error)
    throw error
  } finally {
    subSegment.close()
  }
}

const isInteger = (val: any): val is number =>
  val != null && parseInt(val) === val && val.constructor === Number
const isString = (val: any): val is string =>
  val != null && val.constructor === String

const saveEvent = async (
  eventStore: Eventstore,
  event: Event
): Promise<any> => {
  if (!isString(event.type)) {
    throw generateCommandError(`Event "type" field is invalid`)
  }
  if (!isString(event.aggregateId)) {
    throw generateCommandError('Event "aggregateId" field is invalid')
  }
  if (!isInteger(event.aggregateVersion)) {
    throw generateCommandError('Event "aggregateVersion" field is invalid')
  }
  if (!isInteger(event.timestamp)) {
    throw generateCommandError('Event "timestamp" field is invalid')
  }

  event.aggregateId = String(event.aggregateId)

  await eventStore.saveEvent(event)

  return event
}

const executeCommand = async (
  domain: CommandDomain,
  runtime: CommandRuntime,
  state: CommandExecutorState | undefined,
  command: Command
): Promise<CommandResult> => {
  const actualState = state ?? { isDisposed: false }
  const { jwt: actualJwt, jwtToken: deprecatedJwt } = command

  const jwt = actualJwt || deprecatedJwt

  const subSegment = getPerformanceTracerSubsegment(
    runtime.monitoring,
    'executeCommand'
  )

  try {
    await verifyCommand(command)
    const aggregateName = command.aggregateName
    const aggregate = domain.aggregates.find(
      ({ name }) => aggregateName === name
    )

    subSegment.addAnnotation('aggregateName', aggregateName)
    subSegment.addAnnotation('commandType', command.type)
    subSegment.addAnnotation('origin', 'resolve:executeCommand')

    if (aggregate == null) {
      const error = generateCommandError(
        `Aggregate "${aggregateName}" does not exist`
      )
      await runtime.monitoring?.error(error, 'command')
      throw error
    }

    const { aggregateId, type } = command
    const {
      aggregateState,
      aggregateVersion,
      minimalTimestamp,
    } = await getAggregateState(runtime, actualState, aggregate, aggregateId)

    if (!aggregate.commands.hasOwnProperty(type)) {
      const error = generateCommandError(
        `Command type "${type}" does not exist`
      )

      await runtime.monitoring?.error(error, 'command')
      throw error
    }

    const commandHandler: CommandHandler = async (
      ...args
    ): Promise<CommandResult> => {
      const subSegment = getPerformanceTracerSubsegment(
        runtime.monitoring,
        'processCommand'
      )
      try {
        subSegment.addAnnotation('aggregateName', aggregateName)
        subSegment.addAnnotation('commandType', command.type)
        subSegment.addAnnotation('origin', 'resolve:processCommand')

        return await aggregate.commands[type](...args)
      } catch (error) {
        subSegment.addError(error)
        await runtime.monitoring?.error(error, 'command')
        throw error
      } finally {
        subSegment.close()
      }
    }

    const secretsManager = await runtime.eventstore.getSecretsManager()

    const encryption =
      typeof aggregate.encryption === 'function'
        ? await aggregate.encryption(aggregateId, {
            jwt,
            secretsManager,
          })
        : null

    const { encrypt = null, decrypt = null } = encryption || {
      encrypt: null,
      decrypt: null,
    }

    const event = await commandHandler(aggregateState, command, {
      jwt,
      aggregateVersion,
      encrypt,
      decrypt,
    })

    if (!checkOptionShape(event.type, [String])) {
      const error = generateCommandError('Event "type" is required')
      await runtime.monitoring?.error(error, 'command')
      throw error
    }

    const runtimeEvent = event as any

    if (
      runtimeEvent.aggregateId != null ||
      runtimeEvent.aggregateVersion != null ||
      runtimeEvent.timestamp != null
    ) {
      const error = generateCommandError(
        'Event should not contain "aggregateId", "aggregateVersion", "timestamp" fields'
      )

      await runtime.monitoring?.error(error, 'command')
      throw error
    }

    const processedEvent: Event = {
      aggregateId,
      aggregateVersion: aggregateVersion + 1,
      timestamp: Math.max(minimalTimestamp + 1, Date.now()),
      type: event.type,
    }

    if (Object.prototype.hasOwnProperty.call(event, 'payload')) {
      processedEvent.payload = event.payload
    }

    await (async (): Promise<void> => {
      const subSegment = getPerformanceTracerSubsegment(
        runtime.monitoring,
        'saveEvent'
      )

      try {
        return await saveEvent(runtime.eventstore, processedEvent)
      } catch (error) {
        subSegment.addError(error)
        await runtime.monitoring?.error(error, 'command')
        throw error
      } finally {
        subSegment.close()
      }
    })()

    return processedEvent
  } catch (error) {
    subSegment.addError(error)
    await runtime.monitoring?.error(error, 'command')
    throw error
  } finally {
    subSegment.close()
  }
}

const dispose = async (
  state: CommandExecutorState,
  monitoring?: Monitoring
): Promise<void> => {
  const subSegment = getPerformanceTracerSubsegment(monitoring, 'dispose')

  try {
    if (state.isDisposed) {
      throw generateCommandError('Command handler is disposed')
    }

    state.isDisposed = true
  } catch (error) {
    subSegment.addError(error)
    monitoring && monitoring.error && (await monitoring.error(error, 'command'))
    throw error
  } finally {
    subSegment.close()
  }
}

export const createCommandExecutor: CommandExecutorBuilder<CommandExecutor> = (
  domain,
  runtime,
  state?
): CommandExecutor => {
  return executeCommand.bind(null, domain, runtime, state)
}

export const createDisposableCommandExecutor: CommandExecutorBuilder<DisposableCommandExecutor> = (
  domain,
  runtime
): DisposableCommandExecutor => {
  const state = { isDisposed: false }
  const execute = createCommandExecutor(domain, runtime, state)
  return {
    execute,
    dispose: dispose.bind(null, state, runtime.monitoring),
  }
}

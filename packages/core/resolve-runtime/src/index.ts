import 'source-map-support/register'
import { Query } from 'resolve-client'
import debugLevels from 'resolve-debug-levels'
import { EventStoreAdapter } from 'resolve-query/types/types'

const log = debugLevels('resolve:resolve-runtime:entry-point')

type Worker = (...args: any[]) => Promise<any>
type ServerContext = {
  assemblies: {
    eventStoreAdapter: () => EventStoreAdapter
  }
  constants: object
  domain: object
}
type Runtime = {}
type Resolve = {
  query: (runtime: Runtime, query: Query) => Promise<any>
}

const initRuntime = (context: ServerContext, resolve: Resolve): Promise<any> =>
  Promise.resolve()
const resolve: Resolve = {
  query: () => Promise.resolve(),
}

const index = async (serverContext: ServerContext): Promise<Worker> => {
  log.debug(`instantiating server modules`)

  return () => initRuntime(serverContext, resolve)
}

export default index

import 'source-map-support/register'
import debugLevels from 'resolve-debug-levels'

const log = debugLevels('resolve:resolve-runtime:entry-point')

const index = async (serverContext: any): Promise<void> => {
  log.debug(`instantiating server modules`)
}

export default index

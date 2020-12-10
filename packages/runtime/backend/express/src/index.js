import { getLog } from './get-log'
import { initExpress } from './init-express'

const getFactory = (options) => async (config) => {
  const log = getLog('init')
  log.debug('initializing express backend')

  await initExpress(options, config)
}

export default getFactory

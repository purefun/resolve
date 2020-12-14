export default () => `
    import '$resolve.guardOnlyServer'
    import eventBrokerConfig from '$resolve.eventBrokerConfig'
    
    export { default as entryPointMarker } from 'resolve-runtime/lib/common/utils/entry-point-marker'

    const handler = async (...args) => {
      try {
        if(!global.initPromise) {
          const interopRequireDefault = require('@babel/runtime/helpers/interopRequireDefault')
          
          global.serverAssemblies = interopRequireDefault(
            require('$resolve.serverAssemblies')
          ).default
          global.eventBrokenConfig = interopRequireDefault(
            require('$resolve.eventBrokenConfig')
          ).default
          global.entryPoint = interopRequireDefault(
            require('resolve-runtime/lib/cloud')
          ).default

          global.initPromise = global.entryPoint(serverAssemblies)
        }
        const worker = await initPromise
        return await worker(...args)
      } catch(error) {
        console.error('Server entry point fatal error: ', error)
        throw error
      }
    }

    export default handler
  `

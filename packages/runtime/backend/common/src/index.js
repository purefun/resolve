import mainHandler from 'handlers/main-handler'
import initResolve from './init-resolve'
import disposeResolve from './dispose-resolve'
import getRootBasedUrl from './utils/get-root-based-url'

const utils = {
  getRootBasedUrl,
}

export { mainHandler, initResolve, disposeResolve, utils }

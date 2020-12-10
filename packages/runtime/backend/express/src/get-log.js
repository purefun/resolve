import log from 'resolve-debug-levels'

export const getLog = (scope) => log(`resolve:backend-express:${scope}`)

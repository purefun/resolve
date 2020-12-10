import express from 'express'
import { Server } from 'http'
import path from 'path'
import {
  mainHandler,
  initResolve,
  disposeResolve,
  utils,
} from 'resolve-backend-common'

import wrapApiHandler from './wrap-api-handler'

const { getRootBasedUrl } = utils

const initExpress = async (options, config) => {
  const app = express()
  const server = new Server(app)

  app.use(
    getRootBasedUrl(config.rootPath, `/${config.staticPath}`),
    express.static(path.join(process.cwd(), config.distDir, './client'))
  )

  app.use(async (req, res) => {
    const currentResolve = Object.create({})
    try {
      await initResolve(currentResolve)

      const getCustomParameters = async () => ({ resolve: currentResolve })
      const executor = wrapApiHandler(mainHandler, getCustomParameters)

      await executor(req, res)
    } finally {
      await disposeResolve(currentResolve)
    }
  })
}

export { initExpress }

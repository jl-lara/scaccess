import { app } from './app.js'
import { env } from './config/env.js'
import { disconnectPrisma } from './config/prisma.js'

const server = app.listen(env.PORT, () => {
  console.log(`[api] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
})

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(`[api] received ${signal}, shutting down`)

  server.close(async (error) => {
    if (error) {
      console.error('[api] error while closing the HTTP server', error)
      process.exitCode = 1
      return
    }

    try {
      await disconnectPrisma()
      process.exitCode = 0
    } catch (disconnectError) {
      console.error('[api] error while disconnecting Prisma', disconnectError)
      process.exitCode = 1
    }
  })
}

process.on('SIGINT', (signal) => {
  void shutdown(signal)
})

process.on('SIGTERM', (signal) => {
  void shutdown(signal)
})

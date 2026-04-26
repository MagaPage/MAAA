/**
 * Child process worker for isolated bot instances.
 * Receives config via BOT_CONFIG env var, communicates via IPC.
 */
const { BotManager } = require('./botManager')
const { createLogger } = require('../utils/logger')

const botId = process.env.BOT_ID || 'worker'
const config = JSON.parse(process.env.BOT_CONFIG || '{}')
const logger = createLogger({ logLevel: config.logLevel || 'info' })

const botManager = new BotManager(config, logger)

function sendStatus(status) {
  if (process.send) {
    process.send({ type: 'status', status })
  }
}

function sendState(state) {
  if (process.send) {
    process.send({ type: 'state', state })
  }
}

function sendError(error) {
  if (process.send) {
    process.send({ type: 'error', error })
  }
}

botManager.on('spawned', (state) => {
  sendStatus('online')
  sendState(state)
})

botManager.on('disconnected', () => {
  sendStatus('disconnected')
})

botManager.on('error', (err) => {
  sendError(err.message)
})

process.on('message', async (msg) => {
  if (msg.type === 'shutdown') {
    logger.info(`Bot worker ${botId} shutting down...`)
    await botManager.disconnect()
    process.exit(0)
  }
})

process.on('SIGTERM', async () => {
  await botManager.disconnect()
  process.exit(0)
})

logger.info(`Bot worker ${botId} started`)
sendStatus('ready')

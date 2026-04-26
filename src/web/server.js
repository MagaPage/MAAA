const express = require('express')
const http = require('http')
const { Server: SocketServer } = require('socket.io')
const path = require('path')
const { createRoutes } = require('./routes')
const { IntegrationManager } = require('./integrations')

class DashboardServer {
  constructor(config, logger) {
    this.config = config
    this.logger = logger
    this.app = express()
    this.server = http.createServer(this.app)
    this.io = new SocketServer(this.server, {
      cors: { origin: '*' },
    })
    this.integrationManager = new IntegrationManager(logger)

    this.app.use(express.json())
    this.app.use(express.static(path.join(__dirname, 'public')))
  }

  async start(port) {
    const listenPort = port || this.config.web.port

    return new Promise((resolve) => {
      this.server.listen(listenPort, () => {
        this.logger.info(`Dashboard running at http://localhost:${listenPort}`)
        resolve()
      })
    })
  }

  mountRoutes(botManager, skillController, llmInterface, contextGenerator, leash) {
    const routes = createRoutes(botManager, skillController, llmInterface, contextGenerator, leash, this.integrationManager)
    this.app.use('/api', routes)
  }

  attachBot(botManager, skillController) {
    this.io.on('connection', (socket) => {
      this.logger.info(`Dashboard client connected: ${socket.id}`)

      const state = botManager.getState()
      if (state) {
        socket.emit('botState', state)
      }

      socket.on('command', async (data) => {
        socket.emit('commandReceived', { message: data.message })
      })

      socket.on('disconnect', () => {
        this.logger.info(`Dashboard client disconnected: ${socket.id}`)
      })
    })

    botManager.on('spawned', (state) => {
      this.io.emit('botState', state)
      this.io.emit('log', { type: 'info', message: 'Bot spawned' })
    })

    botManager.on('positionUpdate', (pos) => {
      this.io.emit('botPosition', pos)
    })

    botManager.on('healthUpdate', (health) => {
      this.io.emit('healthUpdate', health)
    })

    botManager.on('death', () => {
      this.io.emit('log', { type: 'error', message: 'Bot died!' })
      this.integrationManager.notifyError('Bot died!')
    })

    botManager.on('kicked', (reason) => {
      this.io.emit('log', { type: 'error', message: `Kicked: ${reason}` })
      this.integrationManager.notifyError(`Bot kicked: ${reason}`)
    })

    botManager.on('disconnected', (reason) => {
      this.io.emit('log', { type: 'warn', message: `Disconnected: ${reason}` })
    })

    skillController.on('taskStart', (task) => {
      this.io.emit('taskStart', task)
      this.io.emit('log', { type: 'info', message: `Starting task: ${task.action}` })
    })

    skillController.on('taskProgress', (progress) => {
      this.io.emit('taskProgress', progress)
    })

    skillController.on('taskComplete', (result) => {
      this.io.emit('taskComplete', result)
      this.io.emit('log', {
        type: 'info',
        message: `Task complete: ${result.action} (${result.duration}ms)`,
      })
      this.integrationManager.notifyTaskComplete(result.action, result.duration)
    })

    skillController.on('taskError', (error) => {
      this.io.emit('taskError', error)
      this.io.emit('log', { type: 'error', message: `Task error: ${error.error}` })
      this.integrationManager.notifyError(`Task error: ${error.error}`)
    })
  }

  async stop() {
    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info('Dashboard server stopped')
        resolve()
      })
    })
  }
}

module.exports = { DashboardServer }

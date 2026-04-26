const express = require('express')
const http = require('http')
const https = require('https')
const fs = require('fs')
const { Server: SocketServer } = require('socket.io')
const path = require('path')
const helmet = require('helmet')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const { createRoutes } = require('./routes')
const { IntegrationManager } = require('./integrations')
const { createAuth } = require('./auth')

class DashboardServer {
  /**
   * Create a new DashboardServer instance.
   * @param {object} config - Application configuration
   * @param {object} logger - Winston logger instance
   */
  constructor(config, logger) {
    this.config = config
    this.logger = logger
    this.app = express()

    this.server = this._createServer()
    this.io = new SocketServer(this.server, {
      cors: {
        origin: config.web?.allowedOrigins || false,
        methods: ['GET', 'POST'],
      },
      pingTimeout: 20000,
      pingInterval: 25000,
    })
    this.integrationManager = new IntegrationManager(logger, config)
    this.auth = createAuth(config, logger)

    this._setupMiddleware()
  }

  /**
   * Create HTTP or HTTPS server based on configuration.
   * If HTTPS_KEY and HTTPS_CERT env vars point to valid files, uses HTTPS.
   * @returns {http.Server|https.Server} The server instance
   */
  _createServer() {
    const keyPath = this.config.web?.httpsKey
    const certPath = this.config.web?.httpsCert

    if (keyPath && certPath) {
      try {
        const key = fs.readFileSync(keyPath)
        const cert = fs.readFileSync(certPath)
        this.logger.info('HTTPS enabled with provided certificate')
        return https.createServer({ key, cert }, this.app)
      } catch (err) {
        this.logger.warn(`Failed to load TLS certificates: ${err.message}. Falling back to HTTP.`)
      }
    }

    return http.createServer(this.app)
  }

  _setupMiddleware() {
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          imgSrc: ["'self'", 'data:'],
        },
      },
      crossOriginEmbedderPolicy: false,
    }))

    this.app.use(express.json({ limit: '100kb' }))

    const apiLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: ipKeyGenerator,
      message: { error: 'Too many requests, please try again later' },
    })

    const commandLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: ipKeyGenerator,
      message: { error: 'Command rate limit exceeded, please wait' },
    })

    const integrationLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: ipKeyGenerator,
      message: { error: 'Integration test rate limit exceeded' },
    })

    this.app.use('/api', apiLimiter)
    this.app.use('/api/command', commandLimiter)
    this.app.use('/api/integrations/*/test', integrationLimiter)

    this.app.use(express.static(path.join(__dirname, 'public'), {
      dotfiles: 'deny',
      index: 'index.html',
    }))

    this.app.use('/api', this.auth.authMiddleware)

    this.app.disable('x-powered-by')
  }

  /**
   * Start listening on the configured port.
   * Binds to localhost only if BIND_LOCALHOST is set.
   * @param {number} [port] - Override port
   * @returns {Promise<void>}
   */
  async start(port) {
    const listenPort = port || this.config.web.port
    const host = this.config.web?.bindLocalhost ? '127.0.0.1' : '0.0.0.0'
    const protocol = this.config.web?.httpsKey ? 'https' : 'http'

    return new Promise((resolve) => {
      this.server.listen(listenPort, host, () => {
        this.logger.info(`Dashboard running at ${protocol}://${host === '0.0.0.0' ? 'localhost' : host}:${listenPort}`)
        resolve()
      })
    })
  }

  /**
   * Mount API routes and error handlers.
   * @param {object} botManager - BotManager instance
   * @param {object} skillController - SkillController instance
   * @param {object} llmInterface - LLMInterface instance
   * @param {object} contextGenerator - ContextGenerator instance
   * @param {object} leash - Leash instance
   */
  mountRoutes(botManager, skillController, llmInterface, contextGenerator, leash) {
    const routes = createRoutes(botManager, skillController, llmInterface, contextGenerator, leash, this.integrationManager)
    this.auth.mountAuthRoutes(routes)
    this.app.use('/api', routes)

    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' })
    })

    this.app.use((err, _req, res, _next) => {
      this.logger.error(`Unhandled error: ${err.message}`)
      const status = err.status || err.statusCode || 500
      res.status(status).json({ error: status === 500 ? 'Internal server error' : err.message })
    })
  }

  /**
   * Attach bot event listeners and Socket.io connection handling.
   * @param {object} botManager - BotManager instance
   * @param {object} skillController - SkillController instance
   */
  attachBot(botManager, skillController) {
    const connectedClients = new Set()

    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token
      if (!this.auth.validateSocketToken(token)) {
        return next(new Error('Authentication required'))
      }
      next()
    })

    this.io.on('connection', (socket) => {
      if (connectedClients.size >= 50) {
        socket.disconnect(true)
        return
      }
      connectedClients.add(socket.id)
      this.logger.info(`Dashboard client connected: ${socket.id}`)

      const state = botManager.getState()
      if (state) {
        socket.emit('botState', state)
      }

      socket.on('command', async (data) => {
        if (!data || typeof data.message !== 'string') return
        socket.emit('commandReceived', { message: data.message.slice(0, 500) })
      })

      socket.on('disconnect', () => {
        connectedClients.delete(socket.id)
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
      const safeReason = typeof reason === 'string' ? reason.slice(0, 500) : 'Unknown'
      this.io.emit('log', { type: 'error', message: `Kicked: ${safeReason}` })
      this.integrationManager.notifyError(`Bot kicked: ${safeReason}`)
    })

    botManager.on('disconnected', (reason) => {
      const safeReason = typeof reason === 'string' ? reason.slice(0, 500) : 'Unknown'
      this.io.emit('log', { type: 'warn', message: `Disconnected: ${safeReason}` })
    })

    botManager.on('botError', (err) => {
      this.logger.error(`Bot error: ${err.message}`)
      this.io.emit('log', { type: 'error', message: `Bot error: ${err.message}` })
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

  /**
   * Stop the dashboard server.
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.auth && this.auth.cleanup) {
      this.auth.cleanup()
    }
    this.io.close()
    return new Promise((resolve) => {
      this.server.close(() => {
        this.logger.info('Dashboard server stopped')
        resolve()
      })
    })
  }
}

module.exports = { DashboardServer }

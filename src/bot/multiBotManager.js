const { fork } = require('child_process')
const EventEmitter = require('events')
const path = require('path')

class MultiBotManager extends EventEmitter {
  /**
   * Manage multiple bot instances in isolated child processes.
   * Each bot runs in its own forked process for fault isolation.
   * @param {object} config - Application configuration
   * @param {object} logger - Winston logger
   */
  constructor(config, logger) {
    super()
    this.config = config
    this.logger = logger
    this.bots = new Map()
  }

  /**
   * Spawn a new bot in an isolated child process.
   * @param {string} id - Unique bot identifier
   * @param {object} botConfig - Per-bot configuration overrides
   * @returns {object} Bot process info
   */
  spawnBot(id, botConfig = {}) {
    if (this.bots.has(id)) {
      throw new Error(`Bot '${id}' already exists`)
    }

    const child = fork(path.join(__dirname, 'botWorker.js'), [], {
      env: {
        ...process.env,
        BOT_ID: id,
        BOT_CONFIG: JSON.stringify({ ...this.config, ...botConfig }),
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    })

    const botInfo = {
      id,
      process: child,
      pid: child.pid,
      status: 'starting',
      startedAt: Date.now(),
    }

    child.on('message', (msg) => {
      if (msg.type === 'status') {
        botInfo.status = msg.status
        this.emit('botStatus', { id, status: msg.status })
      } else if (msg.type === 'state') {
        this.emit('botState', { id, state: msg.state })
      } else if (msg.type === 'error') {
        this.logger.error(`Bot ${id} error: ${msg.error}`)
        this.emit('botError', { id, error: msg.error })
      }
    })

    child.on('exit', (code) => {
      this.logger.info(`Bot ${id} process exited with code ${code}`)
      botInfo.status = 'stopped'
      this.emit('botStopped', { id, code })
      this.bots.delete(id)
    })

    child.on('error', (err) => {
      this.logger.error(`Bot ${id} process error: ${err.message}`)
      this.emit('botError', { id, error: err.message })
    })

    this.bots.set(id, botInfo)
    this.logger.info(`Spawned bot '${id}' in process ${child.pid}`)
    return { id, pid: child.pid, status: 'starting' }
  }

  /**
   * Stop a bot by its ID.
   * @param {string} id - Bot identifier
   * @returns {boolean} Whether the bot was found and stopped
   */
  stopBot(id) {
    const bot = this.bots.get(id)
    if (!bot) return false

    bot.process.send({ type: 'shutdown' })

    setTimeout(() => {
      if (bot.process.connected) {
        bot.process.kill('SIGTERM')
      }
    }, 5000)

    return true
  }

  /**
   * Get the status of all active bots.
   * @returns {Array<object>} Array of bot status objects
   */
  getAll() {
    return Array.from(this.bots.values()).map(b => ({
      id: b.id,
      pid: b.pid,
      status: b.status,
      uptime: Date.now() - b.startedAt,
    }))
  }

  /**
   * Stop all bot processes.
   */
  stopAll() {
    for (const [id] of this.bots) {
      this.stopBot(id)
    }
  }
}

module.exports = { MultiBotManager }

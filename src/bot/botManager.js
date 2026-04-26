const mineflayer = require('mineflayer')
const { pathfinder } = require('mineflayer-pathfinder')
const EventEmitter = require('events')

class BotManager extends EventEmitter {
  /**
   * Manage the Minecraft bot lifecycle with auto-reconnect support.
   * @param {object} config - Application configuration
   * @param {object} logger - Winston logger instance
   */
  constructor(config, logger) {
    super()
    this.config = config
    this.logger = logger
    this.bot = null
    this._authToken = null
    this._profile = null
    this._reconnecting = false
    this._reconnectAttempts = 0
    this._reconnectTimer = null
    this._intentionalDisconnect = false
  }

  /**
   * Create and connect a Minecraft bot.
   * @param {string} authToken - Microsoft auth token
   * @param {object} profile - Player profile
   * @returns {Promise<object>} The mineflayer bot instance
   */
  async createBot(authToken, profile) {
    this._authToken = authToken
    this._profile = profile
    this._intentionalDisconnect = false
    this._reconnectAttempts = 0

    return this._connect()
  }

  /**
   * Internal connection logic.
   * @returns {Promise<object>} The mineflayer bot instance
   */
  _connect() {
    return new Promise((resolve, reject) => {
      const botOptions = {
        host: this.config.mc.host,
        port: this.config.mc.port,
        username: this._profile?.name || 'MAAA_Bot',
        version: this.config.mc.version,
        auth: this.config.mc.auth,
      }

      if (this.config.mc.auth === 'microsoft') {
        botOptions.auth = 'microsoft'
        botOptions.profilesFolder = this.config.tokenCacheDir
      }

      this.bot = mineflayer.createBot(botOptions)
      this.bot.loadPlugin(pathfinder)

      this.bot.once('spawn', () => {
        this.logger.info(`Bot spawned at ${this._posStr()}`)
        this._reconnectAttempts = 0
        this._reconnecting = false
        this.emit('spawned', this.getState())
        resolve(this.bot)
      })

      this.bot.on('health', () => {
        this.emit('healthUpdate', {
          health: this.bot.health,
          food: this.bot.food,
          saturation: this.bot.foodSaturation,
        })
      })

      this.bot.on('death', () => {
        this.logger.warn('Bot died!')
        this.emit('death')
      })

      this.bot.on('kicked', (reason) => {
        this.logger.error(`Bot kicked: ${reason}`)
        this.emit('kicked', reason)
      })

      this.bot.on('error', (err) => {
        this.logger.error(`Bot error: ${err.message}`)
        this.emit('botError', err)
        if (!this.bot) {
          reject(err)
        }
      })

      this.bot.on('end', (reason) => {
        this.logger.info(`Bot disconnected: ${reason}`)
        this.emit('disconnected', reason)
        this.bot = null

        if (!this._intentionalDisconnect && this.config.mc.reconnect) {
          this._scheduleReconnect()
        }
      })

      this.bot.on('move', () => {
        if (!this.bot?.entity) return
        this.emit('positionUpdate', {
          x: Math.floor(this.bot.entity.position.x),
          y: Math.floor(this.bot.entity.position.y),
          z: Math.floor(this.bot.entity.position.z),
        })
      })
    })
  }

  /**
   * Schedule a reconnection attempt with exponential backoff.
   */
  _scheduleReconnect() {
    const maxRetries = this.config.mc.reconnectMaxRetries || 10
    if (this._reconnectAttempts >= maxRetries) {
      this.logger.error(`Max reconnect attempts (${maxRetries}) reached. Giving up.`)
      this.emit('reconnectFailed', { attempts: this._reconnectAttempts })
      return
    }

    this._reconnecting = true
    this._reconnectAttempts++
    const baseDelay = this.config.mc.reconnectDelay || 5000
    const delay = Math.min(baseDelay * Math.pow(2, this._reconnectAttempts - 1), 60000)

    this.logger.info(`Reconnecting in ${delay / 1000}s (attempt ${this._reconnectAttempts}/${maxRetries})...`)
    this.emit('reconnecting', { attempt: this._reconnectAttempts, maxRetries, delay })

    this._reconnectTimer = setTimeout(async () => {
      try {
        await this._connect()
        this.logger.info('Reconnected successfully')
        this.emit('reconnected')
      } catch (err) {
        this.logger.error(`Reconnect failed: ${err.message}`)
        if (!this._intentionalDisconnect) {
          this._scheduleReconnect()
        }
      }
    }, delay)
  }

  /**
   * Gracefully disconnect the bot.
   * @returns {Promise<void>}
   */
  async disconnect() {
    this._intentionalDisconnect = true
    this._reconnecting = false

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    if (this.bot) {
      this.bot.quit()
      this.bot = null
      this.logger.info('Bot disconnected gracefully')
    }
  }

  /**
   * Get the current bot state as a serializable object.
   * @returns {object|null} Bot state or null if not connected
   */
  getState() {
    if (!this.bot) {
      return this._reconnecting
        ? { reconnecting: true, attempt: this._reconnectAttempts }
        : null
    }

    const pos = this.bot.entity?.position
    return {
      position: pos ? { x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z) } : null,
      health: this.bot.health,
      food: this.bot.food,
      saturation: this.bot.foodSaturation,
      experience: {
        level: this.bot.experience?.level || 0,
        points: this.bot.experience?.points || 0,
      },
      inventory: this._getInventorySummary(),
      isRaining: this.bot.isRaining,
      time: this.bot.time?.timeOfDay || 0,
      dimension: this.bot.game?.dimension || 'unknown',
      reconnecting: false,
    }
  }

  /**
   * Get summarized inventory grouped by item name.
   * @returns {Array<object>} Array of {name, count, slot}
   */
  _getInventorySummary() {
    if (!this.bot?.inventory) return []

    const items = this.bot.inventory.items()
    const summary = {}

    for (const item of items) {
      const key = item.name
      if (summary[key]) {
        summary[key].count += item.count
      } else {
        summary[key] = { name: item.name, count: item.count, slot: item.slot }
      }
    }

    return Object.values(summary)
  }

  /**
   * Get a string representation of the bot's position.
   * @returns {string} Position string like "(x, y, z)"
   */
  _posStr() {
    const pos = this.bot?.entity?.position
    if (!pos) return 'unknown'
    return `(${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`
  }
}

module.exports = { BotManager }

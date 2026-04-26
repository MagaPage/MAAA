const mineflayer = require('mineflayer')
const { pathfinder } = require('mineflayer-pathfinder')
const EventEmitter = require('events')

class BotManager extends EventEmitter {
  constructor(config, logger) {
    super()
    this.config = config
    this.logger = logger
    this.bot = null
  }

  async createBot(authToken, profile) {
    return new Promise((resolve, reject) => {
      const botOptions = {
        host: this.config.mc.host,
        port: this.config.mc.port,
        username: profile?.name || 'MAAA_Bot',
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
        this.emit('error', err)
        reject(err)
      })

      this.bot.on('end', (reason) => {
        this.logger.info(`Bot disconnected: ${reason}`)
        this.emit('disconnected', reason)
      })

      this.bot.on('move', () => {
        this.emit('positionUpdate', {
          x: Math.floor(this.bot.entity.position.x),
          y: Math.floor(this.bot.entity.position.y),
          z: Math.floor(this.bot.entity.position.z),
        })
      })
    })
  }

  async disconnect() {
    if (this.bot) {
      this.bot.quit()
      this.bot = null
      this.logger.info('Bot disconnected gracefully')
    }
  }

  getState() {
    if (!this.bot) return null

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
    }
  }

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

  _posStr() {
    const pos = this.bot?.entity?.position
    if (!pos) return 'unknown'
    return `(${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`
  }
}

module.exports = { BotManager }

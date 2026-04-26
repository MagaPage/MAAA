const EventEmitter = require('events')

class SkillController extends EventEmitter {
  constructor(bot, builder, miner, navigator, logger) {
    super()
    this.bot = bot
    this.builder = builder
    this.miner = miner
    this.navigator = navigator
    this.logger = logger
    this.currentTask = null
    this.history = []
  }

  async execute(command) {
    if (!command.success) {
      const error = { action: 'error', error: command.error }
      this.emit('taskError', error)
      return error
    }

    const { action, params } = command
    this.currentTask = { action, params, startTime: Date.now() }
    this.emit('taskStart', this.currentTask)

    try {
      let result

      switch (action) {
      case 'build':
        result = await this._handleBuild(params)
        break
      case 'mine':
        result = await this._handleMine(params)
        break
      case 'navigate':
        result = await this._handleNavigate(params)
        break
      case 'follow':
        result = await this._handleFollow(params)
        break
      case 'chat':
        result = await this._handleChat(params)
        break
      case 'stop':
        result = this._handleStop()
        break
      case 'scan':
        result = await this._handleScan(params)
        break
      case 'equip':
        result = await this._handleEquip(params)
        break
      case 'craft':
        result = await this._handleCraft(params)
        break
      default:
        result = { error: `Unknown action: ${action}` }
      }

      const entry = {
        action,
        params,
        result,
        timestamp: new Date().toISOString(),
        duration: Date.now() - this.currentTask.startTime,
      }
      this.history.push(entry)
      this.currentTask = null

      this.emit('taskComplete', entry)
      return result
    } catch (err) {
      const error = {
        action,
        error: err.message,
        timestamp: new Date().toISOString(),
      }
      this.history.push(error)
      this.currentTask = null
      this.emit('taskError', error)
      throw err
    }
  }

  async _handleBuild(params) {
    const origin = this.bot.entity.position.clone()

    if (params.schematic) {
      return await this.builder.buildSchematic(params.schematic, origin)
    }

    const placements = this.builder.generateProcedural(params.type, {
      block: params.block || 'cobblestone',
      height: params.height,
      width: params.width,
      size: params.size,
      length: params.length,
    })

    this.emit('taskProgress', {
      action: 'build',
      total: placements.length,
      message: `Building ${params.type} with ${placements.length} blocks`,
    })

    return await this.builder.buildSchematic(placements, origin)
  }

  async _handleMine(params) {
    return await this.miner.autoMine({
      radius: params.radius || 32,
      oreTypes: params.oreTypes,
      maxClusters: params.maxClusters || 10,
    })
  }

  async _handleNavigate(params) {
    await this.navigator.goto(params.x, params.y, params.z, params.range || 1)
    return { success: true, destination: { x: params.x, y: params.y, z: params.z } }
  }

  async _handleFollow(params) {
    const player = this.bot.players[params.target]
    if (!player?.entity) {
      return { success: false, error: `Player '${params.target}' not found or out of range` }
    }

    await this.navigator.followEntity(player.entity, params.range || 2)
    return { success: true, following: params.target }
  }

  async _handleChat(params) {
    this.bot.chat(params.message)
    return { success: true, message: params.message }
  }

  _handleStop() {
    this.navigator.stop()
    this.miner.stopMining()
    return { success: true, message: 'All activities stopped' }
  }

  async _handleScan(params) {
    const clusters = this.miner.scanOres(params.radius || 32, params.oreTypes)
    return {
      success: true,
      clusters: clusters.map(c => ({
        oreType: c.oreType,
        size: c.size,
        center: {
          x: Math.floor(c.center.x),
          y: Math.floor(c.center.y),
          z: Math.floor(c.center.z),
        },
        distance: Math.floor(c.center.distanceTo(this.bot.entity.position)),
      })),
    }
  }

  async _handleEquip(params) {
    const item = this.bot.inventory.items().find(i => i.name === params.item)
    if (!item) {
      return { success: false, error: `Item '${params.item}' not in inventory` }
    }

    await this.bot.equip(item, params.destination || 'hand')
    return { success: true, equipped: params.item }
  }

  async _handleCraft(params) {
    const mcData = require('minecraft-data')(this.bot.version)
    const itemData = mcData.itemsByName[params.item]
    if (!itemData) {
      return { success: false, error: `Unknown item: ${params.item}` }
    }

    const recipes = this.bot.recipesFor(itemData.id, null, 1, null)
    if (recipes.length === 0) {
      return { success: false, error: `No recipe found for ${params.item}` }
    }

    await this.bot.craft(recipes[0], params.count || 1)
    return { success: true, crafted: params.item, count: params.count || 1 }
  }

  getHistory() {
    return this.history
  }

  getCurrentTask() {
    return this.currentTask
  }
}

module.exports = { SkillController }

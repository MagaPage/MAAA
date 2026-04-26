const EventEmitter = require('events')

class SkillController extends EventEmitter {
  /**
   * Orchestrate command execution across builder, miner, and navigator engines.
   * Supports task queuing and checkpoint/resume for build operations.
   * @param {object} bot - Mineflayer bot instance
   * @param {object} builder - Builder engine
   * @param {object} miner - Miner engine
   * @param {object} navigator - Navigator engine
   * @param {object} logger - Winston logger
   */
  constructor(bot, builder, miner, navigator, logger) {
    super()
    this.bot = bot
    this.builder = builder
    this.miner = miner
    this.navigator = navigator
    this.logger = logger
    this.currentTask = null
    this.history = []
    this.taskQueue = []
    this._lastCheckpoint = null
  }

  /**
   * Execute a parsed LLM command. Supports priority queueing.
   * @param {object} command - Parsed command with action and params
   * @param {object} [options] - Execution options
   * @param {number} [options.priority=0] - Priority level (higher = first)
   * @returns {Promise<object>} Execution result
   */
  async execute(command, options = {}) {
    if (!command.success) {
      const error = { action: 'error', error: command.error }
      this.emit('taskError', error)
      return error
    }

    if (this.currentTask && options.priority === undefined) {
      this.taskQueue.push({ command, options })
      this.emit('taskQueued', { action: command.action, queuePosition: this.taskQueue.length })
      return { queued: true, position: this.taskQueue.length }
    }

    return this._executeTask(command)
  }

  /**
   * Internal task execution.
   * @param {object} command - Parsed command
   * @returns {Promise<object>} Result
   */
  async _executeTask(command) {
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
      this._processQueue()
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
      this._processQueue()
      throw err
    }
  }

  /**
   * Process the next task in the queue if available.
   */
  _processQueue() {
    if (this.taskQueue.length === 0) return

    this.taskQueue.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0))
    const next = this.taskQueue.shift()
    this._executeTask(next.command).catch((err) => {
      this.logger.error(`Queued task failed: ${err.message}`)
    })
  }

  /**
   * Handle build commands with checkpoint support.
   * @param {object} params - Build parameters
   * @returns {Promise<object>} Build result
   */
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

    this._lastCheckpoint = {
      action: 'build',
      params,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      totalPlacements: placements.length,
      timestamp: new Date().toISOString(),
    }

    const result = await this.builder.buildSchematic(placements, origin)

    if (result.failed > 0) {
      this._lastCheckpoint.failedBlocks = result.errors
      this._lastCheckpoint.placed = result.placed
    } else {
      this._lastCheckpoint = null
    }

    return result
  }

  /**
   * Handle mine commands with progress tracking.
   * @param {object} params - Mine parameters
   * @returns {Promise<object>} Mining result
   */
  async _handleMine(params) {
    this._lastCheckpoint = {
      action: 'mine',
      params,
      timestamp: new Date().toISOString(),
    }

    const result = await this.miner.autoMine({
      radius: params.radius || 32,
      oreTypes: params.oreTypes,
      maxClusters: params.maxClusters || 10,
    })

    this._lastCheckpoint = null
    return result
  }

  /**
   * Handle navigate commands.
   * @param {object} params - Navigation parameters
   * @returns {Promise<object>} Navigation result
   */
  async _handleNavigate(params) {
    await this.navigator.goto(params.x, params.y, params.z, params.range || 1)
    return { success: true, destination: { x: params.x, y: params.y, z: params.z } }
  }

  /**
   * Handle follow commands.
   * @param {object} params - Follow parameters
   * @returns {Promise<object>} Follow result
   */
  async _handleFollow(params) {
    const player = this.bot.players[params.target]
    if (!player?.entity) {
      return { success: false, error: `Player '${params.target}' not found or out of range` }
    }

    await this.navigator.followEntity(player.entity, params.range || 2)
    return { success: true, following: params.target }
  }

  /**
   * Handle chat commands.
   * @param {object} params - Chat parameters
   * @returns {object} Chat result
   */
  async _handleChat(params) {
    this.bot.chat(params.message)
    return { success: true, message: params.message }
  }

  /**
   * Stop all current activities including queued tasks.
   * @returns {object} Stop result
   */
  _handleStop() {
    this.navigator.stop()
    this.miner.stopMining()
    const cleared = this.taskQueue.length
    this.taskQueue = []
    this._lastCheckpoint = null
    return { success: true, message: 'All activities stopped', clearedQueue: cleared }
  }

  /**
   * Handle scan commands.
   * @param {object} params - Scan parameters
   * @returns {object} Scan results with cluster info
   */
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

  /**
   * Handle equip commands.
   * @param {object} params - Equip parameters
   * @returns {Promise<object>} Equip result
   */
  async _handleEquip(params) {
    const item = this.bot.inventory.items().find(i => i.name === params.item)
    if (!item) {
      return { success: false, error: `Item '${params.item}' not in inventory` }
    }

    await this.bot.equip(item, params.destination || 'hand')
    return { success: true, equipped: params.item }
  }

  /**
   * Handle craft commands.
   * @param {object} params - Craft parameters
   * @returns {Promise<object>} Craft result
   */
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

    const count = params.count || 1
    await this.bot.craft(recipes[0], count)
    return { success: true, crafted: params.item, count }
  }

  /**
   * Get the current task info.
   * @returns {object|null} Current task or null
   */
  getCurrentTask() {
    return this.currentTask
  }

  /**
   * Get the last checkpoint for resumable operations.
   * @returns {object|null} Checkpoint data or null
   */
  getLastCheckpoint() {
    return this._lastCheckpoint
  }

  /**
   * Get the task queue status.
   * @returns {Array<object>} Queued tasks
   */
  getQueue() {
    return this.taskQueue.map((t, i) => ({
      position: i + 1,
      action: t.command.action,
      priority: t.options.priority || 0,
    }))
  }

  /**
   * Get command execution history.
   * @returns {Array<object>} History entries
   */
  getHistory() {
    return this.history
  }
}

module.exports = { SkillController }

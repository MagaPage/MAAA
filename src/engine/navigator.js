const { Movements, goals } = require('mineflayer-pathfinder')
const { GoalNear, GoalBlock, GoalXZ, GoalY, GoalFollow } = goals

class Navigator {
  /**
   * A* pathfinding wrapper using mineflayer-pathfinder.
   * @param {object} bot - Mineflayer bot instance
   * @param {object} logger - Winston logger
   */
  constructor(bot, logger) {
    this.bot = bot
    this.logger = logger
    this.movements = null
    this._setupMovements()
  }

  _setupMovements() {
    this.movements = new Movements(this.bot)
    this.movements.canDig = true
    this.movements.allow1by1towers = true
    this.movements.scafoldingBlocks = []
    this.bot.pathfinder.setMovements(this.movements)
  }

  /**
   * Navigate to a position within a range.
   * @param {number} x - Target X coordinate
   * @param {number} y - Target Y coordinate
   * @param {number} z - Target Z coordinate
   * @param {number} [range=1] - Acceptable distance from target
   * @returns {Promise<void>}
   */
  async goto(x, y, z, range = 1) {
    this.logger.info(`Navigating to (${x}, ${y}, ${z}) range=${range}`)
    const goal = new GoalNear(x, y, z, range)
    await this.bot.pathfinder.goto(goal)
    this.logger.info('Navigation complete')
  }

  async gotoBlock(x, y, z) {
    this.logger.info(`Navigating to block (${x}, ${y}, ${z})`)
    const goal = new GoalBlock(x, y, z)
    await this.bot.pathfinder.goto(goal)
  }

  async gotoXZ(x, z) {
    this.logger.info(`Navigating to XZ (${x}, ${z})`)
    const goal = new GoalXZ(x, z)
    await this.bot.pathfinder.goto(goal)
  }

  async gotoY(y) {
    this.logger.info(`Navigating to Y=${y}`)
    const goal = new GoalY(y)
    await this.bot.pathfinder.goto(goal)
  }

  /**
   * Follow an entity continuously.
   * @param {object} entity - Entity to follow
   * @param {number} [range=2] - Follow distance
   * @returns {Promise<void>}
   */
  async followEntity(entity, range = 2) {
    this.logger.info(`Following entity: ${entity.username || entity.name || 'unknown'}`)
    const goal = new GoalFollow(entity, range)
    this.bot.pathfinder.setGoal(goal, true)
  }

  /**
   * Stop all pathfinding.
   */
  stop() {
    this.bot.pathfinder.stop()
    this.logger.info('Navigation stopped')
  }

  /**
   * Check if the bot is currently moving.
   * @returns {boolean}
   */
  isMoving() {
    return this.bot.pathfinder.isMoving()
  }

  /**
   * Update movement configuration.
   * @param {object} [options] - Movement options
   * @param {boolean} [options.canDig] - Whether bot can dig while pathfinding
   * @param {boolean} [options.canPlace] - Whether bot can place blocks (1x1 towers)
   */
  updateMovements(options = {}) {
    if (options.canDig !== undefined) this.movements.canDig = options.canDig
    if (options.canPlace !== undefined) this.movements.allow1by1towers = options.canPlace
    this.bot.pathfinder.setMovements(this.movements)
  }
}

module.exports = { Navigator }

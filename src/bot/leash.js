const Vec3 = require('vec3').Vec3

class Leash {
  /**
   * Soft-leash boundary enforcement system.
   * Prevents the bot from wandering beyond a configurable distance from origin.
   * @param {object} bot - Mineflayer bot instance
   * @param {object} [options] - Leash options
   * @param {number} [options.maxDistance=256] - Maximum distance from origin
   * @param {object} [options.origin] - Origin position
   */
  constructor(bot, options = {}) {
    this.bot = bot
    this.maxDistance = options.maxDistance || 256
    this.origin = options.origin || null
    this.enabled = false
    this._tickHandler = null
    this._returning = false
  }

  /**
   * Set the leash origin point.
   * @param {object} pos - Position with x, y, z
   */
  setOrigin(pos) {
    this.origin = new Vec3(pos.x, pos.y, pos.z)
  }

  /**
   * Check if a position is within the leash boundary.
   * @param {object} pos - Position to check
   * @returns {boolean} True if within bounds
   */
  isWithinBounds(pos) {
    if (!this.origin) return true
    const dx = pos.x - this.origin.x
    const dz = pos.z - this.origin.z
    const distance = Math.sqrt(dx * dx + dz * dz)
    return distance <= this.maxDistance
  }

  /**
   * Get the horizontal distance from origin to a position.
   * @param {object} pos - Position to measure
   * @returns {number} Distance in blocks
   */
  getDistance(pos) {
    if (!this.origin) return 0
    const dx = pos.x - this.origin.x
    const dz = pos.z - this.origin.z
    return Math.sqrt(dx * dx + dz * dz)
  }

  /**
   * Enable leash boundary checking on physics ticks.
   */
  enable() {
    if (this.enabled) return

    if (!this.origin && this.bot.entity) {
      this.origin = this.bot.entity.position.clone()
    }

    this.enabled = true
    this._tickHandler = () => this._checkBounds()
    this.bot.on('physicsTick', this._tickHandler)
  }

  /**
   * Disable leash boundary checking.
   */
  disable() {
    if (!this.enabled) return
    this.enabled = false

    if (this._tickHandler) {
      this.bot.removeListener('physicsTick', this._tickHandler)
      this._tickHandler = null
    }
  }

  _checkBounds() {
    if (!this.bot.entity || !this.origin || this._returning) return

    const pos = this.bot.entity.position
    if (!this.isWithinBounds(pos)) {
      this._returning = true

      if (this.bot.pathfinder) {
        this.bot.pathfinder.stop()
      }

      const { Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')
      const movements = new Movements(this.bot)
      this.bot.pathfinder.setMovements(movements)
      this.bot.pathfinder.setGoal(
        new GoalNear(this.origin.x, this.origin.y, this.origin.z, 5)
      )

      const cleanup = () => {
        this._returning = false
        this.bot.removeListener('move', checkReturn)
        this.bot.removeListener('death', cleanup)
        clearTimeout(timeout)
      }

      const checkReturn = () => {
        if (this.bot.entity && this.isWithinBounds(this.bot.entity.position)) {
          cleanup()
        }
      }

      const timeout = setTimeout(cleanup, 30000)
      this.bot.on('move', checkReturn)
      this.bot.once('death', cleanup)
    }
  }
}

module.exports = { Leash }

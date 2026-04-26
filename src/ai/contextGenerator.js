class ContextGenerator {
  /**
   * Generate human-readable context strings from bot state for LLM prompts.
   * @param {object} bot - Mineflayer bot instance
   */
  constructor(bot) {
    this.bot = bot
  }

  /**
   * Generate a full context string including position, vitals, inventory,
   * nearby entities, nearby blocks, and environment.
   * @returns {string} Formatted context for LLM system prompt
   */
  generate() {
    const sections = [
      this._positionSection(),
      this._vitalSection(),
      this._inventorySection(),
      this._nearbyEntitiesSection(),
      this._nearbyBlocksSection(),
      this._environmentSection(),
    ]

    return sections.filter(Boolean).join('\n\n')
  }

  /**
   * Generate position and orientation section.
   * @returns {string} Position info
   */
  _positionSection() {
    const pos = this.bot.entity?.position
    if (!pos) return 'Position: Unknown'

    return [
      '## Bot Status',
      `Position: (${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)})`,
      `Yaw: ${(this.bot.entity.yaw * 180 / Math.PI).toFixed(1)}°`,
      `On Ground: ${this.bot.entity.onGround}`,
    ].join('\n')
  }

  /**
   * Generate vitals section (health, food, saturation, XP).
   * @returns {string} Vitals info
   */
  _vitalSection() {
    return [
      '## Vitals',
      `Health: ${this.bot.health}/20`,
      `Food: ${this.bot.food}/20`,
      `Saturation: ${this.bot.foodSaturation?.toFixed(1) || '0'}`,
      `Experience Level: ${this.bot.experience?.level || 0}`,
    ].join('\n')
  }

  /**
   * Generate inventory summary section.
   * @returns {string} Inventory listing
   */
  _inventorySection() {
    const items = this.bot.inventory?.items() || []
    if (items.length === 0) return '## Inventory\nEmpty'

    const summary = {}
    for (const item of items) {
      if (summary[item.name]) {
        summary[item.name] += item.count
      } else {
        summary[item.name] = item.count
      }
    }

    const lines = Object.entries(summary)
      .map(([name, count]) => `- ${name}: ${count}`)

    return ['## Inventory', ...lines].join('\n')
  }

  /**
   * Generate nearby entities section (within 16 blocks).
   * @returns {string} Entity listing
   */
  _nearbyEntitiesSection() {
    const entities = Object.values(this.bot.entities || {})
    const nearby = entities
      .filter(e => {
        if (e === this.bot.entity) return false
        const dist = e.position?.distanceTo(this.bot.entity.position)
        return dist && dist <= 16
      })
      .map(e => ({
        type: e.type,
        name: e.username || e.displayName || e.name || e.type,
        distance: Math.floor(e.position.distanceTo(this.bot.entity.position)),
        position: e.position,
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10)

    if (nearby.length === 0) return '## Nearby Entities\nNone within 16 blocks'

    const lines = nearby.map(e =>
      `- ${e.name} (${e.type}) at distance ${e.distance}`
    )

    return ['## Nearby Entities', ...lines].join('\n')
  }

  /**
   * Generate nearby blocks section (8-block radius, top 15 by count).
   * @returns {string|null} Block counts or null if no position
   */
  _nearbyBlocksSection() {
    const pos = this.bot.entity?.position
    if (!pos) return null

    const blockCounts = {}
    const radius = 8

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const block = this.bot.blockAt(pos.offset(dx, dy, dz))
          if (block && block.name !== 'air' && block.name !== 'cave_air') {
            blockCounts[block.name] = (blockCounts[block.name] || 0) + 1
          }
        }
      }
    }

    const sorted = Object.entries(blockCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => `- ${name}: ${count}`)

    return ['## Nearby Blocks (8-block radius)', ...sorted].join('\n')
  }

  /**
   * Generate environment section (time, weather, dimension, difficulty).
   * @returns {string} Environment info
   */
  _environmentSection() {
    const timeOfDay = this.bot.time?.timeOfDay || 0
    let timeStr = 'Day'
    if (timeOfDay >= 12000 && timeOfDay < 13000) timeStr = 'Sunset'
    else if (timeOfDay >= 13000 && timeOfDay < 23000) timeStr = 'Night'
    else if (timeOfDay >= 23000) timeStr = 'Sunrise'

    return [
      '## Environment',
      `Time: ${timeStr} (${timeOfDay} ticks)`,
      `Weather: ${this.bot.isRaining ? 'Raining' : 'Clear'}`,
      `Dimension: ${this.bot.game?.dimension || 'overworld'}`,
      `Difficulty: ${this.bot.game?.difficulty || 'unknown'}`,
    ].join('\n')
  }
}

module.exports = { ContextGenerator }

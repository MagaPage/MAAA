const Vec3 = require('vec3').Vec3

class Builder {
  /**
   * Block placement engine for procedural and schematic builds.
   * @param {object} bot - Mineflayer bot instance
   * @param {object} navigator - Navigator engine
   * @param {object} logger - Winston logger
   */
  constructor(bot, navigator, logger) {
    this.bot = bot
    this.navigator = navigator
    this.logger = logger
  }

  /**
   * Parse a schematic JSON into an array of block placements.
   * @param {object} schematic - Schematic with blocks array or palette+structure
   * @returns {Array<object>} Sorted placements with pos and blockName
   */
  parseSchematic(schematic) {
    const placements = []

    if (schematic.blocks && Array.isArray(schematic.blocks)) {
      for (const block of schematic.blocks) {
        placements.push({
          pos: new Vec3(block.x, block.y, block.z),
          blockName: block.name || block.type || 'cobblestone',
        })
      }
    } else if (schematic.palette && schematic.structure) {
      const { palette, structure } = schematic
      for (let y = 0; y < structure.length; y++) {
        for (let z = 0; z < structure[y].length; z++) {
          for (let x = 0; x < structure[y][z].length; x++) {
            const paletteIndex = structure[y][z][x]
            if (paletteIndex > 0) {
              placements.push({
                pos: new Vec3(x, y, z),
                blockName: palette[paletteIndex] || 'cobblestone',
              })
            }
          }
        }
      }
    }

    return placements.sort((a, b) => a.pos.y - b.pos.y || a.pos.z - b.pos.z || a.pos.x - b.pos.x)
  }

  /**
   * Generate procedural block placements for a structure type.
   * @param {string} type - Structure type (tower, wall, cube, floor, pyramid)
   * @param {object} params - Build parameters (block, height, width, size, length)
   * @returns {Array<object>} Sorted placements
   */
  generateProcedural(type, params) {
    const placements = []
    const block = params.block || 'cobblestone'

    switch (type) {
    case 'tower': {
      const height = params.height || 10
      for (let y = 0; y < height; y++) {
        placements.push({ pos: new Vec3(0, y, 0), blockName: block })
      }
      break
    }
    case 'wall': {
      const width = params.width || 10
      const height = params.height || 5
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          placements.push({ pos: new Vec3(x, y, 0), blockName: block })
        }
      }
      break
    }
    case 'cube': {
      const size = params.size || 5
      for (let y = 0; y < size; y++) {
        for (let z = 0; z < size; z++) {
          for (let x = 0; x < size; x++) {
            const isEdge = x === 0 || x === size - 1 ||
                             y === 0 || y === size - 1 ||
                             z === 0 || z === size - 1
            if (isEdge) {
              placements.push({ pos: new Vec3(x, y, z), blockName: block })
            }
          }
        }
      }
      break
    }
    case 'floor': {
      const length = params.length || 10
      const width = params.width || 10
      for (let z = 0; z < length; z++) {
        for (let x = 0; x < width; x++) {
          placements.push({ pos: new Vec3(x, 0, z), blockName: block })
        }
      }
      break
    }
    case 'pyramid': {
      const baseSize = params.size || 10
      for (let y = 0; y < Math.ceil(baseSize / 2); y++) {
        const layerSize = baseSize - (y * 2)
        if (layerSize <= 0) break
        for (let z = 0; z < layerSize; z++) {
          for (let x = 0; x < layerSize; x++) {
            placements.push({ pos: new Vec3(x + y, y, z + y), blockName: block })
          }
        }
      }
      break
    }
    default:
      this.logger.warn(`Unknown procedural type: ${type}`)
    }

    return placements.sort((a, b) => a.pos.y - b.pos.y || a.pos.z - b.pos.z || a.pos.x - b.pos.x)
  }

  /**
   * Build a schematic or placement array in the game world.
   * @param {object|Array} schematic - Schematic object or pre-parsed placements
   * @param {object} origin - World position to build relative to
   * @returns {Promise<object>} Result with total, placed, failed counts
   */
  async buildSchematic(schematic, origin) {
    const placements = Array.isArray(schematic) ? schematic : this.parseSchematic(schematic)
    const total = placements.length
    let placed = 0
    let failed = 0
    const errors = []

    this.logger.info(`Starting build: ${total} blocks at (${origin.x}, ${origin.y}, ${origin.z})`)

    for (const placement of placements) {
      const worldPos = origin.offset(placement.pos.x, placement.pos.y, placement.pos.z)

      try {
        await this._placeBlock(worldPos, placement.blockName)
        placed++

        if (placed % 10 === 0) {
          this.logger.info(`Build progress: ${placed}/${total}`)
        }
      } catch (err) {
        failed++
        errors.push({ pos: worldPos, block: placement.blockName, error: err.message })
        this.logger.warn(`Failed to place ${placement.blockName} at ${worldPos}: ${err.message}`)

        if (err.message.includes('out of reach') || err.message.includes('too far')) {
          try {
            await this.navigator.goto(worldPos.x, worldPos.y, worldPos.z, 3)
            await this._placeBlock(worldPos, placement.blockName)
            placed++
            failed--
            errors.pop()
          } catch (retryErr) {
            this.logger.error(`Retry failed: ${retryErr.message}`)
          }
        }
      }
    }

    const result = { total, placed, failed, errors }
    this.logger.info(`Build complete: ${placed}/${total} placed, ${failed} failed`)
    return result
  }

  async _placeBlock(pos, blockName) {
    const item = this.bot.inventory.items().find(i => i.name === blockName)
    if (!item) {
      throw new Error(`No ${blockName} in inventory`)
    }

    await this.bot.equip(item, 'hand')

    const referenceBlock = this._findReferenceBlock(pos)
    if (!referenceBlock) {
      throw new Error(`No reference block to place against at ${pos}`)
    }

    const faceVector = pos.minus(referenceBlock.position)
    await this.bot.placeBlock(referenceBlock, faceVector)
  }

  _findReferenceBlock(pos) {
    const faces = [
      new Vec3(0, -1, 0),
      new Vec3(0, 1, 0),
      new Vec3(1, 0, 0),
      new Vec3(-1, 0, 0),
      new Vec3(0, 0, 1),
      new Vec3(0, 0, -1),
    ]

    for (const face of faces) {
      const refPos = pos.plus(face)
      const block = this.bot.blockAt(refPos)
      if (block && block.name !== 'air' && block.name !== 'cave_air') {
        return block
      }
    }

    return null
  }
}

module.exports = { Builder }

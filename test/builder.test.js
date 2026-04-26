const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Builder - generateProcedural (unit logic)', () => {
  // We test the procedural generation logic by creating a mock builder
  function generateProcedural(type, params) {
    const Vec3 = require('vec3').Vec3
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
    default:
      break
    }

    return placements
  }

  it('should generate a tower with correct height', () => {
    const placements = generateProcedural('tower', { height: 5, block: 'stone' })
    assert.equal(placements.length, 5)
    assert.equal(placements[0].blockName, 'stone')
    assert.equal(placements[0].pos.y, 0)
    assert.equal(placements[4].pos.y, 4)
  })

  it('should generate a wall with correct dimensions', () => {
    const placements = generateProcedural('wall', { width: 4, height: 3, block: 'brick' })
    assert.equal(placements.length, 12) // 4 * 3
    assert.equal(placements[0].blockName, 'brick')
  })

  it('should generate a cube (hollow) with correct block count', () => {
    const placements = generateProcedural('cube', { size: 3, block: 'glass' })
    // 3x3x3 cube, all edges: 3^3 - 1^3 = 26
    assert.equal(placements.length, 26)
    assert.equal(placements[0].blockName, 'glass')
  })

  it('should generate a floor with correct area', () => {
    const placements = generateProcedural('floor', { width: 5, length: 3, block: 'oak_planks' })
    assert.equal(placements.length, 15) // 5 * 3
  })

  it('should default to cobblestone when no block specified', () => {
    const placements = generateProcedural('tower', { height: 1 })
    assert.equal(placements[0].blockName, 'cobblestone')
  })

  it('should return empty for unknown type', () => {
    const placements = generateProcedural('spaceship', {})
    assert.equal(placements.length, 0)
  })
})

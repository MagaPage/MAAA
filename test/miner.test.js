const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const Vec3 = require('vec3').Vec3

describe('Miner - clustering logic (unit)', () => {
  function clusterBlocks(blocks, clusterDistance = 3) {
    const clusters = []
    const visited = new Set()

    for (let i = 0; i < blocks.length; i++) {
      if (visited.has(i)) continue

      const cluster = {
        blocks: [blocks[i]],
        oreType: blocks[i].name || 'unknown',
      }
      visited.add(i)

      for (let j = i + 1; j < blocks.length; j++) {
        if (visited.has(j)) continue
        const dist = blocks[i].position.distanceTo(blocks[j].position)
        if (dist <= clusterDistance) {
          cluster.blocks.push(blocks[j])
          visited.add(j)
        }
      }

      let x = 0, y = 0, z = 0
      for (const b of cluster.blocks) {
        x += b.position.x
        y += b.position.y
        z += b.position.z
      }
      const len = cluster.blocks.length
      cluster.center = new Vec3(x / len, y / len, z / len)
      cluster.size = cluster.blocks.length
      clusters.push(cluster)
    }

    return clusters
  }

  it('should cluster adjacent blocks', () => {
    const blocks = [
      { position: new Vec3(0, 10, 0), name: 'iron_ore' },
      { position: new Vec3(1, 10, 0), name: 'iron_ore' },
      { position: new Vec3(2, 10, 0), name: 'iron_ore' },
    ]

    const clusters = clusterBlocks(blocks)
    assert.equal(clusters.length, 1)
    assert.equal(clusters[0].size, 3)
  })

  it('should separate distant blocks into different clusters', () => {
    const blocks = [
      { position: new Vec3(0, 10, 0), name: 'iron_ore' },
      { position: new Vec3(100, 10, 0), name: 'iron_ore' },
    ]

    const clusters = clusterBlocks(blocks)
    assert.equal(clusters.length, 2)
    assert.equal(clusters[0].size, 1)
    assert.equal(clusters[1].size, 1)
  })

  it('should calculate cluster center correctly', () => {
    const blocks = [
      { position: new Vec3(0, 10, 0), name: 'diamond_ore' },
      { position: new Vec3(2, 10, 0), name: 'diamond_ore' },
    ]

    const clusters = clusterBlocks(blocks)
    assert.equal(clusters[0].center.x, 1)
    assert.equal(clusters[0].center.y, 10)
  })

  it('should handle empty input', () => {
    const clusters = clusterBlocks([])
    assert.equal(clusters.length, 0)
  })

  it('should handle single block', () => {
    const blocks = [
      { position: new Vec3(5, 20, 5), name: 'gold_ore' },
    ]

    const clusters = clusterBlocks(blocks)
    assert.equal(clusters.length, 1)
    assert.equal(clusters[0].size, 1)
    assert.equal(clusters[0].oreType, 'gold_ore')
  })
})

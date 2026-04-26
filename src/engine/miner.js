const Vec3 = require('vec3').Vec3

const DEFAULT_ORE_TYPES = [
  'diamond_ore', 'deepslate_diamond_ore',
  'iron_ore', 'deepslate_iron_ore',
  'gold_ore', 'deepslate_gold_ore',
  'coal_ore', 'deepslate_coal_ore',
  'lapis_ore', 'deepslate_lapis_ore',
  'redstone_ore', 'deepslate_redstone_ore',
  'emerald_ore', 'deepslate_emerald_ore',
  'copper_ore', 'deepslate_copper_ore',
  'ancient_debris',
]

class Miner {
  constructor(bot, navigator, logger) {
    this.bot = bot
    this.navigator = navigator
    this.logger = logger
    this.mining = false
  }

  scanOres(radius = 32, oreTypes = DEFAULT_ORE_TYPES) {
    const mcData = require('minecraft-data')(this.bot.version)
    const oreBlockIds = oreTypes
      .map(name => mcData.blocksByName[name])
      .filter(Boolean)
      .map(b => b.id)

    if (oreBlockIds.length === 0) {
      this.logger.warn('No valid ore types found for current version')
      return []
    }

    const blocks = this.bot.findBlocks({
      matching: oreBlockIds,
      maxDistance: radius,
      count: 256,
    })

    const clusters = this._clusterBlocks(blocks.map(pos => ({
      position: pos,
      block: this.bot.blockAt(pos),
    })))

    const botPos = this.bot.entity.position
    clusters.sort((a, b) => {
      const distA = a.center.distanceTo(botPos)
      const distB = b.center.distanceTo(botPos)
      return distA - distB
    })

    this.logger.info(`Found ${clusters.length} ore clusters within ${radius} blocks`)
    return clusters
  }

  _clusterBlocks(blocks, clusterDistance = 3) {
    const clusters = []
    const visited = new Set()

    for (let i = 0; i < blocks.length; i++) {
      if (visited.has(i)) continue

      const cluster = {
        blocks: [blocks[i]],
        oreType: blocks[i].block?.name || 'unknown',
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

      cluster.center = this._calculateCenter(cluster.blocks)
      cluster.size = cluster.blocks.length
      clusters.push(cluster)
    }

    return clusters
  }

  _calculateCenter(blocks) {
    let x = 0, y = 0, z = 0
    for (const b of blocks) {
      x += b.position.x
      y += b.position.y
      z += b.position.z
    }
    const len = blocks.length
    return new Vec3(x / len, y / len, z / len)
  }

  async mineCluster(cluster) {
    const mined = []
    const failed = []

    this.logger.info(`Mining cluster of ${cluster.blocks.length} ${cluster.oreType} blocks`)

    for (const entry of cluster.blocks) {
      const block = this.bot.blockAt(entry.position)
      if (!block || block.name === 'air') continue

      try {
        await this.navigator.goto(
          entry.position.x,
          entry.position.y,
          entry.position.z,
          4
        )

        const tool = this.bot.pathfinder.bestHarvestTool(block)
        if (tool) {
          await this.bot.equip(tool, 'hand')
        }

        await this.bot.dig(block)
        mined.push(entry.position)
        this.logger.info(`Mined ${block.name} at (${entry.position.x}, ${entry.position.y}, ${entry.position.z})`)
      } catch (err) {
        failed.push({ position: entry.position, error: err.message })
        this.logger.warn(`Failed to mine at ${entry.position}: ${err.message}`)
      }
    }

    return { mined: mined.length, failed: failed.length, details: { mined, failed } }
  }

  async autoMine(options = {}) {
    const {
      radius = 32,
      oreTypes = DEFAULT_ORE_TYPES,
      maxClusters = 10,
    } = options

    this.mining = true
    let clustersProcessed = 0
    let totalMined = 0

    this.logger.info(`Starting auto-mine: radius=${radius}, maxClusters=${maxClusters}`)

    while (this.mining && clustersProcessed < maxClusters) {
      const clusters = this.scanOres(radius, oreTypes)
      if (clusters.length === 0) {
        this.logger.info('No more ore clusters found')
        break
      }

      const cluster = clusters[0]
      const result = await this.mineCluster(cluster)
      totalMined += result.mined
      clustersProcessed++

      this.logger.info(`Auto-mine progress: ${clustersProcessed} clusters, ${totalMined} total blocks`)
    }

    this.mining = false
    this.logger.info(`Auto-mine complete: ${clustersProcessed} clusters, ${totalMined} blocks mined`)

    return { clustersProcessed, totalMined }
  }

  stopMining() {
    this.mining = false
    this.navigator.stop()
  }
}

module.exports = { Miner }

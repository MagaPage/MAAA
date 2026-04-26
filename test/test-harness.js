const EventEmitter = require('events')
const { loadConfig } = require('../src/config')
const { createLogger } = require('../src/utils/logger')
const { DashboardServer } = require('../src/web/server')
const { Leash } = require('../src/bot/leash')

// Mock bot object that extends EventEmitter (real mineflayer bot is an EventEmitter)
class MockBot extends EventEmitter {
  constructor() {
    super()
    this.entity = {
      position: { x: 100, y: 64, z: 200, clone: () => ({ x: 100, y: 64, z: 200 }), distanceTo: () => 0, offset: (dx, dy, dz) => ({ x: 100 + dx, y: 64 + dy, z: 200 + dz }) },
      onGround: true,
      yaw: 0,
    }
    this.health = 18
    this.food = 16
    this.foodSaturation = 5.0
    this.experience = { level: 12, points: 340 }
    this.isRaining = false
    this.time = { timeOfDay: 6000 }
    this.game = { dimension: 'overworld', difficulty: 'normal' }
    this.inventory = {
      items: () => [
        { name: 'cobblestone', count: 64, slot: 0 },
        { name: 'diamond_pickaxe', count: 1, slot: 1 },
        { name: 'torch', count: 32, slot: 2 },
        { name: 'iron_ingot', count: 16, slot: 3 },
      ],
    }
    this.chat = (msg) => console.log(`[BOT CHAT] ${msg}`)
    this.players = {}
    this.entities = {}
    this.version = '1.20.4'
    this.pathfinder = { stop: () => {}, setMovements: () => {}, setGoal: () => {} }
  }
}

// Mock BotManager that simulates a connected bot
class MockBotManager extends EventEmitter {
  constructor() {
    super()
    this.bot = new MockBot()
  }

  getState() {
    return {
      position: { x: 100, y: 64, z: 200 },
      health: this.bot.health,
      food: this.bot.food,
      saturation: this.bot.foodSaturation,
      experience: this.bot.experience,
      inventory: [
        { name: 'cobblestone', count: 64 },
        { name: 'diamond_pickaxe', count: 1 },
        { name: 'torch', count: 32 },
        { name: 'iron_ingot', count: 16 },
      ],
      isRaining: false,
      time: 6000,
      dimension: 'overworld',
    }
  }

  async disconnect() {
    console.log('[MOCK] Bot disconnected')
  }
}

// Mock SkillController
class MockSkillController extends EventEmitter {
  constructor() {
    super()
    this.history = []
    this.currentTask = null
  }

  async execute(command) {
    this.currentTask = { action: command.action, params: command.params, startTime: Date.now() }
    this.emit('taskStart', this.currentTask)

    // Simulate task execution
    await new Promise(r => setTimeout(r, 500))

    const result = { success: true, action: command.action }
    const entry = {
      action: command.action,
      params: command.params,
      result,
      timestamp: new Date().toISOString(),
      duration: 500,
    }
    this.history.push(entry)
    this.currentTask = null
    this.emit('taskComplete', entry)
    return result
  }

  getHistory() { return this.history }
  getCurrentTask() { return this.currentTask }
}

// Mock LLM that returns hardcoded commands
class MockLLMInterface {
  async processWithHistory(message) {
    if (message.toLowerCase().includes('build')) {
      return { success: true, action: 'build', params: { type: 'tower', block: 'cobblestone', height: 10 } }
    }
    if (message.toLowerCase().includes('mine')) {
      return { success: true, action: 'mine', params: { radius: 32 } }
    }
    if (message.toLowerCase().includes('stop')) {
      return { success: true, action: 'stop', params: {} }
    }
    return { success: true, action: 'chat', params: { message: `Echo: ${message}` } }
  }
  resetHistory() {}
}

// Mock ContextGenerator
class MockContextGenerator {
  generate() {
    return '## Bot Status\nPosition: (100, 64, 200)\n## Vitals\nHealth: 18/20\nFood: 16/20'
  }
}

async function startTestDashboard() {
  const config = loadConfig()
  config.web.port = 3001
  const logger = createLogger(config)

  const botManager = new MockBotManager()
  const skillController = new MockSkillController()
  const llmInterface = new MockLLMInterface()
  const contextGenerator = new MockContextGenerator()
  const leash = new Leash(botManager.bot, { maxDistance: 256 })

  const dashboard = new DashboardServer(config, logger)
  dashboard.mountRoutes(botManager, skillController, llmInterface, contextGenerator, leash)
  dashboard.attachBot(botManager, skillController)
  await dashboard.start()

  console.log('Test dashboard running at http://localhost:3001')
  console.log('Press Ctrl+C to stop')

  // Simulate bot events periodically
  setInterval(() => {
    botManager.bot.entity.position.x += Math.floor(Math.random() * 3) - 1
    botManager.bot.entity.position.z += Math.floor(Math.random() * 3) - 1
    botManager.emit('positionUpdate', {
      x: botManager.bot.entity.position.x,
      y: botManager.bot.entity.position.y,
      z: botManager.bot.entity.position.z,
    })
  }, 3000)
}

startTestDashboard()

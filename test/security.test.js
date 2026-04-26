const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const { loadConfig } = require('../src/config')
const { createLogger } = require('../src/utils/logger')
const { DashboardServer } = require('../src/web/server')
const { Leash } = require('../src/bot/leash')
const EventEmitter = require('events')

class MockBot extends EventEmitter {
  constructor() {
    super()
    this.entity = {
      position: { x: 0, y: 64, z: 0, clone: () => ({ x: 0, y: 64, z: 0 }), distanceTo: () => 0 },
    }
    this.health = 20
    this.food = 20
    this.foodSaturation = 5
    this.experience = { level: 0, points: 0 }
    this.isRaining = false
    this.time = { timeOfDay: 0 }
    this.game = { dimension: 'overworld' }
    this.inventory = { items: () => [] }
    this.pathfinder = { stop: () => {}, setMovements: () => {}, setGoal: () => {} }
  }
}

class MockBotManager extends EventEmitter {
  constructor() {
    super()
    this.bot = new MockBot()
  }
  getState() {
    return { position: { x: 0, y: 64, z: 0 }, health: 20, food: 20 }
  }
  async disconnect() {}
}

class MockSkillController extends EventEmitter {
  constructor() {
    super()
  }
  async execute(cmd) { return { success: true, action: cmd.action } }
  getHistory() { return [] }
  getCurrentTask() { return null }
}

class MockLLM {
  async processWithHistory(msg) {
    return { success: true, action: 'chat', params: { message: msg } }
  }
}

class MockContext {
  generate() { return 'test context' }
}

function request(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const options = { hostname: '127.0.0.1', port, path, method, headers: { 'Content-Type': 'application/json' } }
    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (c) => { data += c })
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data })
        }
      })
    })
    req.on('error', reject)
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

describe('Security', () => {
  let server
  const PORT = 3099

  before(async () => {
    const config = loadConfig()
    config.web.port = PORT
    const logger = createLogger(config)
    server = new DashboardServer(config, logger)
    const bm = new MockBotManager()
    const sc = new MockSkillController()
    server.mountRoutes(bm, sc, new MockLLM(), new MockContext(), new Leash(bm.bot))
    server.attachBot(bm, sc)
    await server.start()
  })

  after(async () => {
    await server.stop()
  })

  it('should include security headers', async () => {
    const res = await request(PORT, 'GET', '/api/status')
    assert.ok(res.headers['content-security-policy'])
    assert.ok(res.headers['x-content-type-options'])
    assert.ok(res.headers['x-frame-options'] || res.headers['content-security-policy'].includes('frame-ancestors'))
    assert.equal(res.headers['x-powered-by'], undefined)
  })

  it('should reject SSRF via Discord webhook (non-discord URL)', async () => {
    const res = await request(PORT, 'POST', '/api/integrations/discord/test', {
      webhookUrl: 'https://evil.com/steal-data',
    })
    assert.equal(res.status, 400)
    assert.ok(res.body.error.includes('Invalid'))
  })

  it('should reject SSRF via Discord webhook (internal URL)', async () => {
    const res = await request(PORT, 'POST', '/api/integrations/discord/test', {
      webhookUrl: 'http://169.254.169.254/latest/meta-data/',
    })
    assert.equal(res.status, 400)
  })

  it('should reject invalid Telegram bot token', async () => {
    const res = await request(PORT, 'POST', '/api/integrations/telegram/test', {
      botToken: 'not-a-real-token',
      chatId: '12345',
    })
    assert.equal(res.status, 400)
    assert.ok(res.body.error.includes('Invalid'))
  })

  it('should reject leash maxDistance out of range', async () => {
    const res = await request(PORT, 'POST', '/api/leash', { maxDistance: -1 })
    assert.equal(res.status, 400)

    const res2 = await request(PORT, 'POST', '/api/leash', { maxDistance: 99999 })
    assert.equal(res2.status, 400)
  })

  it('should reject empty command', async () => {
    const res = await request(PORT, 'POST', '/api/command', { message: '' })
    assert.equal(res.status, 400)
  })

  it('should reject non-string command', async () => {
    const res = await request(PORT, 'POST', '/api/command', { message: 12345 })
    assert.equal(res.status, 400)
  })

  it('should reject invalid Discord channel ID', async () => {
    const res = await request(PORT, 'POST', '/api/integrations/discord', {
      webhookUrl: 'https://discord.com/api/webhooks/1234567890/abc123def456',
      channelId: 'not-a-number',
    })
    assert.equal(res.status, 400)
  })

  it('should reject invalid Telegram chat ID', async () => {
    const res = await request(PORT, 'POST', '/api/integrations/telegram', {
      botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyz',
      chatId: 'not-a-number',
    })
    assert.equal(res.status, 400)
  })

  it('should not expose internal error details in command endpoint', async () => {
    const res = await request(PORT, 'POST', '/api/command', { message: 'test' })
    if (res.status === 500) {
      assert.equal(res.body.error, 'Command execution failed')
      assert.equal(res.body.stack, undefined)
    }
  })

  it('should return 404 for unknown routes', async () => {
    const res = await request(PORT, 'GET', '/api/secret-admin-panel')
    assert.equal(res.status, 404)
    assert.deepEqual(res.body, { error: 'Not found' })
  })

  it('should reject oversized webhook URL', async () => {
    const longUrl = 'https://discord.com/api/webhooks/' + 'a'.repeat(300)
    const res = await request(PORT, 'POST', '/api/integrations/discord', {
      webhookUrl: longUrl,
    })
    assert.equal(res.status, 400)
  })

  it('should accept valid Discord webhook URL format', async () => {
    const res = await request(PORT, 'POST', '/api/integrations/discord', {
      webhookUrl: 'https://discord.com/api/webhooks/1234567890/abcdefghijklmnop',
      channelId: '12345678901234567',
      enabled: true,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
  })

  it('should accept valid Telegram config format', async () => {
    const res = await request(PORT, 'POST', '/api/integrations/telegram', {
      botToken: '123456789:ABCdefGhIJKlmNoPQRsTUVwxyz',
      chatId: '987654321',
      enabled: true,
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.success, true)
  })

  it('should limit request body size', async () => {
    const bigBody = { message: 'a'.repeat(200000) }
    const res = await request(PORT, 'POST', '/api/command', bigBody)
    assert.ok(res.status === 413 || res.status === 400)
  })
})
